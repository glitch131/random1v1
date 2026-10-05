import { io } from 'socket.io-client';

const PLAYER_KEY = 'random1v1:player';
let socket = null;

function makeId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A per-tab session id so a refresh can reclaim your seat in a match. */
export function getPlayerId() {
  let id = null;
  try {
    id = sessionStorage.getItem(PLAYER_KEY);
  } catch {}
  if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
    id = makeId();
    try {
      sessionStorage.setItem(PLAYER_KEY, id);
    } catch {}
  }
  return id;
}

/** One socket for the whole app, kept alive across client-side navigation. */
export function getSocket() {
  if (typeof window === 'undefined') return null;
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      auth: { playerId: getPlayerId() },
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}
