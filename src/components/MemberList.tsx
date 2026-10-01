import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LeaderStats, Member } from '../types';
import { initials, MEMBER_INPUT_ID } from '../lib/format';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';

type MemberListProps = {
  members: Member[];
  leaderStats: LeaderStats;
  hasLeaderHistory: boolean;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onToggleAbsent: (id: string) => void;
  onResetLeaderHistory: () => void;
};

export function MemberList({
  members,
  leaderStats,
  hasLeaderHistory,
  onAdd,
  onRemove,
  onToggleAbsent,
  onResetLeaderHistory,
}: MemberListProps) {
  const [name, setName] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

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
                <span className="avatar" aria-hidden="true">
                  {initials(member.name)}
                </span>
                <span className="entity-name">{member.name}</span>
                {ledCount > 0 && (
                  <span
                    className="led-badge"
                    title={`Has led ${ledCount} time${ledCount === 1 ? '' : 's'}`}
                  >
                    <Icon name="crown" size={11} />
                    {ledCount}
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
