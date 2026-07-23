import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Team } from '../types';

type TeamListProps = {
  teams: Team[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
};

export function TeamList({ teams, onAdd, onRename, onRemove }: TeamListProps) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setDraft(team.name);
  }

  function commitEdit() {
    if (!editingId) return;
    const trimmed = draft.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setDraft('');
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft('');
  }

  return (
    <section className="panel" aria-labelledby="teams-heading">
      <header className="panel-header">
        <h2 id="teams-heading">Teams</h2>
        <span className="count">{teams.length}</span>
      </header>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a team"
          aria-label="Team name"
          autoComplete="off"
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {teams.length === 0 ? (
        <p className="empty">No teams yet.</p>
      ) : (
        <ul className="entity-list">
          {teams.map((team) => (
            <li key={team.id} className="entity-row">
              {editingId === team.id ? (
                <form
                  className="inline-form edit-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitEdit();
                  }}
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Rename team"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <button type="submit" disabled={!draft.trim()}>
                    Save
                  </button>
                  <button type="button" className="btn-ghost" onClick={cancelEdit}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="entity-name">{team.name}</span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => startEdit(team)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onRemove(team.id)}
                      aria-label={`Delete ${team.name}`}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
