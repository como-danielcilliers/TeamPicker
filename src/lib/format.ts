export const MEMBER_INPUT_ID = 'member-input';
export const TEAM_INPUT_ID = 'team-input';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Stable hue per name so a person's token colour is recognisable everywhere. */
export function hueOf(name: string): number {
  let hue = 7;
  for (const char of name) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

export function focusById(id: string) {
  document.getElementById(id)?.focus();
}
