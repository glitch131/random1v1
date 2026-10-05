'use client';

import CopyButton from '@/components/CopyButton';

function fmt(n, suffix = '') {
  if (n === null || n === undefined) return '–';
  return `${typeof n === 'number' ? n.toLocaleString() : n}${suffix}`;
}

function StatusBadge({ stats }) {
  switch (stats?.status) {
    case 'ok':
      return <span className="rounded-md bg-shield/15 px-2.5 py-1 text-sm font-medium text-shield">✓ Verified Epic account</span>;
    case 'not_found':
      return <span className="rounded-md bg-alert/15 px-2.5 py-1 text-sm font-medium text-alert">No Epic account with this name</span>;
    case 'private':
      return <span className="rounded-md bg-storm-800 px-2.5 py-1 text-sm text-haze">Stats set to private</span>;
    default:
      return null;
  }
}

function StatsBody({ stats }) {
  if (!stats || stats.status === 'loading') {
    return (
      <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Loading stats">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-storm-800" />
        ))}
      </div>
    );
  }

  const messages = {
    private: 'This player hides their stats in Fortnite settings, so we can only confirm the name they entered.',
    not_found: "Epic doesn't recognise this name. Check spelling with them in chat before you send a friend request.",
    no_key: 'Stats are switched off on this server (no fortnite-api.com key set).',
    error: "Couldn't reach the stats service. The match still works; check their name in-game.",
  };
  if (stats.status !== 'ok') {
    return <p className="mt-4 max-w-2xl text-sm text-haze">{messages[stats.status] || messages.error}</p>;
  }

  const o = stats.overall || {};
  const items = [
    ['Level', fmt(stats.level)],
    ['Wins', fmt(o.wins)],
    ['K/D', fmt(o.kd)],
    ['Win rate', fmt(o.winRate, '%')],
    ['Matches', fmt(o.matches)],
  ];

  return (
    <>
      <dl className="mt-5 grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-5">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-haze">{label}</dt>
            <dd className="font-display text-3xl font-extrabold italic leading-tight tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.input && (
        <p className="mt-3 text-sm text-haze">
          On {stats.input.label.toLowerCase()}: {fmt(stats.input.kd)} K/D, {fmt(stats.input.wins)} wins across{' '}
          {fmt(stats.input.matches)} matches. Lifetime Battle Royale stats.
        </p>
      )}
    </>
  );
}

export default function OpponentHeader({ opponent, stats }) {
  const epicName = stats?.status === 'ok' && stats.name ? stats.name : opponent.username;

  return (
    <section aria-label="Your opponent" className="border-l-4 border-rival bg-storm-900 px-5 py-5 md:px-7 md:py-6">
      <p className="text-sm text-haze">
        Your opponent{' '}
        {!opponent.connected && <span className="animate-pulse text-alert">is reconnecting</span>}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="min-w-0 truncate font-display text-4xl font-black italic leading-none md:text-5xl">{epicName}</h1>
        <CopyButton
          text={epicName}
          label="Copy Epic ID"
          copiedLabel="Copied to clipboard"
          className="rounded-md border border-storm-600 px-3 py-1.5 text-sm hover:border-haze"
        />
        <StatusBadge stats={stats} />
      </div>
      <p className="mt-2 text-sm text-haze">
        {opponent.input} in {opponent.region}
      </p>
      <StatsBody stats={stats} />
    </section>
  );
}
