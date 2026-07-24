import type { Member, Team } from '../types';

const TEAMS_KEY = 'teampicker:teams';
const MEMBERS_KEY = 'teampicker:members';
const EXPORT_VERSION = 1;

export type ExportPayload = {
  version: number;
  exportedAt: string;
  members: Member[];
  teams: Team[];
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

export function createId(): string {
  return crypto.randomUUID();
}

export function buildExportPayload(
  members: Member[],
  teams: Team[],
): ExportPayload {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    members,
    teams,
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

export function parseImportPayload(data: unknown): {
  members: Member[];
  teams: Team[];
} {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Invalid backup: expected a JSON object.');
  }

  const record = data as Record<string, unknown>;

  if (record.version !== EXPORT_VERSION) {
    throw new Error(
      `Invalid backup: unsupported version (expected ${EXPORT_VERSION}).`,
    );
  }

  return {
    members: parseMembersList(record.members),
    teams: parseEntityList(record.teams, 'teams'),
  };
}
