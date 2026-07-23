import type { Assignment, AssignmentResult, Member, Team } from '../types';

/** Fisher–Yates shuffle (in place). */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Randomly assign members to teams as evenly as possible.
 * Team sizes differ by at most 1.
 * Picks one random leader per non-empty team.
 */
export function assignEqually(
  members: Member[],
  teams: Team[],
): AssignmentResult {
  if (teams.length === 0) return { teams: {}, leaders: {} };

  const shuffled = shuffle([...members]);
  const buckets: Assignment = Object.fromEntries(teams.map((t) => [t.id, []]));

  shuffled.forEach((member, index) => {
    buckets[teams[index % teams.length].id].push(member);
  });

  const leaders: Record<string, string> = {};
  for (const team of teams) {
    const roster = buckets[team.id];
    if (roster.length > 0) {
      leaders[team.id] = roster[Math.floor(Math.random() * roster.length)].id;
    }
  }

  return { teams: buckets, leaders };
}
