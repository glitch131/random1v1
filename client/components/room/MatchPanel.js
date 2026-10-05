'use client';

export default function MatchPanel({ result, opponentName, streak, onOpenReport, onRematch, onNext, onLobby }) {
  const { status, round, myClaim, opponentReported, opponentClaim } = result;
  // Both claims are from your point of view: 'me' means you won.
  const said = (claim, who) => (claim === 'me' ? 'you won' : who === 'you' ? `${opponentName} won` : 'they won');

  return (
    <aside aria-label="Match controls" className="flex flex-col gap-5 border border-storm-800 bg-storm-900 p-5">
      <div aria-live="polite">
        {status === 'active' && (
          <>
            <h2 className="font-display text-3xl font-extrabold italic leading-none">Round {round}</h2>
            {!myClaim && !opponentReported && (
              <p className="mt-2 text-sm leading-relaxed text-haze">
                When the round ends, both of you report who won. Matching reports count toward the winner&apos;s streak.
              </p>
            )}
            {!myClaim && opponentReported && (
              <p className="mt-2 text-sm leading-relaxed text-loot">{opponentName} has reported. Add yours to settle it.</p>
            )}
            {myClaim && (
              <p className="mt-2 text-sm leading-relaxed text-haze">
                You reported {myClaim === 'me' ? 'that you won' : `that ${opponentName} won`}. Waiting for {opponentName}.
              </p>
            )}
            <button onClick={onOpenReport} className={`mt-4 w-full ${myClaim ? 'btn-ghost' : 'btn-loot'}`}>
              {myClaim ? 'Change my report' : 'Report result'}
            </button>
          </>
        )}

        {status === 'resolved' && (
          <>
            <h2 className={`font-display text-3xl font-black italic leading-none ${myClaim === 'me' ? 'text-loot' : 'text-ice'}`}>
              {myClaim === 'me' ? `You won round ${round}` : `${opponentName} won round ${round}`}
            </h2>
            <p className="mt-2 text-sm text-haze">
              {myClaim === 'me'
                ? `Both reports match. Your streak is now ${streak?.current ?? 1}.`
                : 'Both reports match. Your streak reset to 0.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onRematch} className="btn-loot px-3">
                Rematch
              </button>
              <button onClick={onNext} className="btn-ghost px-3">
                Next opponent
              </button>
            </div>
          </>
        )}

        {status === 'disputed' && (
          <>
            <h2 className="font-display text-3xl font-extrabold italic leading-none text-alert">Reports don&apos;t match</h2>
            <p className="mt-2 text-sm leading-relaxed text-haze">
              You said {said(myClaim, 'you')}, {opponentName} said {said(opponentClaim, 'them')}. Nothing was counted. Play it
              again or move on.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onRematch} className="btn-loot px-3">
                Rematch
              </button>
              <button onClick={onNext} className="btn-ghost px-3">
                Skip
              </button>
            </div>
          </>
        )}
      </div>

      <div className="mt-auto border-t border-storm-800 pt-5">
        <button onClick={onNext} className="btn-ghost w-full">
          Skip to next opponent
        </button>
        <p className="mt-2 text-xs text-haze">Leaves this match and puts you back in the same queue.</p>
        <button onClick={onLobby} className="mt-3 text-sm text-haze underline-offset-4 hover:text-ice hover:underline">
          Leave and go to lobby
        </button>
      </div>
    </aside>
  );
}
