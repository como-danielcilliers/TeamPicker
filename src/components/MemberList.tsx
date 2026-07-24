import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Member } from '../types';

type MemberListProps = {
  members: Member[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  onToggleAbsent: (id: string) => void;
};

export function MemberList({
  members,
  onAdd,
  onRemove,
  onToggleAbsent,
}: MemberListProps) {
  const [name, setName] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
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
          {members.map((member) => (
            <li
              key={member.id}
              className={
                member.absent ? 'entity-row entity-row--absent' : 'entity-row'
              }
            >
              <div className="entity-row-main">
                <span className="entity-name">{member.name}</span>
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
          ))}
        </ul>
      )}
    </section>
  );
}
