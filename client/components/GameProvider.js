'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { loadProfile, loadStreak, saveProfile } from '@/lib/storage';

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const router = useRouter();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState(null); // { region, mode, queuedAt, inQueue }
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [lobbyStats, setLobbyStats] = useState({ online: 0, searching: {} });
  const [profile, setProfile] = useState(null);
  const [streak, setStreak] = useState(null);
  const [replaced, setReplaced] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setStreak(loadStreak());
  }, []);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onSession = ({ roomId, search: srv }) => {
      setActiveRoomId(roomId || null);
      setSearch(srv || null);
    };
    const onQueueStatus = (status) => setSearch(status);
    const onQueueLeft = () => setSearch(null);
    const onMatch = ({ roomId }) => {
      setSearch(null);
      setActiveRoomId(roomId);
      router.push(`/room/${roomId}`);
    };
    const onOpponentLeft = ({ roomId }) => setActiveRoomId((cur) => (cur === roomId ? null : cur));
    const onReplaced = () => setReplaced(true);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('session', onSession);
    s.on('queue:status', onQueueStatus);
    s.on('queue:left', onQueueLeft);
    s.on('match:found', onMatch);
    s.on('room:opponent_left', onOpponentLeft);
    s.on('lobby:stats', setLobbyStats);
    s.on('session:replaced', onReplaced);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('session', onSession);
      s.off('queue:status', onQueueStatus);
      s.off('queue:left', onQueueLeft);
      s.off('match:found', onMatch);
      s.off('room:opponent_left', onOpponentLeft);
      s.off('lobby:stats', setLobbyStats);
      s.off('session:replaced', onReplaced);
    };
  }, [router]);

  const startSearch = useCallback(
    (nextProfile) =>
      new Promise((resolve) => {
        const s = getSocket();
        saveProfile(nextProfile);
        setProfile(nextProfile);
        // Optimistic: show the search right away. The server may answer with
        // match:found before the ack arrives, which clears this again.
        setActiveRoomId(null);
        setSearch({ region: nextProfile.region, mode: nextProfile.mode, queuedAt: Date.now(), inQueue: null });
        s.timeout(8000).emit('queue:join', nextProfile, (err, res) => {
          if (err || !res?.ok) {
            setSearch(null);
            return resolve(
              err
                ? { ok: false, error: "The match server didn't answer. Check your connection and try again." }
                : res || { ok: false, error: 'Could not join the queue.' }
            );
          }
          resolve({ ok: true });
        });
      }),
    []
  );

  const cancelSearch = useCallback(() => {
    getSocket()?.emit('queue:leave', {});
    setSearch(null);
  }, []);

  /** Leave the current room. With requeue, the server puts you straight back in the same queue. */
  const leaveRoom = useCallback(
    (requeue) => {
      const s = getSocket();
      s?.emit('room:skip', { requeue: Boolean(requeue) });
      setActiveRoomId(null);
      if (requeue && profile) {
        setSearch({ region: profile.region, mode: profile.mode, queuedAt: Date.now(), inQueue: null });
      }
      router.push('/');
    },
    [profile, router]
  );

  const refreshStreak = useCallback(() => setStreak(loadStreak()), []);

  const value = useMemo(
    () => ({
      socket,
      connected,
      search,
      activeRoomId,
      setActiveRoomId,
      lobbyStats,
      profile,
      streak,
      startSearch,
      cancelSearch,
      leaveRoom,
      refreshStreak,
    }),
    [socket, connected, search, activeRoomId, lobbyStats, profile, streak, startSearch, cancelSearch, leaveRoom, refreshStreak]
  );

  return (
    <GameContext.Provider value={value}>
      {children}
      {replaced && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-storm-600 bg-storm-900 px-5 py-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm">random1v1 is open in another tab, so this tab was disconnected.</p>
            <button className="btn-loot py-2 text-sm" onClick={() => window.location.reload()}>
              Use this tab instead
            </button>
          </div>
        </div>
      )}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
