'use client';

import { useEffect, useRef, useState } from 'react';
import { INPUTS, MODES, MODE_HINTS, REGIONS } from '@/lib/constants';

function ChoiceGroup({ legend, name, options, value, onChange, hints }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-haze">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <label
              key={opt}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-loot ${
                selected
                  ? 'border-loot bg-loot font-semibold text-storm-950'
                  : 'border-storm-600 text-ice hover:border-haze'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt}
                checked={selected}
                onChange={() => onChange(opt)}
                className="sr-only"
              />
              <span className="block">{opt}</span>
              {hints && hints[opt] && (
                <span className={`block text-xs font-normal ${selected ? 'text-storm-800' : 'text-haze'}`}>
                  {hints[opt]}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function LobbyModal({ open, initial, onClose, onSubmit }) {
  const [form, setForm] = useState({ username: '', region: '', input: '', mode: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      username: initial?.username || '',
      region: initial?.region || '',
      input: initial?.input || '',
      mode: initial?.mode || '',
    });
    setError(null);
    const t = setTimeout(() => nameRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    const username = form.username.trim();
    if (username.length < 3) return setError('Enter your Fortnite username. Your opponent needs it to add you.');
    if (!form.region) return setError('Pick the region you play on.');
    if (!form.input) return setError('Pick your input device.');
    if (!form.mode) return setError('Pick a mode.');
    setBusy(true);
    setError(null);
    const res = await onSubmit({ ...form, username });
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-storm-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-title"
        className="max-h-[92vh] w-full max-w-xl animate-pop overflow-y-auto rounded-t-xl border border-storm-700 bg-storm-900 p-6 sm:rounded-xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="lobby-title" className="font-display text-4xl font-black italic leading-none">
            Before you queue
          </h2>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-haze hover:text-ice" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-haze">
          You only get matched with players on the same region and mode.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-haze">
              Fortnite username
            </label>
            <input
              ref={nameRef}
              id="username"
              value={form.username}
              onChange={(e) => set('username')(e.target.value)}
              maxLength={32}
              autoComplete="nickname"
              spellCheck={false}
              placeholder="Your exact Epic display name"
              className="w-full rounded-md border border-storm-600 bg-storm-950 px-4 py-3 text-lg text-ice placeholder:text-storm-600 focus:border-loot focus:outline-none"
              required
            />
            <p className="mt-1.5 text-xs text-haze">Used to pull your stats. Nothing is saved on our side.</p>
          </div>

          <ChoiceGroup legend="Region" name="region" options={REGIONS} value={form.region} onChange={set('region')} />
          <ChoiceGroup legend="Input device" name="input" options={INPUTS} value={form.input} onChange={set('input')} />
          <ChoiceGroup legend="Mode" name="mode" options={MODES} value={form.mode} onChange={set('mode')} hints={MODE_HINTS} />

          {error && (
            <p role="alert" className="rounded-md border border-alert/50 bg-alert/10 px-3 py-2 text-sm text-alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-loot w-full text-lg">
            {busy ? 'Joining queue' : 'Start searching'}
          </button>
        </form>
      </div>
    </div>
  );
}
