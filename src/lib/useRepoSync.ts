import { useEffect, useRef, useState } from 'react';
import {
  DATA_PATH,
  GitHubConflictError,
  checkRepo,
  parseRepoInput,
  readDataFile,
  repoLabel,
  writeDataFile,
} from './github';
import type { DataFile } from './github';
import { buildExportPayload, parseImportPayload } from './storage';
import {
  commitMessageFor,
  loadSyncConfig,
  sameDraw,
  saveSyncConfig,
  snapshotOf,
} from './sync';
import type { SyncConfig } from './sync';
import { useToast } from './toast';
import type { DrawSummary, LeaderRun, Member, Team } from '../types';

export type SharedData = {
  members: Member[];
  teams: Team[];
  leaderHistory: LeaderRun[];
};

type Remote = {
  sha: string;
  data: SharedData;
  lastDraw: DrawSummary | null;
  snapshot: string;
};

export type SyncPrompt = {
  /** connect/pull: local edits would be lost. commit: someone committed first. */
  reason: 'connect' | 'pull' | 'commit';
  remote: Remote;
};

export type SyncBusy = 'connect' | 'pull' | 'commit' | null;

const STALE_PULL_MS = 60 * 60 * 1000;

function toRemote(file: DataFile): Remote {
  let parsed: unknown;
  try {
    parsed = JSON.parse(file.text) as unknown;
  } catch {
    throw new Error(`${DATA_PATH} in the repo is not valid JSON.`);
  }
  const payload = parseImportPayload(parsed);
  const data = {
    members: payload.members,
    teams: payload.teams,
    leaderHistory: payload.leaderHistory,
  };
  return {
    sha: file.sha,
    data,
    lastDraw: payload.lastDraw,
    snapshot: snapshotOf(data.members, data.teams, data.leaderHistory),
  };
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * Optional GitHub-backed sync. Local storage stays the source of truth; the
 * repo is only read on load / "Pull" and written on "Commit".
 */
export function useRepoSync({
  data,
  draw,
  onApply,
}: {
  data: SharedData;
  /** Current on-screen draw, or null when nothing is drawn. */
  draw: DrawSummary | null;
  onApply: (data: SharedData) => void;
}) {
  const toast = useToast();
  const [config, setConfig] = useState<SyncConfig | null>(() => loadSyncConfig());
  const [busy, setBusyState] = useState<SyncBusy>(null);
  const [prompt, setPrompt] = useState<SyncPrompt | null>(null);

  // Async work reads these after awaits, so it must see the latest values.
  const configRef = useRef(config);
  const busyRef = useRef<SyncBusy>(null);
  const dataRef = useRef(data);
  const drawRef = useRef(draw);
  const onApplyRef = useRef(onApply);
  const dismissedShaRef = useRef<string | null>(null);
  dataRef.current = data;
  drawRef.current = draw;
  onApplyRef.current = onApply;

  const localSnapshot = snapshotOf(data.members, data.teams, data.leaderHistory);
  const dirty = config !== null && config.syncedSnapshot !== localSnapshot;
  const drawCommitted =
    config !== null && draw !== null && !dirty && sameDraw(draw, config.lastDraw);

  function updateConfig(next: SyncConfig | null) {
    configRef.current = next;
    setConfig(next);
    saveSyncConfig(next);
  }

  function setBusy(next: SyncBusy) {
    busyRef.current = next;
    setBusyState(next);
  }

  function applyRemote(cfg: SyncConfig, remote: Remote) {
    onApplyRef.current(remote.data);
    updateConfig({
      ...cfg,
      sha: remote.sha,
      syncedSnapshot: remote.snapshot,
      lastDraw: remote.lastDraw,
      pulledAt: new Date().toISOString(),
    });
  }

  function reconcile(
    cfg: SyncConfig,
    remote: Remote | null,
    reason: 'connect' | 'pull',
    silent: boolean,
  ) {
    const now = new Date().toISOString();
    const label = repoLabel(cfg);
    if (!remote) {
      updateConfig({ ...cfg, sha: null, pulledAt: now });
      if (!silent) {
        toast({
          message: `${label} has no team data yet. Commit to share yours.`,
          durationMs: 6000,
        });
      }
      return;
    }

    const { members, teams, leaderHistory } = dataRef.current;
    const local = snapshotOf(members, teams, leaderHistory);
    if (remote.snapshot === local) {
      updateConfig({
        ...cfg,
        sha: remote.sha,
        syncedSnapshot: remote.snapshot,
        lastDraw: remote.lastDraw,
        pulledAt: now,
      });
      if (!silent) toast({ message: `Up to date with ${label}`, tone: 'success' });
      return;
    }

    const localEmpty =
      members.length === 0 && teams.length === 0 && leaderHistory.length === 0;
    const localDirty =
      cfg.syncedSnapshot === null ? !localEmpty : local !== cfg.syncedSnapshot;

    if (!localDirty) {
      applyRemote(cfg, remote);
      toast({ message: `Pulled latest team data from ${label}`, tone: 'success' });
      return;
    }

    // Repo unchanged since we last synced; the only differences are ours.
    if (silent && remote.sha === cfg.sha) {
      updateConfig({ ...cfg, pulledAt: now });
      return;
    }

    // Background checks must not re-ask about a version the user already declined.
    if (silent && remote.sha === dismissedShaRef.current) {
      updateConfig({ ...cfg, pulledAt: now });
      return;
    }

    setPrompt({ reason, remote });
  }

  async function pull(silent = false) {
    const cfg = configRef.current;
    if (!cfg || busyRef.current) return;
    setBusy('pull');
    try {
      const file = await readDataFile(cfg.token, cfg);
      reconcile(cfg, file ? toRemote(file) : null, 'pull', silent);
    } catch (err) {
      toast({
        message: `Pull failed: ${errorText(err, 'unknown error')}`,
        tone: 'error',
        durationMs: 7000,
      });
    } finally {
      setBusy(null);
    }
  }

  async function connect(repoInput: string, token: string): Promise<string | null> {
    const ref = parseRepoInput(repoInput);
    if (!ref) return 'Enter the repo as owner/name, e.g. my-org/team-data.';
    const trimmedToken = token.trim();
    if (!trimmedToken) return 'Paste a GitHub access token for this repo.';
    if (busyRef.current) return null;

    setBusy('connect');
    try {
      const info = await checkRepo(trimmedToken, ref);
      if (!info.canPush) {
        return 'This token can read the repo but not commit to it. Give it Contents: Read and write.';
      }
      const file = await readDataFile(trimmedToken, ref);
      const remote = file ? toRemote(file) : null;
      const [owner, repo] = info.fullName.split('/');
      const cfg: SyncConfig = {
        owner,
        repo,
        token: trimmedToken,
        sha: null,
        syncedSnapshot: null,
        pulledAt: null,
        committedAt: null,
        lastDraw: null,
      };
      updateConfig(cfg);
      if (!info.isPrivate) {
        toast({
          message: `${info.fullName} is public. Anyone can see your team's names.`,
          tone: 'error',
          durationMs: 7000,
        });
      }
      reconcile(cfg, remote, 'connect', false);
      return null;
    } catch (err) {
      return errorText(err, 'Could not connect to GitHub.');
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    const cfg = configRef.current;
    if (!cfg || busyRef.current) return;
    setBusy('commit');
    const label = repoLabel(cfg);
    try {
      const { members, teams, leaderHistory } = dataRef.current;
      const currentDraw = drawRef.current;
      const lastDraw = currentDraw ?? cfg.lastDraw;
      const isNewDraw = currentDraw !== null && !sameDraw(currentDraw, cfg.lastDraw);
      const payload = buildExportPayload(
        members,
        teams,
        leaderHistory,
        lastDraw ?? undefined,
      );
      const text = `${JSON.stringify(payload, null, 2)}\n`;
      const sha = await writeDataFile(
        cfg.token,
        cfg,
        text,
        cfg.sha,
        commitMessageFor(lastDraw, isNewDraw),
      );
      updateConfig({
        ...cfg,
        sha,
        syncedSnapshot: snapshotOf(members, teams, leaderHistory),
        committedAt: new Date().toISOString(),
        lastDraw,
      });
      toast({ message: `Committed to ${label}`, tone: 'success' });
    } catch (err) {
      if (err instanceof GitHubConflictError) {
        try {
          const file = await readDataFile(cfg.token, cfg);
          if (file) {
            setPrompt({ reason: 'commit', remote: toRemote(file) });
          } else {
            updateConfig({ ...cfg, sha: null });
            toast({ message: `${DATA_PATH} was removed from ${label}. Commit again to recreate it.` });
          }
        } catch (readErr) {
          toast({ message: errorText(readErr, 'Commit failed.'), tone: 'error', durationMs: 7000 });
        }
        return;
      }
      toast({
        message: `Commit failed: ${errorText(err, 'unknown error')}`,
        tone: 'error',
        durationMs: 7000,
      });
    } finally {
      setBusy(null);
    }
  }

  /** remote: take the team's data. overwrite: commit ours on top. keep: do nothing for now. */
  function resolvePrompt(choice: 'remote' | 'overwrite' | 'keep') {
    const current = prompt;
    const cfg = configRef.current;
    setPrompt(null);
    if (!current || !cfg) return;
    if (choice === 'remote') {
      applyRemote(cfg, current.remote);
      toast({ message: `Using team data from ${repoLabel(cfg)}`, tone: 'success' });
    } else if (choice === 'overwrite') {
      updateConfig({ ...cfg, sha: current.remote.sha });
      void commit();
    } else {
      // Keep local data. The sha stays stale on purpose so Commit still asks first.
      dismissedShaRef.current = current.remote.sha;
      updateConfig({ ...cfg, pulledAt: new Date().toISOString() });
    }
  }

  function disconnect() {
    updateConfig(null);
    setPrompt(null);
    toast({ message: 'Disconnected. Your data stays in this browser.' });
  }

  const pullRef = useRef(pull);
  pullRef.current = pull;
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (configRef.current) void pullRef.current(true);
  }, []);

  // A tab left open overnight should still pick up today's history.
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState !== 'visible') return;
      const cfg = configRef.current;
      if (!cfg) return;
      const last = cfg.pulledAt ? Date.parse(cfg.pulledAt) : 0;
      if (Date.now() - last < STALE_PULL_MS) return;
      void pullRef.current(true);
    }
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, []);

  return {
    config,
    busy,
    dirty,
    drawCommitted,
    hasDraw: draw !== null,
    prompt,
    connect,
    pull: () => pull(false),
    commit,
    disconnect,
    resolvePrompt,
  };
}

export type RepoSync = ReturnType<typeof useRepoSync>;
