import type { LeaderRun, Member, Team } from '../types';

const TEAMS_KEY = 'teampicker:teams';
const MEMBERS_KEY = 'teampicker:members';
const HISTORY_KEY = 'teampicker:leaderHistory';
const EXPORT_VERSION = 2;
export const LEADER_HISTORY_CAP = 500;

export type ExportPayload = {
  version: number;
  exportedAt: string;
  members: Member[];
  teams: Team[];
  leaderHistory: LeaderRun[];
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadTeams(): Team[] {
  return readJson<Team[]>(TEAMS_KEY, []);
}

export function saveTeams(teams: Team[]): void {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

export function loadMembers(): Member[] {
  return readJson<Member[]>(MEMBERS_KEY, []).map((member) => ({
    ...member,
    absent: typeof member.absent === 'boolean' ? member.absent : false,
  }));
}

export function saveMembers(members: Member[]): void {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function loadLeaderHistory(): LeaderRun[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return parseLeaderHistoryList(JSON.parse(raw) as unknown, false);
  } catch {
    return [];
  }
}

export function saveLeaderHistory(history: LeaderRun[]): void {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(-LEADER_HISTORY_CAP)),
  );
}

export function upsertLeaderRun(
  history: LeaderRun[],
  run: LeaderRun,
): LeaderRun[] {
  const idx = history.findIndex((item) => item.id === run.id);
  if (idx >= 0) {
    const next = [...history];
    next[idx] = run;
    return next;
  }
  const next = [...history, run];
  return next.length > LEADER_HISTORY_CAP
    ? next.slice(-LEADER_HISTORY_CAP)
    : next;
}

export function createId(): string {
  return crypto.randomUUID();
}

export function buildExportPayload(
  members: Member[],
  teams: Team[],
  leaderHistory: LeaderRun[],
): ExportPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    members,
    teams,
    leaderHistory: leaderHistory.slice(-LEADER_HISTORY_CAP),
  };
}

function isNamedEntity(value: unknown): value is { id: string; name: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { name?: unknown }).name === 'string'
  );
}

function parseEntityList(
  value: unknown,
  label: string,
): { id: string; name: string }[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid backup: "${label}" must be an array.`);
  }
  return value.map((item, index) => {
    if (!isNamedEntity(item)) {
      throw new Error(
        `Invalid backup: "${label}[${index}]" must have string id and name.`,
      );
    }
    return { id: item.id, name: item.name };
  });
}

function parseMembersList(value: unknown): Member[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid backup: "members" must be an array.');
  }
  return value.map((item, index) => {
    if (!isNamedEntity(item)) {
      throw new Error(
        `Invalid backup: "members[${index}]" must have string id and name.`,
      );
    }
    const record = item as { id: string; name: string; absent?: unknown };
    const absent = typeof record.absent === 'boolean' ? record.absent : false;
    return { id: record.id, name: record.name, absent };
  });
}

function isLeaderRun(value: unknown): value is LeaderRun {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.at !== 'string') {
    return false;
  }
  if (
    typeof record.leaders !== 'object' ||
    record.leaders === null ||
    Array.isArray(record.leaders)
  ) {
    return false;
  }
  return Object.values(record.leaders).every((id) => typeof id === 'string');
}

function parseLeaderHistoryList(
  value: unknown,
  strict: boolean,
): LeaderRun[] {
  if (value === undefined || value === null) {
    if (strict) {
      throw new Error('Invalid backup: "leaderHistory" must be an array.');
    }
    return [];
  }
  if (!Array.isArray(value)) {
    if (strict) {
      throw new Error('Invalid backup: "leaderHistory" must be an array.');
    }
    return [];
  }

  const runs: LeaderRun[] = [];
  value.forEach((item, index) => {
    if (!isLeaderRun(item)) {
      if (strict) {
        throw new Error(
          `Invalid backup: "leaderHistory[${index}]" must have id, at, and leaders.`,
        );
      }
      return;
    }
    runs.push({
      id: item.id,
      at: item.at,
      leaders: { ...item.leaders },
    });
  });

  return runs.slice(-LEADER_HISTORY_CAP);
}

export function parseImportPayload(data: unknown): {
  members: Member[];
  teams: Team[];
  leaderHistory: LeaderRun[];
} {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Invalid backup: expected a JSON object.');
  }

  const record = data as Record<string, unknown>;

  if (record.version !== 1 && record.version !== EXPORT_VERSION) {
    throw new Error(
      `Invalid backup: unsupported version (expected 1 or ${EXPORT_VERSION}).`,
    );
  }

  const leaderHistory =
    record.version === 1
      ? []
      : parseLeaderHistoryList(
          record.leaderHistory,
          record.leaderHistory !== undefined,
        );

  return {
    members: parseMembersList(record.members),
    teams: parseEntityList(record.teams, 'teams'),
    leaderHistory,
  };
}
