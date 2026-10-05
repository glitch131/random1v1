'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import LobbyModal from '@/components/LobbyModal';
import { MODES, REGIONS } from '@/lib/constants';

function useElapsed(active) {
  const startedAt = useRef(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) {
      startedAt.current = null;
      return;
    }
    if (!startedAt.current) startedAt.current = Date.now();
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!active || !startedAt.current) return '0:00';
  const s = Math.floor((Date.now() - startedAt.current) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function StormRings() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {[0, 0.9, 1.8].map((delay) => (
        <span
          key={delay}
          className="absolute aspect-square w-[85%] max-w-[22rem] animate-storm rounded-full border-[6px] border-storm-950/40"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

export default function LobbyPage() {
  const { connected, search, activeRoomId, lobbyStats, profile, streak, startSearch, cancelSearch } = useGame();
  const [open, setOpen] = useState(false);
  const elapsed = useElapsed(Boolean(search));
  const close = useCallback(() => setOpen(false), []);

  async function handleSubmit(nextProfile) {
    const res = await startSearch(nextProfile);
    if (res.ok) setOpen(false);
    return res;
  }

  const s = streak || { current: 0, best: 0, wins: 0, losses: 0 };

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      {activeRoomId && !search && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-md border border-shield/40 bg-storm-900 px-4 py-3">
          <p className="text-sm">You still have a match open.</p>
          <Link href={`/room/${activeRoomId}`} className="btn-ghost py-2 text-sm">
            Back to your match
          </Link>
        </div>
      )}

      <section className="pt-4 md:pt-10">
        <h1 className="max-w-4xl font-display text-[clamp(3.25rem,8.5vw,7rem)] font-black italic leading-[0.86] tracking-tight">
          Find someone to 1v1, right now.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-haze">
          Pick your region and mode. You get paired with the next player searching, swap the island code in chat, and
          play. No sign-up.
        </p>
      </section>

      {/* The matchup: you on the left, whoever queues next on the right */}
      <section className="mt-10 md:mt-14" aria-label="Matchup">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
          <div className="cut-left -mr-7 min-w-0 bg-shield px-5 py-8 pr-12 text-storm-950 md:px-8 md:py-14 md:pr-16">
            <p className="text-sm font-medium">You</p>
            <p className="mt-1 truncate font-display text-4xl font-black italic leading-none md:text-6xl">
              {profile?.username || 'Your name'}
            </p>
            <p className="mt-2 truncate text-sm font-medium">
              {profile ? `${profile.input} in ${profile.region}` : 'Set in the next step'}
            </p>
          </div>

          <div className="relative z-10 flex items-center px-1">
            <span className="font-display text-5xl font-black italic leading-none text-loot md:text-8xl">vs</span>
          </div>

          <div
            className="cut-right relative -ml-7 min-w-0 overflow-hidden bg-rival px-5 py-8 pl-12 text-right text-storm-950 md:px-8 md:py-14 md:pl-16"
            aria-live="polite"
          >
            {search ? (
              <>
                <StormRings />
                <div className="relative">
                  <p className="text-sm font-medium">Searching {search.region}</p>
                  <p className="mt-1 font-display text-4xl font-black italic leading-none tabular-nums md:text-6xl">
                    {elapsed}
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {search.mode}
                    {typeof search.inQueue === 'number' && search.inQueue > 1
                      ? `, ${search.inQueue} in this queue`
                      : ', waiting for the next player'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Opponent</p>
                <p className="mt-1 font-display text-4xl font-black italic leading-none md:text-6xl">Anyone</p>
                <p className="mt-2 text-sm font-medium">Next player in your queue</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          {search ? (
            <button onClick={cancelSearch} className="btn-ghost px-8 text-lg">
              Cancel search
            </button>
          ) : (
            <button onClick={() => setOpen(true)} disabled={!connected} className="btn-loot px-8 text-lg">
              Find an opponent
            </button>
          )}
          {!connected && <p className="text-sm text-haze">Waiting for the match server to come online.</p>}
        </div>
      </section>

      <section className="mt-20 grid gap-12 md:grid-cols-[260px_1fr]">
        <div>
          <h2 className="font-display text-3xl font-extrabold italic">Your win streak</h2>
          <p className="mt-2 font-display text-8xl font-black italic leading-none text-loot tabular-nums">{s.current}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-haze">Best</dt>
            <dd className="tabular-nums">{s.best}</dd>
            <dt className="text-haze">Record</dt>
            <dd className="tabular-nums">
              {s.wins}–{s.losses}
            </dd>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-haze">
            Counts when both players confirm the same winner. Stored in this browser only.
          </p>
        </div>

        <div className="min-w-0">
          <h2 className="font-display text-3xl font-extrabold italic">Who&apos;s searching</h2>
          <p className="mt-1 text-sm text-haze">Players waiting right now, by mode and region.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-4 text-left font-medium text-haze">Mode</th>
                  {REGIONS.map((r) => (
                    <th key={r} scope="col" className="px-2 py-2 text-right font-medium text-haze">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODES.map((m) => (
                  <tr key={m} className="border-t border-storm-800">
                    <th scope="row" className="py-3 pr-4 text-left font-medium">
                      {m}
                    </th>
                    {REGIONS.map((r) => {
                      const n = lobbyStats.searching[`${r}|${m}`] || 0;
                      const yours = profile && profile.region === r && profile.mode === m;
                      return (
                        <td
                          key={r}
                          className={`px-2 py-3 text-right tabular-nums ${
                            n ? 'font-semibold text-loot' : 'text-storm-600'
                          } ${yours ? 'bg-storm-900' : ''}`}
                        >
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="mt-20 border-t border-storm-800 pt-6 text-xs text-haze">
        random1v1 is a fan project and is not affiliated with or endorsed by Epic Games. Stats via fortnite-api.com.
      </footer>

      <LobbyModal open={open} initial={profile} onClose={close} onSubmit={handleSubmit} />
    </main>
  );
}
