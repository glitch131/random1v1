'use client';

export default function DisputeModal({ round, opponentName, onRematch, onSkip, onClose }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-storm-950/85 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="alertdialog" aria-modal="true" aria-labelledby="dispute-title" className="w-full max-w-md animate-pop rounded-xl border border-alert/50 bg-storm-900 p-8">
        <h2 id="dispute-title" className="font-display text-4xl font-black italic leading-none text-alert">
          Reports don&apos;t match
        </h2>
        <p className="mt-3 leading-relaxed text-haze">
          You and {opponentName} picked different winners for round {round}, so nothing was counted. Run it back to settle
          it, or skip to someone new.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button onClick={onRematch} className="btn-loot flex-1" autoFocus>
            Rematch
          </button>
          <button onClick={onSkip} className="btn-ghost flex-1">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
