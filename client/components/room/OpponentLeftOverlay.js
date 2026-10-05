'use client';

export default function OpponentLeftOverlay({ reason, opponentName, onNext, onLobby }) {
  const text =
    reason === 'disconnected'
      ? `${opponentName} lost connection and didn't come back.`
      : `${opponentName} skipped to the next opponent.`;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-storm-950/85 p-6 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="left-title" className="w-full max-w-md animate-pop rounded-xl border border-storm-700 bg-storm-900 p-8">
        <h2 id="left-title" className="font-display text-4xl font-black italic leading-none">
          Match over
        </h2>
        <p className="mt-3 text-haze">{text}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button onClick={onNext} className="btn-loot flex-1" autoFocus>
            Find next opponent
          </button>
          <button onClick={onLobby} className="btn-ghost flex-1">
            Back to lobby
          </button>
        </div>
      </div>
    </div>
  );
}
