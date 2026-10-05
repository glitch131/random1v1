'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGame } from '@/components/GameProvider';
import { recordResult } from '@/lib/storage';
import OpponentHeader from '@/components/room/OpponentHeader';
import VersusBand from '@/components/room/VersusBand';
import ChatBox from '@/components/room/ChatBox';
import MatchPanel from '@/components/room/MatchPanel';
import ReportModal from '@/components/room/ReportModal';
import OpponentLeftOverlay from '@/components/room/OpponentLeftOverlay';
import DisputeModal from '@/components/room/DisputeModal';

export default function RoomPage() {
  const params = useParams();
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { socket, connected, profile, streak, startSearch, leaveRoom, refreshStreak, setActiveRoomId } = useGame();

  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [opponentLeft, setOpponentLeft] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  // ---- Socket wiring -------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const join = () => {
      socket.timeout(8000).emit('room:join', { roomId }, (err, res) => {
        if (err) return; // the next 'connect' retries
        if (!res?.ok) {
          setError(res?.error || 'This match has ended.');
          setActiveRoomId(null);
          return;
        }
        setError(null);
        setState(res.state);
        setActiveRoomId(roomId);
      });
    };

    const forThisRoom = (payload) => payload && payload.roomId === roomId;
    const patch = (fn) => setState((s) => (s ? fn(s) : s));

    const onMessage = (p) => {
      if (!forThisRoom(p)) return;
      patch((s) =>
        s.messages.some((m) => m.id === p.message.id) ? s : { ...s, messages: [...s.messages, p.message].slice(-100) }
      );
    };
    const onStats = (p) => {
      if (!forThisRoom(p)) return;
      patch((s) => ({ ...s, [p.who === 'me' ? 'myStats' : 'opponentStats']: p.stats }));
    };
    const onResult = (p) => {
      if (!forThisRoom(p)) return;
      patch((s) => ({ ...s, result: p.result }));
      if (p.result.status !== 'active') setReportOpen(false);
      if (p.result.status !== 'disputed') setDisputeOpen(false);
    };
    const onAgreed = (p) => {
      if (!forThisRoom(p)) return;
      recordResult(roomId, p.round, p.youWon);
      refreshStreak();
    };
    const onDisputed = (p) => {
      if (forThisRoom(p)) setDisputeOpen(true);
    };
    const onConnection = (p) => {
      if (!forThisRoom(p)) return;
      patch((s) => ({ ...s, opponent: { ...s.opponent, connected: p.connected } }));
    };
    const onLeft = (p) => {
      if (!forThisRoom(p)) return;
      setReportOpen(false);
      setDisputeOpen(false);
      setOpponentLeft(p.reason || 'skipped');
    };

    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('chat:message', onMessage);
    socket.on('room:stats', onStats);
    socket.on('result:update', onResult);
    socket.on('result:agreed', onAgreed);
    socket.on('result:disputed', onDisputed);
    socket.on('room:opponent_connection', onConnection);
    socket.on('room:opponent_left', onLeft);

    return () => {
      socket.off('connect', join);
      socket.off('chat:message', onMessage);
      socket.off('room:stats', onStats);
      socket.off('result:update', onResult);
      socket.off('result:agreed', onAgreed);
      socket.off('result:disputed', onDisputed);
      socket.off('room:opponent_connection', onConnection);
      socket.off('room:opponent_left', onLeft);
    };
  }, [socket, roomId, refreshStreak, setActiveRoomId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  // ---- Actions -------------------------------------------------------------
  const emit = useCallback(
    (event, payload) =>
      new Promise((resolve) => {
        if (!socket) return resolve({ ok: false, error: 'Not connected.' });
        socket.timeout(8000).emit(event, payload, (err, res) => {
          if (err) return resolve({ ok: false, error: "The match server didn't answer. Try again." });
          resolve(res || { ok: true });
        });
      }),
    [socket]
  );

  const sendChat = useCallback((text) => emit('chat:send', { text }), [emit]);

  const report = useCallback(
    async (claim) => {
      const res = await emit('result:report', { claim });
      if (res.ok) setReportOpen(false);
      else setNotice(res.error);
    },
    [emit]
  );

  const rematch = useCallback(async () => {
    const res = await emit('result:rematch', {});
    if (!res.ok) setNotice(res.error);
  }, [emit]);

  const findNext = useCallback(() => {
    if (!profile) return router.push('/');
    router.push('/'); // navigate first so an instant match:found isn't overridden
    startSearch(profile);
  }, [profile, router, startSearch]);

  const closeReport = useCallback(() => setReportOpen(false), []);

  // ---- Views ---------------------------------------------------------------
  if (error) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <h1 className="font-display text-5xl font-black italic leading-none">This match is closed</h1>
        <p className="mt-3 text-haze">{error}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {profile && (
            <button onClick={findNext} className="btn-loot">
              Find a new opponent
            </button>
          )}
          <Link href="/" className="btn-ghost">
            Back to lobby
          </Link>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16" aria-busy="true">
        <p className="text-haze">{connected ? 'Joining your match' : 'Connecting to the match server'}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 pb-12">
      <p className="mb-3 text-sm text-haze">
        {state.mode} in {state.region}
      </p>

      <OpponentHeader opponent={state.opponent} stats={state.opponentStats} />

      <VersusBand
        me={state.me}
        opponent={state.opponent}
        myStats={state.myStats}
        opponentStats={state.opponentStats}
        result={state.result}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <ChatBox
          messages={state.messages}
          onSend={sendChat}
          disabled={!connected || Boolean(opponentLeft)}
          opponentName={state.opponent.username}
        />
        <MatchPanel
          result={state.result}
          opponentName={state.opponent.username}
          streak={streak}
          onOpenReport={() => setReportOpen(true)}
          onRematch={rematch}
          onNext={() => leaveRoom(true)}
          onLobby={() => leaveRoom(false)}
        />
      </div>

      <ReportModal
        open={reportOpen}
        round={state.result.round}
        opponentName={state.opponent.username}
        myClaim={state.result.myClaim}
        onPick={report}
        onClose={closeReport}
      />

      {disputeOpen && !opponentLeft && (
        <DisputeModal
          round={state.result.round}
          opponentName={state.opponent.username}
          onRematch={() => {
            setDisputeOpen(false);
            rematch();
          }}
          onSkip={() => leaveRoom(true)}
          onClose={() => setDisputeOpen(false)}
        />
      )}

      {opponentLeft && (
        <OpponentLeftOverlay
          reason={opponentLeft}
          opponentName={state.opponent.username}
          onNext={findNext}
          onLobby={() => router.push('/')}
        />
      )}

      {notice && (
        <p
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-alert/50 bg-storm-900 px-4 py-2 text-sm text-alert"
        >
          {notice}
        </p>
      )}
    </main>
  );
}
