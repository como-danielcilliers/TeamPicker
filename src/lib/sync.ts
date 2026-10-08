import { LEADER_HISTORY_CAP, parseDrawSummary } from './storage';
import type { RepoRef } from './github';
import type { AssignmentResult, DrawSummary, LeaderRun, Member, Team } from '../types';

const SYNC_KEY = 'teampicker:sync';

export type SyncConfig = RepoRef & {
  token: string;
  /** Blob sha of teampicker.json as of our last pull/commit; null if the file did not exist. */
  sha: string | null;
  /** Canonical data as of the last pull/commit. Local data differing from it is "uncommitted". */
  syncedSnapshot: string | null;
  pulledAt: string | null;
  committedAt: string | null;
  /** Draw stored in the repo file; carried forward when committing without a new draw. */
  lastDraw: DrawSummary | null;
};

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    if (
      typeof parsed.owner !== 'string' ||
      typeof parsed.repo !== 'string' ||
      typeof parsed.token !== 'string'
    ) {
      return null;
    }
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      token: parsed.token,
      sha: typeof parsed.sha === 'string' ? parsed.sha : null,
      syncedSnapshot:
        typeof parsed.syncedSnapshot === 'string' ? parsed.syncedSnapshot : null,
      pulledAt: typeof parsed.pulledAt === 'string' ? parsed.pulledAt : null,
      committedAt: typeof parsed.committedAt === 'string' ? parsed.committedAt : null,
      lastDraw: parseDrawSummary(parsed.lastDraw),
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig | null): void {
  if (config) localStorage.setItem(SYNC_KEY, JSON.stringify(config));
  else localStorage.removeItem(SYNC_KEY);
}

/**
 * Stable string form of the shared data, used to tell whether local data
 * matches what is in the repo. Fields are rebuilt explicitly so key order
 * never causes false "changed" results.
 */
export function snapshotOf(
  members: Member[],
  teams: Team[],
  leaderHistory: LeaderRun[],
): string {
  return JSON.stringify({
    members: members.map((m) => [m.id, m.name, m.absent]),
    teams: teams.map((t) => [t.id, t.name]),
    leaderHistory: leaderHistory
      .slice(-LEADER_HISTORY_CAP)
      .map((run) => [
        run.id,
        run.at,
        Object.entries(run.leaders).sort(([a], [b]) => a.localeCompare(b)),
      ]),
  });
}

/** `?repo=owner/name` lets a team share a link that pre-fills the connect form. */
export function repoFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('repo');
}

export function summarizeDraw(
  result: AssignmentResult,
  teams: Team[],
  at: string,
): DrawSummary {
  return {
    runId: result.runId,
    at,
    teams: teams.map((team) => {
      const roster = result.teams[team.id] ?? [];
      const leaderId = result.leaders[team.id];
      return {
        id: team.id,
        name: team.name,
        leader: roster.find((m) => m.id === leaderId)?.name ?? null,
        members: roster.map((m) => m.name),
      };
    }),
  };
}

/** Ignores `at` so reshuffle timestamps alone don't count as a different lineup. */
export function sameDraw(a: DrawSummary | null, b: DrawSummary | null): boolean {
  if (!a || !b) return a === b;
  return a.runId === b.runId && JSON.stringify(a.teams) === JSON.stringify(b.teams);
}

export function commitMessageFor(draw: DrawSummary | null, isNewDraw: boolean): string {
  if (!draw || !isNewDraw) return 'Update TeamPicker data';
  const day = new Date(draw.at).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const lines = draw.teams.map((team) => {
    const others = team.members.filter((name) => name !== team.leader);
    const lead = team.leader ? `${team.leader} (lead)` : null;
    return `- ${team.name}: ${[lead, ...others].filter(Boolean).join(', ') || 'nobody'}`;
  });
  return [`Draw teams for ${day}`, '', ...lines].join('\n');
}
