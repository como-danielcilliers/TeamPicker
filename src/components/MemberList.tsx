import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LeaderStats, Member } from '../types';

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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  }

  function handleReset() {
    const confirmed = window.confirm(
      'Reset leader history? Everyone will be treated as never having led.',
    );
    if (!confirmed) return;
    onResetLeaderHistory();
  }

  return (
    <section className="panel" aria-labelledby="members-heading">
      <header className="panel-header">
        <h2 id="members-heading">Members</h2>
        <span className="count">{members.length}</span>
      </header>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a member"
          aria-label="Member name"
          autoComplete="off"
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {members.length === 0 ? (
        <p className="empty">No members yet.</p>
      ) : (
        <ul className="entity-list">
          {members.map((member) => {
            const ledCount = leaderStats[member.id]?.count ?? 0;
            return (
              <li
                key={member.id}
                className={
                  member.absent ? 'entity-row entity-row--absent' : 'entity-row'
                }
              >
                <div className="entity-row-main">
                  <span className="entity-name">{member.name}</span>
                  <span className="led-badge">Led {ledCount}×</span>
                  {member.absent && (
                    <span className="absent-label" aria-hidden="true">
                      Away
                    </span>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onToggleAbsent(member.id)}
                    aria-label={
                      member.absent
                        ? `Mark ${member.name} present`
                        : `Mark ${member.name} absent`
                    }
                  >
                    {member.absent ? 'Mark present' : 'Mark absent'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onRemove(member.id)}
                    aria-label={`Remove ${member.name}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasLeaderHistory && (
        <div className="panel-footer">
          <button type="button" className="btn-ghost" onClick={handleReset}>
            Reset leader history
          </button>
        </div>
      )}
    </section>
  );
}
