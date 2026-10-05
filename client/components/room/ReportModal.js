'use client';

import { useEffect, useState } from 'react';

export default function ReportModal({ open, round, opponentName, myClaim, onPick, onClose }) {
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!open) return;
    setBusy(null);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function pick(claim) {
    setBusy(claim);
    await onPick(claim);
    setBusy(null);
  }

  const option = (claim, label, tone) => {
    const selected = myClaim === claim;
    return (
      <button
        onClick={() => pick(claim)}
        disabled={Boolean(busy)}
        className={`rounded-lg border-2 px-4 py-6 text-left transition-colors disabled:opacity-60 ${
          tone === 'you'
            ? `border-shield ${selected ? 'bg-shield text-storm-950' : 'text-ice hover:bg-shield/15'}`
            : `border-rival ${selected ? 'bg-rival text-storm-950' : 'text-ice hover:bg-rival/15'}`
        }`}
      >
        <span className="block truncate font-display text-3xl font-black italic leading-none">{label}</span>
        <span className="mt-1 block text-sm opacity-80">{busy === claim ? 'Sending' : selected ? 'Your current report' : ''}</span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-storm-950/80 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="w-full max-w-lg animate-pop rounded-t-xl border border-storm-700 bg-storm-900 p-6 sm:rounded-xl sm:p-8"
      >
        <h2 id="report-title" className="font-display text-4xl font-black italic leading-none">
          Who won round {round}?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-haze">
          {opponentName} reports too. If you both pick the same winner, it counts. If not, you choose between a rematch and
          a skip.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {option('me', 'I won', 'you')}
          {option('opponent', `${opponentName} won`, 'them')}
        </div>
        <button onClick={onClose} className="mt-5 text-sm text-haze underline-offset-4 hover:text-ice hover:underline">
          Not finished yet
        </button>
      </div>
    </div>
  );
}
