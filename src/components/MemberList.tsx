import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type { LeaderRun, LeaderStats, Member } from '../types';
import { hueOf, initials, MEMBER_INPUT_ID } from '../lib/format';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';

const ROTATION_WINDOW = 6;

type MemberListProps = {
  members: Member[];
  leaderStats: LeaderStats;
  leaderHistory: LeaderRun[];
  hasLeaderHistory: boolean;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onToggleAbsent: (id: string) => void;
  onResetLeaderHistory: () => void;
};

export function MemberList({
  members,
  leaderStats,
  leaderHistory,
  hasLeaderHistory,
  onAdd,
  onRemove,
  onToggleAbsent,
  onResetLeaderHistory,
}: MemberListProps) {
  const [name, setName] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const recentRuns = leaderHistory.slice(-ROTATION_WINDOW);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  }

  return (
    <section className="section" aria-labelledby="members-heading">
      <header className="section-header">
        <h2 id="members-heading" className="section-title">
          Members
        </h2>
        <span className="count">{members.length}</span>
      </header>

      <form className="add-field" onSubmit={handleSubmit}>
        <Icon name="plus" className="add-field-icon" />
        <input
          id={MEMBER_INPUT_ID}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a member"
          aria-label="Member name"
          autoComplete="off"
          enterKeyHint="done"
        />
      </form>

      {members.length === 0 ? (
        <p className="hint">Type a name and press Enter.</p>
      ) : (
        <ul className="entity-list">
          {members.map((member) => {
            const ledCount = leaderStats[member.id]?.count ?? 0;
            return (
              <li
                key={member.id}
                className={member.absent ? 'entity-row is-absent' : 'entity-row'}
              >
                <span
                  className="avatar avatar--hue"
                  aria-hidden="true"
                  data-flip-source={member.id}
                  style={{ '--hue': hueOf(member.name) } as CSSProperties}
                >
                  {initials(member.name)}
                </span>
                <span className="entity-name">{member.name}</span>
                {recentRuns.length > 0 && (
                  <span
                    className="rotation"
                    title={`Led ${ledCount} time${ledCount === 1 ? '' : 's'} · last ${recentRuns.length} draws shown`}
                    aria-label={`Has led ${ledCount} time${ledCount === 1 ? '' : 's'}`}
                  >
                    {recentRuns.map((run) => (
                      <i
                        key={run.id}
                        className={
                          Object.values(run.leaders).includes(member.id)
                            ? 'is-led'
                            : undefined
                        }
                      />
                    ))}
                  </span>
                )}
                <button
                  type="button"
                  className={member.absent ? 'status-chip is-away' : 'status-chip'}
                  onClick={() => onToggleAbsent(member.id)}
                  aria-pressed={!member.absent}
                  aria-label={
                    member.absent
                      ? `${member.name} is away. Mark present`
                      : `${member.name} is present. Mark away`
                  }
                  title={member.absent ? 'Mark present' : 'Mark away'}
                >
                  <span className="status-dot" aria-hidden="true" />
                  {member.absent ? 'Away' : 'Present'}
                </button>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => onRemove(member.id)}
                    aria-label={`Remove ${member.name}`}
                    title="Remove"
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasLeaderHistory && (
        <button
          type="button"
          className="btn btn-ghost btn-sm section-footer-btn"
          onClick={() => setConfirmReset(true)}
        >
          <Icon name="rotate" size={14} />
          Reset leader history
        </button>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset leader history?"
        message="Everyone will be treated as never having led. This can't be undone."
        confirmLabel="Reset history"
        danger
        onConfirm={() => {
          setConfirmReset(false);
          onResetLeaderHistory();
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  );
}
