'use strict';

/**
 * random1v1 match server
 * ----------------------
 * Everything lives in RAM: players, queues, rooms, chat, result reports.
 * Restarting the process wipes all of it (by design: zero database).
 * Run a single instance; in-memory state is not shared between instances.
 */

require('dotenv').config();

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const FORTNITE_API_KEY = process.env.FORTNITE_API_KEY || '';

const RECONNECT_GRACE_MS = 20_000; // how long a dropped player keeps their seat
const SKIP_COOLDOWN_MS = 45_000; // two players who just split won't be re-paired for this long
const STATS_CACHE_MS = 2 * 60_000; // short RAM cache so a rematch doesn't re-hit the API
const STATS_CACHE_MAX = 2_000;
const TICK_MS = 2_000;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LEN = 280;
const CHAT_BURST = 5; // messages
const CHAT_WINDOW_MS = 5_000; // per window

const REGIONS = ['NA-East', 'NA-West', 'Europe', 'OCE', 'Brazil', 'Asia', 'ME'];
const INPUTS = ['Keyboard & Mouse', 'Controller', 'Mobile'];
const MODES = ['Box Fights', 'Zone Wars', 'Realistics'];
const INPUT_BUCKET = {
  'Keyboard & Mouse': 'keyboardMouse',
  Controller: 'gamepad',
  Mobile: 'touch',
};

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
/** playerId -> Player */
const players = new Map();
/** "Region|Mode" -> [playerId, ...] (FIFO) */
const queues = new Map();
/** roomId -> Room */
const rooms = new Map();
/** "name|input" -> { expires, result } */
const statsCache = new Map();

// ---------------------------------------------------------------------------
// HTTP + Socket.io
// ---------------------------------------------------------------------------
const app = express();
app.use(cors({ origin: CLIENT_ORIGINS }));
app.get('/health', (_req, res) => {
  res.json({ ok: true, players: players.size, rooms: rooms.size, ...lobbyStats() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGINS, methods: ['GET', 'POST'] },
  pingInterval: 10_000,
  pingTimeout: 8_000,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const now = () => Date.now();
const queueKey = (region, mode) => `${region}|${mode}`;
const isValidId = (id) => typeof id === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(id);
const reply = (ack, payload) => {
  if (typeof ack === 'function') ack(payload);
};
const round2 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

function emitTo(playerId, event, payload) {
  const p = players.get(playerId);
  if (p && p.connected && p.socketId) io.to(p.socketId).emit(event, payload);
}

function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (name.length < 3 || name.length > 32) return null;
  return name;
}

function validateProfile(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Fill in the lobby form first.' };
  const username = cleanName(raw.username);
  if (!username) return { error: 'Enter your Fortnite username (3 to 32 characters).' };
  if (!REGIONS.includes(raw.region)) return { error: 'Pick a region.' };
  if (!INPUTS.includes(raw.input)) return { error: 'Pick your input device.' };
  if (!MODES.includes(raw.mode)) return { error: 'Pick a mode.' };
  return { profile: { username, region: raw.region, input: raw.input, mode: raw.mode } };
}

function publicProfile(p) {
  if (!p || !p.profile) return null;
  const { username, region, input, mode } = p.profile;
  return { username, region, input, mode };
}

const otherId = (room, pid) => room.players.find((id) => id !== pid);

// ---------------------------------------------------------------------------
// Lobby stats (online + searching counts per queue)
// ---------------------------------------------------------------------------
let lobbyDirty = true;
const markLobbyDirty = () => {
  lobbyDirty = true;
};

function lobbyStats() {
  let online = 0;
  for (const p of players.values()) if (p.connected) online += 1;
  const searching = {};
  for (const [key, q] of queues) searching[key] = q.length;
  return { online, searching };
}

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------
function removeFromQueue(p) {
  if (!p.queueKey) return;
  const q = queues.get(p.queueKey);
  if (q) {
    const i = q.indexOf(p.id);
    if (i !== -1) q.splice(i, 1);
    if (q.length === 0) queues.delete(p.queueKey);
  }
  p.queueKey = null;
  p.queuedAt = null;
  markLobbyDirty();
}

function searchView(p) {
  if (!p.queueKey || !p.profile) return null;
  const q = queues.get(p.queueKey) || [];
  return {
    region: p.profile.region,
    mode: p.profile.mode,
    queuedAt: p.queuedAt,
    inQueue: q.length,
  };
}

function emitQueueStatus(p) {
  const view = searchView(p);
  if (view) emitTo(p.id, 'queue:status', view);
}

function onCooldown(a, b) {
  const t = now();
  const ua = a.recent.get(b.id);
  const ub = b.recent.get(a.id);
  return (ua && ua > t) || (ub && ub > t);
}

/** Pair `p` with the longest-waiting compatible player in the same Region + Mode queue. */
function tryMatch(p) {
  if (!p.queueKey || !p.connected) return false;
  const q = queues.get(p.queueKey);
  if (!q) return false;
  for (const candidateId of q) {
    if (candidateId === p.id) continue;
    const other = players.get(candidateId);
    if (!other || !other.connected || other.queueKey !== p.queueKey) continue;
    if (onCooldown(p, other)) continue;
    createRoom(other, p);
    return true;
  }
  return false;
}

function joinQueue(p, profile) {
  if (p.roomId) leaveRoom(p, 'skipped');
  removeFromQueue(p);
  p.profile = profile;
  const key = queueKey(profile.region, profile.mode);
  if (!queues.has(key)) queues.set(key, []);
  queues.get(key).push(p.id);
  p.queueKey = key;
  p.queuedAt = now();
  markLobbyDirty();
  if (!tryMatch(p)) emitQueueStatus(p);
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
function serializeMessage(m, viewerId) {
  return {
    id: m.id,
    kind: m.kind,
    text: m.text,
    at: m.at,
    author: m.author || null,
    mine: m.from === viewerId,
  };
}

function pushMessage(room, message) {
  room.messages.push(message);
  if (room.messages.length > MAX_MESSAGES) room.messages.splice(0, room.messages.length - MAX_MESSAGES);
  for (const pid of room.players) {
    emitTo(pid, 'chat:message', { roomId: room.id, message: serializeMessage(message, pid) });
  }
}

function addSystemMessage(room, text) {
  pushMessage(room, { id: crypto.randomUUID(), kind: 'system', from: null, text, at: now() });
}

function resultViewFor(room, pid) {
  const oppId = otherId(room, pid);
  const mine = room.reports[pid];
  const theirs = room.reports[oppId];
  const toClaim = (winnerId) => (winnerId === undefined ? null : winnerId === pid ? 'me' : 'opponent');
  return {
    status: room.status, // 'active' | 'resolved' | 'disputed'
    round: room.round,
    myClaim: toClaim(mine),
    opponentReported: theirs !== undefined,
    // The opponent's claim stays hidden until both have reported.
    opponentClaim: room.status === 'active' ? null : toClaim(theirs),
  };
}

function roomStateFor(room, pid) {
  const oppId = otherId(room, pid);
  const opp = players.get(oppId);
  return {
    roomId: room.id,
    region: room.region,
    mode: room.mode,
    createdAt: room.createdAt,
    me: publicProfile(players.get(pid)),
    opponent: { ...publicProfile(opp), connected: Boolean(opp && opp.connected) },
    myStats: room.stats[pid] || { status: 'loading' },
    opponentStats: room.stats[oppId] || { status: 'loading' },
    messages: room.messages.map((m) => serializeMessage(m, pid)),
    result: resultViewFor(room, pid),
  };
}

function createRoom(a, b) {
  removeFromQueue(a);
  removeFromQueue(b);

  let id;
  do {
    id = crypto.randomBytes(5).toString('hex');
  } while (rooms.has(id));

  const room = {
    id,
    region: a.profile.region,
    mode: a.profile.mode,
    players: [a.id, b.id],
    messages: [],
    reports: {},
    status: 'active',
    round: 1,
    stats: {},
    createdAt: now(),
  };
  rooms.set(id, room);
  a.roomId = id;
  b.roomId = id;

  room.messages.push({
    id: crypto.randomUUID(),
    kind: 'system',
    from: null,
    text: `Matched for ${room.mode} in ${room.region}. Decide who hosts, then paste the island code here.`,
    at: now(),
  });

  for (const p of [a, b]) emitTo(p.id, 'match:found', { roomId: id });
  for (const p of [a, b]) loadStatsInto(room, p);
  markLobbyDirty();
}

function leaveRoom(p, reason) {
  if (!p.roomId) return;
  const room = rooms.get(p.roomId);
  p.roomId = null;
  if (!room) return;

  rooms.delete(room.id);
  const opp = players.get(otherId(room, p.id));
  if (opp) {
    opp.roomId = null;
    const until = now() + SKIP_COOLDOWN_MS;
    p.recent.set(opp.id, until);
    opp.recent.set(p.id, until);
    emitTo(opp.id, 'room:opponent_left', { roomId: room.id, reason });
  }
  markLobbyDirty();
}

function getRoom(p) {
  if (!p.roomId) return null;
  const room = rooms.get(p.roomId);
  if (!room) {
    p.roomId = null;
    return null;
  }
  return room;
}

// ---------------------------------------------------------------------------
// Fortnite stats (fetched on demand, never persisted)
// ---------------------------------------------------------------------------
function pickStats(block) {
  if (!block) return null;
  return {
    wins: block.wins ?? 0,
    kills: block.kills ?? 0,
    kd: round2(block.kd),
    winRate: round2(block.winRate),
    matches: block.matches ?? 0,
  };
}

function shapeStats(data, input) {
  const overall = pickStats(data?.stats?.all?.overall);
  const byInput = pickStats(data?.stats?.[INPUT_BUCKET[input]]?.overall);
  return {
    status: 'ok',
    accountId: data?.account?.id || null,
    name: data?.account?.name || null,
    level: data?.battlePass?.level ?? null,
    overall,
    input: byInput ? { label: input, ...byInput } : null,
  };
}

async function fetchFortniteStats(profile) {
  if (!FORTNITE_API_KEY) return { status: 'no_key' };

  const cacheKey = `${profile.username.toLowerCase()}|${profile.input}`;
  const cached = statsCache.get(cacheKey);
  if (cached && cached.expires > now()) return cached.result;

  const url = new URL('https://fortnite-api.com/v2/stats/br/v2');
  url.searchParams.set('name', profile.username);
  url.searchParams.set('accountType', 'epic');
  url.searchParams.set('timeWindow', 'lifetime');

  let result;
  try {
    const res = await fetch(url, {
      headers: { Authorization: FORTNITE_API_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 403) result = { status: 'private' };
    else if (res.status === 404) result = { status: 'not_found' };
    else if (!res.ok) result = { status: 'error' };
    else {
      const body = await res.json();
      result = shapeStats(body.data, profile.input);
    }
  } catch (err) {
    console.warn('[stats] fetch failed:', err.message);
    result = { status: 'error' };
  }

  if (result.status !== 'error') {
    statsCache.set(cacheKey, { expires: now() + STATS_CACHE_MS, result });
    if (statsCache.size > STATS_CACHE_MAX) statsCache.delete(statsCache.keys().next().value);
  }
  return result;
}

async function loadStatsInto(room, p) {
  room.stats[p.id] = { status: 'loading' };
  const result = await fetchFortniteStats(p.profile);
  if (!rooms.has(room.id)) return; // room closed while we waited
  room.stats[p.id] = result;
  emitTo(p.id, 'room:stats', { roomId: room.id, who: 'me', stats: result });
  emitTo(otherId(room, p.id), 'room:stats', { roomId: room.id, who: 'opponent', stats: result });
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  const playerId = socket.handshake.auth && socket.handshake.auth.playerId;
  if (!isValidId(playerId)) {
    socket.emit('fatal', { error: 'Invalid session. Reload the page.' });
    socket.disconnect(true);
    return;
  }

  let p = players.get(playerId);
  if (p) {
    // Reconnect (refresh, network blip, or a second tab)
    if (p.disconnectTimer) {
      clearTimeout(p.disconnectTimer);
      p.disconnectTimer = null;
    }
    const oldSocketId = p.socketId;
    p.socketId = socket.id;
    p.connected = true;
    if (oldSocketId && oldSocketId !== socket.id) {
      const old = io.sockets.sockets.get(oldSocketId);
      if (old) {
        old.emit('session:replaced');
        old.disconnect(true);
      }
    }
  } else {
    p = {
      id: playerId,
      socketId: socket.id,
      connected: true,
      profile: null,
      roomId: null,
      queueKey: null,
      queuedAt: null,
      recent: new Map(),
      chatTimes: [],
      disconnectTimer: null,
    };
    players.set(playerId, p);
  }

  const room = getRoom(p);
  if (room) {
    emitTo(otherId(room, p.id), 'room:opponent_connection', { roomId: room.id, connected: true });
  }
  socket.emit('session', { roomId: p.roomId, search: searchView(p) });
  socket.emit('lobby:stats', lobbyStats());
  markLobbyDirty();
  if (p.queueKey) tryMatch(p);

  // ---- Queue ---------------------------------------------------------------
  socket.on('queue:join', (raw, ack) => {
    const { profile, error } = validateProfile(raw);
    if (error) return reply(ack, { ok: false, error });
    joinQueue(p, profile);
    reply(ack, { ok: true });
  });

  socket.on('queue:leave', (_payload, ack) => {
    removeFromQueue(p);
    socket.emit('queue:left');
    reply(ack, { ok: true });
  });

  // ---- Room ----------------------------------------------------------------
  socket.on('room:join', (payload, ack) => {
    const roomId = payload && payload.roomId;
    const r = getRoom(p);
    if (!r || r.id !== roomId) {
      return reply(ack, { ok: false, error: 'This match has ended or belongs to other players.' });
    }
    reply(ack, { ok: true, state: roomStateFor(r, p.id) });
  });

  socket.on('chat:send', (payload, ack) => {
    const r = getRoom(p);
    if (!r) return reply(ack, { ok: false, error: 'You are not in a match.' });

    const text = typeof payload?.text === 'string' ? payload.text.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim() : '';
    if (!text) return reply(ack, { ok: false, error: 'Message is empty.' });
    if (text.length > MAX_MESSAGE_LEN) {
      return reply(ack, { ok: false, error: `Keep messages under ${MAX_MESSAGE_LEN} characters.` });
    }

    const t = now();
    p.chatTimes = p.chatTimes.filter((x) => t - x < CHAT_WINDOW_MS);
    if (p.chatTimes.length >= CHAT_BURST) {
      return reply(ack, { ok: false, error: 'Sending too fast. Wait a few seconds.' });
    }
    p.chatTimes.push(t);

    pushMessage(r, {
      id: crypto.randomUUID(),
      kind: 'chat',
      from: p.id,
      author: p.profile.username,
      text,
      at: t,
    });
    reply(ack, { ok: true });
  });

  socket.on('result:report', (payload, ack) => {
    const r = getRoom(p);
    if (!r) return reply(ack, { ok: false, error: 'You are not in a match.' });
    if (r.status !== 'active') {
      return reply(ack, { ok: false, error: 'This round is already settled. Start a rematch to report again.' });
    }
    const claim = payload && payload.claim;
    if (claim !== 'me' && claim !== 'opponent') return reply(ack, { ok: false, error: 'Pick who won.' });

    const oppId = otherId(r, p.id);
    r.reports[p.id] = claim === 'me' ? p.id : oppId;

    const a = r.reports[p.id];
    const b = r.reports[oppId];
    if (a !== undefined && b !== undefined) {
      if (a === b) {
        r.status = 'resolved';
        const winner = players.get(a);
        addSystemMessage(r, `Both reports match: ${winner?.profile?.username || 'Player'} won round ${r.round}.`);
        for (const pid of r.players) {
          emitTo(pid, 'result:agreed', { roomId: r.id, round: r.round, youWon: a === pid });
        }
      } else {
        r.status = 'disputed';
        addSystemMessage(r, `Reports don't match for round ${r.round}. Play a rematch or skip.`);
        for (const pid of r.players) emitTo(pid, 'result:disputed', { roomId: r.id, round: r.round });
      }
    }
    for (const pid of r.players) emitTo(pid, 'result:update', { roomId: r.id, result: resultViewFor(r, pid) });
    reply(ack, { ok: true });
  });

  socket.on('result:rematch', (_payload, ack) => {
    const r = getRoom(p);
    if (!r) return reply(ack, { ok: false, error: 'You are not in a match.' });
    if (r.status === 'active' && Object.keys(r.reports).length === 0) {
      return reply(ack, { ok: true }); // nothing to reset
    }
    r.reports = {};
    r.status = 'active';
    r.round += 1;
    addSystemMessage(r, `${p.profile.username} started round ${r.round}. Reports reset.`);
    for (const pid of r.players) emitTo(pid, 'result:update', { roomId: r.id, result: resultViewFor(r, pid) });
    reply(ack, { ok: true });
  });

  socket.on('room:skip', (payload, ack) => {
    const profile = p.profile;
    leaveRoom(p, 'skipped');
    if (payload && payload.requeue && profile) joinQueue(p, profile);
    reply(ack, { ok: true });
  });

  // ---- Disconnect ----------------------------------------------------------
  socket.on('disconnect', () => {
    if (p.socketId !== socket.id) return; // replaced by a newer socket
    p.connected = false;
    const r = getRoom(p);
    if (r) emitTo(otherId(r, p.id), 'room:opponent_connection', { roomId: r.id, connected: false });
    markLobbyDirty();

    p.disconnectTimer = setTimeout(() => {
      p.disconnectTimer = null;
      if (p.connected) return;
      removeFromQueue(p);
      leaveRoom(p, 'disconnected');
      players.delete(p.id);
      markLobbyDirty();
    }, RECONNECT_GRACE_MS);
  });
});

// ---------------------------------------------------------------------------
// Heartbeat: retry matches (cooldowns expire, players reconnect), push queue
// status, prune memory, broadcast lobby counts.
// ---------------------------------------------------------------------------
setInterval(() => {
  for (const [key, q] of queues) {
    for (const pid of [...q]) {
      const p = players.get(pid);
      if (p && p.queueKey === key) tryMatch(p);
    }
  }

  for (const q of queues.values()) {
    for (const pid of q) {
      const p = players.get(pid);
      if (p) emitQueueStatus(p);
    }
  }

  const t = now();
  for (const p of players.values()) {
    for (const [otherPid, until] of p.recent) if (until <= t) p.recent.delete(otherPid);
  }
  for (const [k, v] of statsCache) if (v.expires <= t) statsCache.delete(k);

  if (lobbyDirty) {
    lobbyDirty = false;
    io.emit('lobby:stats', lobbyStats());
  }
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`random1v1 match server on :${PORT}`);
  console.log(`Allowed origins: ${CLIENT_ORIGINS.join(', ')}`);
  if (!FORTNITE_API_KEY) console.warn('FORTNITE_API_KEY is not set: opponent stats will show as unavailable.');
});

const shutdown = () => {
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
