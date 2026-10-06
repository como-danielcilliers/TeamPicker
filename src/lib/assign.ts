import type {
  Assignment,
  AssignmentResult,
  LeaderRun,
  LeaderStats,
  Member,
  Team,
} from '../types';

/** Fisher–Yates shuffle (in place). */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Derive per-member lead counts from history, limited to current members. */
export function buildLeaderStats(
  history: LeaderRun[],
  memberIds: string[],
): LeaderStats {
  const allowed = new Set(memberIds);
  const stats: LeaderStats = {};
  for (const id of memberIds) {
    stats[id] = { count: 0, lastLedAt: null };
  }

  for (const run of history) {
    for (const memberId of Object.values(run.leaders)) {
      if (!allowed.has(memberId)) continue;
      const entry = stats[memberId];
      entry.count += 1;
      if (!entry.lastLedAt || run.at >= entry.lastLedAt) {
        entry.lastLedAt = run.at;
      }
    }
  }

  return stats;
}

/**
 * Order members by leader priority: fewest leads first, then never-led or
 * least recently led. Shuffling first makes remaining ties random, since
 * `Array.prototype.sort` is stable.
 */
export function rankByLeaderPriority(
  members: Member[],
  stats: LeaderStats,
): Member[] {
  return shuffle([...members]).sort((a, b) => {
    const countDiff = (stats[a.id]?.count ?? 0) - (stats[b.id]?.count ?? 0);
    if (countDiff !== 0) return countDiff;
    const aAt = stats[a.id]?.lastLedAt ?? '';
    const bAt = stats[b.id]?.lastLedAt ?? '';
    return aAt < bAt ? -1 : aAt > bAt ? 1 : 0;
  });
}

/**
 * Randomly assign members to teams as evenly as possible.
 * Team sizes differ by at most 1.
 *
 * Leaders are chosen from the whole present group *before* teams are formed,
 * so nobody leads again until everyone present has led as often as they have.
 * Picking per team after shuffling can't guarantee that, because a team may
 * end up containing only people who have already led.
 */
export function assignEqually(
  members: Member[],
  teams: Team[],
  stats: LeaderStats,
  runId: string,
): AssignmentResult {
  if (teams.length === 0) return { teams: {}, leaders: {}, runId };

  const available = members.filter((m) => !m.absent);
  const ranked = rankByLeaderPriority(available, stats);
  const leaderCount = Math.min(teams.length, ranked.length);
  const chosenLeaders = ranked.slice(0, leaderCount);
  const rest = shuffle(ranked.slice(leaderCount));

  // When there are fewer members than teams, spread leaders over random teams
  // rather than always filling the first ones.
  const teamOrder = shuffle([...teams]);
  const buckets: Assignment = Object.fromEntries(teams.map((t) => [t.id, []]));
  const leaders: Record<string, string> = {};

  chosenLeaders.forEach((leader, index) => {
    const teamId = teamOrder[index].id;
    buckets[teamId].push(leader);
    leaders[teamId] = leader.id;
  });

  rest.forEach((member, index) => {
    buckets[teamOrder[(leaderCount + index) % teams.length].id].push(member);
  });

  for (const team of teams) {
    shuffle(buckets[team.id]);
  }

  return { teams: buckets, leaders, runId };
}
