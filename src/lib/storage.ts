import type { Member, Team } from '../types';

const TEAMS_KEY = 'teampicker:teams';
const MEMBERS_KEY = 'teampicker:members';

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
  return readJson<Member[]>(MEMBERS_KEY, []);
}

export function saveMembers(members: Member[]): void {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}

export function createId(): string {
  return crypto.randomUUID();
}
