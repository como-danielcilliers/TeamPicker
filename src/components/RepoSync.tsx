import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { dataFileUrl, DATA_PATH, repoLabel } from '../lib/github';
import { formatWhen } from '../lib/format';
import { repoFromUrl } from '../lib/sync';
import type { RepoSync as RepoSyncState } from '../lib/useRepoSync';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';

const TOKEN_HELP_URL = 'https://github.com/settings/personal-access-tokens/new';

export function RepoSync({ sync }: { sync: RepoSyncState }) {
  const [open, setOpen] = useState(() => !sync.config && repoFromUrl() !== null);
  const { config, busy, dirty } = sync;

  const status = !config
    ? null
    : busy === 'pull' || busy === 'connect'
      ? 'Pulling…'
      : busy === 'commit'
        ? 'Committing…'
        : dirty
          ? 'Uncommitted changes'
          : 'Up to date';

  return (
    <>
      <button
        type="button"
        className={config ? 'sync-chip' : 'btn btn-ghost btn-sm'}
        data-state={config ? (busy ? 'busy' : dirty ? 'dirty' : 'clean') : undefined}
        onClick={() => setOpen(true)}
        title={config ? `${repoLabel(config)} · ${status}` : 'Share data through a GitHub repo'}
      >
        {config ? (
          <>
            <span className="sync-dot" aria-hidden="true" />
            <span className="sync-chip-label">{repoLabel(config)}</span>
            <span className="visually-hidden">{status}</span>
          </>
        ) : (
          <>
            <Icon name="cloud" />
            <span className="sync-chip-label">Team repo</span>
          </>
        )}
      </button>

      <RepoDialog open={open} sync={sync} status={status} onClose={() => setOpen(false)} />

      <SyncPromptDialog sync={sync} />
    </>
  );
}

function RepoDialog({
  open,
  sync,
  status,
  onClose,
}: {
  open: boolean;
  sync: RepoSyncState;
  status: string | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // A conflict prompt is its own modal; get out of its way.
  useEffect(() => {
    if (sync.prompt) onClose();
  }, [sync.prompt, onClose]);

  return (
    <dialog
      ref={ref}
      className="dialog dialog--wide"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {sync.config ? (
        <ConnectedPanel titleId={titleId} sync={sync} status={status} onClose={onClose} />
      ) : (
        <ConnectForm titleId={titleId} sync={sync} open={open} onClose={onClose} />
      )}
    </dialog>
  );
}

function ConnectForm({
  titleId,
  sync,
  open,
  onClose,
}: {
  titleId: string;
  sync: RepoSyncState;
  open: boolean;
  onClose: () => void;
}) {
  const [repo, setRepo] = useState(() => repoFromUrl() ?? '');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const repoId = useId();
  const tokenId = useId();
  const connecting = sync.busy === 'connect';

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const message = await sync.connect(repo, token);
    if (message) {
      setError(message);
      return;
    }
    setToken('');
    onClose();
  }

  return (
    <form className="dialog-body" onSubmit={handleSubmit}>
      <h2 id={titleId} className="dialog-title">
        Connect a team repo
      </h2>
      <p className="dialog-message">
        Keep members, teams and leader history in a private GitHub repo so whoever draws
        next has the full history. Without a repo, everything stays in this browser.
      </p>

      <div className="field">
        <label htmlFor={repoId} className="field-label">
          Repository
        </label>
        <input
          id={repoId}
          className="field-input"
          placeholder="owner/repo"
          value={repo}
          onChange={(event) => setRepo(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
          autoFocus
        />
        <p className="field-help">
          Same for everyone on the team. Data is saved as <code>{DATA_PATH}</code> on the
          default branch.
        </p>
      </div>

      <div className="field">
        <label htmlFor={tokenId} className="field-label">
          Access token
        </label>
        <input
          id={tokenId}
          className="field-input"
          type="password"
          placeholder="github_pat_…"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          required
        />
        <p className="field-help">
          Your own{' '}
          <a href={TOKEN_HELP_URL} target="_blank" rel="noreferrer">
            fine-grained token
          </a>{' '}
          with access to only this repo and <strong>Contents: Read and write</strong>. It
          is stored only in this browser.
        </p>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={connecting}>
          <Icon name="link" />
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </form>
  );
}

function ConnectedPanel({
  titleId,
  sync,
  status,
  onClose,
}: {
  titleId: string;
  sync: RepoSyncState;
  status: string | null;
  onClose: () => void;
}) {
  const config = sync.config;
  if (!config) return null;
  const canCommit = sync.dirty || (sync.hasDraw && !sync.drawCommitted);

  return (
    <div className="dialog-body">
      <div className="dialog-header">
        <h2 id={titleId} className="dialog-title">
          Team repo
        </h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
      <p className="dialog-message">
        <a href={dataFileUrl(config)} target="_blank" rel="noreferrer" className="repo-link">
          {repoLabel(config)}
        </a>
        <span className="sync-status" data-state={sync.dirty ? 'dirty' : 'clean'}>
          <span className="sync-dot" aria-hidden="true" />
          {status}
        </span>
      </p>

      <dl className="sync-facts">
        <dt>Last draw in repo</dt>
        <dd>{config.lastDraw ? formatWhen(config.lastDraw.at) : 'none yet'}</dd>
        <dt>Last pulled</dt>
        <dd>{formatWhen(config.pulledAt)}</dd>
        <dt>Last committed from here</dt>
        <dd>{formatWhen(config.committedAt)}</dd>
      </dl>

      <div className="dialog-actions dialog-actions--split">
        <button
          type="button"
          className="btn btn-ghost btn-danger-text"
          onClick={() => {
            sync.disconnect();
            onClose();
          }}
        >
          Disconnect
        </button>
        <div className="dialog-actions-group">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void sync.pull()}
            disabled={sync.busy !== null}
          >
            <Icon name="cloudDown" />
            Pull
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void sync.commit()}
            disabled={sync.busy !== null || !canCommit}
          >
            <Icon name="cloudUp" />
            Commit
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncPromptDialog({ sync }: { sync: RepoSyncState }) {
  const prompt = sync.prompt;
  const label = sync.config ? repoLabel(sync.config) : 'the repo';

  if (prompt?.reason === 'commit') {
    return (
      <ConfirmDialog
        open
        title="Someone committed first"
        message={`${label} changed since you last pulled${
          prompt.remote.lastDraw ? ` (it has a draw from ${formatWhen(prompt.remote.lastDraw.at)})` : ''
        }. Overwrite it with your data, or switch to the team's version and discard your local changes?`}
        cancelLabel="Cancel"
        secondary={{ label: 'Use team data', onClick: () => sync.resolvePrompt('remote') }}
        confirmLabel="Overwrite repo"
        danger
        onConfirm={() => sync.resolvePrompt('overwrite')}
        onCancel={() => sync.resolvePrompt('keep')}
      />
    );
  }

  return (
    <ConfirmDialog
      open={prompt !== null}
      title={prompt?.reason === 'connect' ? 'This repo already has team data' : 'Replace your local changes?'}
      message={
        prompt?.reason === 'connect'
          ? `${label} has its own members, teams and leader history. Use them, or keep what is in this browser? If you keep yours, your next commit will ask before overwriting the repo.`
          : `${label} has different data from this browser, and you have changes that were never committed. Using the team data replaces your local members, teams and leader history.`
      }
      cancelLabel="Keep mine"
      confirmLabel="Use team data"
      danger={prompt?.reason === 'pull'}
      onConfirm={() => sync.resolvePrompt('remote')}
      onCancel={() => sync.resolvePrompt('keep')}
    />
  );
}
