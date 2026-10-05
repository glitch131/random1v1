// Everything the browser remembers lives here: no accounts, no database.
const PROFILE_KEY = 'random1v1:profile';
const STREAK_KEY = 'random1v1:streak';
const COUNTED_KEY = 'random1v1:counted';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const loadProfile = () => read(PROFILE_KEY);
export const saveProfile = (profile) => write(PROFILE_KEY, profile);

export function loadStreak() {
  return { current: 0, best: 0, wins: 0, losses: 0, ...(read(STREAK_KEY) || {}) };
}

/**
 * Called once both players confirm the same winner.
 * Winner's streak goes up; loser's resets. Each room+round is counted once.
 */
export function recordResult(roomId, round, youWon) {
  const tag = `${roomId}:${round}`;
  const counted = read(COUNTED_KEY) || [];
  if (counted.includes(tag)) return loadStreak();

  const s = loadStreak();
  if (youWon) {
    s.current += 1;
    s.wins += 1;
    s.best = Math.max(s.best, s.current);
  } else {
    s.current = 0;
    s.losses += 1;
  }
  write(STREAK_KEY, s);
  write(COUNTED_KEY, [...counted, tag].slice(-50));
  return s;
}
