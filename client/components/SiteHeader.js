'use client';

import Link from 'next/link';
import { useGame } from '@/components/GameProvider';

export default function SiteHeader() {
  const { connected, lobbyStats } = useGame();
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <Link href="/" className="font-display text-3xl font-black italic leading-none tracking-tight">
        random1v1
      </Link>
      <p className="flex items-center gap-2 text-sm text-haze" aria-live="polite">
        <span
          className={`h-2 w-2 rounded-full ${connected ? 'bg-shield' : 'animate-pulse bg-alert'}`}
          aria-hidden="true"
        />
        {connected ? `${lobbyStats.online} online` : 'Connecting to the match server'}
      </p>
    </header>
  );
}
