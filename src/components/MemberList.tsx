import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Member } from '../types';

type MemberListProps = {
  members: Member[];
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
};

export function MemberList({ members, onAdd, onRemove }: MemberListProps) {
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
            <li key={member.id} className="entity-row">
              <span className="entity-name">{member.name}</span>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => onRemove(member.id)}
                aria-label={`Remove ${member.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
