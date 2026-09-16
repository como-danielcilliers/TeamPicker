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
 * Prefer members who have led the fewest times, then those who led least
 * recently (never-led first). Remaining ties are random.
 */
export function pickLeader(roster: Member[], stats: LeaderStats): string {
  const minCount = Math.min(
    ...roster.map((member) => stats[member.id]?.count ?? 0),
  );
  const leastLed = roster.filter(
    (member) => (stats[member.id]?.count ?? 0) === minCount,
  );

  const neverLed = leastLed.filter(
    (member) => !stats[member.id]?.lastLedAt,
  );
  let pool = neverLed;
  if (pool.length === 0) {
    let oldest: string | null = null;
    for (const member of leastLed) {
      const at = stats[member.id]?.lastLedAt;
      if (!at) continue;
      if (oldest === null || at < oldest) oldest = at;
    }
    pool = leastLed.filter(
      (member) => stats[member.id]?.lastLedAt === oldest,
    );
  }

  return pool[Math.floor(Math.random() * pool.length)].id;
}

/**
 * Randomly assign members to teams as evenly as possible.
 * Team sizes differ by at most 1.
 * Picks one least-led leader per non-empty team.
 */
export function assignEqually(
  members: Member[],
  teams: Team[],
  stats: LeaderStats,
  runId: string,
): AssignmentResult {
  if (teams.length === 0) return { teams: {}, leaders: {}, runId };

  const available = members.filter((m) => !m.absent);
  const shuffled = shuffle([...available]);
  const buckets: Assignment = Object.fromEntries(teams.map((t) => [t.id, []]));

  shuffled.forEach((member, index) => {
    buckets[teams[index % teams.length].id].push(member);
  });

  const leaders: Record<string, string> = {};
  for (const team of teams) {
    const roster = buckets[team.id];
    if (roster.length > 0) {
      leaders[team.id] = pickLeader(roster, stats);
    }
  }

  return { teams: buckets, leaders, runId };
}
