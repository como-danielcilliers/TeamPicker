const API: string = import.meta.env?.VITE_GITHUB_API ?? 'https://api.github.com';

/** Single file in the repo root that holds the team's backup. */
export const DATA_PATH = 'teampicker.json';

export type RepoRef = { owner: string; repo: string };

export type RepoInfo = {
  fullName: string;
  isPrivate: boolean;
  canPush: boolean;
};

export type DataFile = { sha: string; text: string };

export class GitHubError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

/** Raised when the file on GitHub changed since we last read it. */
export class GitHubConflictError extends GitHubError {
  constructor() {
    super('The team repo changed since you last pulled.', 409);
    this.name = 'GitHubConflictError';
  }
}

/** Accepts `owner/repo`, `github.com/owner/repo`, or a full https / .git URL. */
export function parseRepoInput(input: string): RepoRef | null {
  const cleaned = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  const match = cleaned.match(/^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export function repoLabel(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

export function dataFileUrl(ref: RepoRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}/blob/HEAD/${DATA_PATH}`;
}

function messageFor(status: number, fallback: string): string {
  switch (status) {
    case 401:
      return 'GitHub rejected the token. It may be expired or mistyped.';
    case 403:
      return 'The token is not allowed to do this. It needs Contents: Read and write on this repo (or you hit a rate limit).';
    case 404:
      return 'Repo not found, or the token cannot access it.';
    default:
      return fallback;
  }
}

async function request(
  token: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    return await fetch(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // GitHub sends max-age=60 on reads; a stale read would hide a teammate's commit.
      cache: 'no-store',
    });
  } catch {
    throw new GitHubError('Could not reach GitHub. Check your connection.', 0);
  }
}

async function fail(res: Response, fallback: string): Promise<never> {
  let detail = '';
  try {
    detail = ((await res.json()) as { message?: string }).message ?? '';
  } catch {
    // Body is optional; the status code is enough.
  }
  throw new GitHubError(messageFor(res.status, detail || fallback), res.status);
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(encoded: string): string {
  const binary = atob(encoded.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function contentsPath(ref: RepoRef): string {
  return `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}/contents/${DATA_PATH}`;
}

export async function checkRepo(token: string, ref: RepoRef): Promise<RepoInfo> {
  const res = await request(
    token,
    `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`,
  );
  if (!res.ok) await fail(res, 'Could not open the repo.');
  const data = (await res.json()) as {
    full_name: string;
    private: boolean;
    permissions?: { push?: boolean };
  };
  return {
    fullName: data.full_name,
    isPrivate: data.private,
    canPush: data.permissions?.push ?? false,
  };
}

/** Returns null when the repo has no TeamPicker file yet (including empty repos). */
export async function readDataFile(
  token: string,
  ref: RepoRef,
): Promise<DataFile | null> {
  const res = await request(token, contentsPath(ref));
  if (res.status === 404) return null;
  if (!res.ok) await fail(res, 'Could not read the team data from GitHub.');
  const data = (await res.json()) as { sha: string; content?: string; encoding?: string };
  if (data.encoding !== 'base64' || typeof data.content !== 'string') {
    throw new GitHubError(`${DATA_PATH} is too large to read through the GitHub API.`, 0);
  }
  return { sha: data.sha, text: decodeBase64(data.content) };
}

/**
 * Create or update the data file. `sha` must be the blob we last read
 * (null when creating); GitHub refuses the write if someone committed since.
 */
export async function writeDataFile(
  token: string,
  ref: RepoRef,
  text: string,
  sha: string | null,
  message: string,
): Promise<string> {
  const res = await request(token, contentsPath(ref), {
    method: 'PUT',
    body: {
      message,
      content: encodeBase64(text),
      ...(sha ? { sha } : {}),
    },
  });
  // 409: sha is stale. 422: file exists but we sent no sha.
  if (res.status === 409 || res.status === 422) throw new GitHubConflictError();
  if (!res.ok) await fail(res, 'Could not commit to GitHub.');
  const data = (await res.json()) as { content: { sha: string } };
  return data.content.sha;
}
