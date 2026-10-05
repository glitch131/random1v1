'use client';

function reportLine(claim, isMe, result) {
  if (result.status === 'active') {
    if (isMe) return claim ? `Reported: ${claim === 'me' ? 'I won' : 'opponent won'}` : 'Not reported yet';
    return result.opponentReported ? 'Reported' : 'Not reported yet';
  }
  if (!claim) return '';
  if (isMe) return `Said: ${claim === 'me' ? 'I won' : 'opponent won'}`;
  return `Said: ${claim === 'me' ? 'you won' : 'they won'}`;
}

export default function VersusBand({ me, opponent, myStats, opponentStats, result }) {
  const resolved = result.status === 'resolved';
  const iWon = resolved && result.myClaim === 'me';
  const theyWon = resolved && result.myClaim === 'opponent';
  const kd = (s) => (s?.status === 'ok' && s.overall?.kd != null ? `${s.overall.kd} K/D` : null);

  return (
    <section aria-label={`Round ${result.round}`} className="mt-4 grid grid-cols-[1fr_auto_1fr] items-stretch">
      <div className="cut-left -mr-6 min-w-0 bg-shield px-4 py-4 pr-10 text-storm-950 md:px-6 md:pr-14">
        <p className="truncate text-sm font-medium">
          You{kd(myStats) ? `, ${kd(myStats)}` : ''}
          {iWon && ', round winner'}
        </p>
        <p className="truncate font-display text-2xl font-black italic leading-tight md:text-3xl">{me.username}</p>
        <p className="truncate text-xs font-medium md:text-sm">{reportLine(result.myClaim, true, result)}</p>
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center px-1 text-center">
        <span className="font-display text-4xl font-black italic leading-none text-loot md:text-6xl">vs</span>
        <span className="mt-1 text-xs text-haze">Round {result.round}</span>
      </div>

      <div className="cut-right -ml-6 min-w-0 bg-rival px-4 py-4 pl-10 text-right text-storm-950 md:px-6 md:pl-14">
        <p className="truncate text-sm font-medium">
          {theyWon && 'Round winner, '}
          {kd(opponentStats) || 'Opponent'}
        </p>
        <p className="truncate font-display text-2xl font-black italic leading-tight md:text-3xl">{opponent.username}</p>
        <p className="truncate text-xs font-medium md:text-sm">{reportLine(result.opponentClaim, false, result)}</p>
      </div>
    </section>
  );
}
