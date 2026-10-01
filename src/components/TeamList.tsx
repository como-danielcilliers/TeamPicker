import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TEAM_INPUT_ID } from '../lib/format';
import type { Team } from '../types';
import { Icon } from './Icon';

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
  // Esc/Enter unmount the input, which can fire a trailing blur we must ignore.
  const skipBlurCommit = useRef(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  }

  function startEdit(team: Team) {
    skipBlurCommit.current = false;
    setEditingId(team.id);
    setDraft(team.name);
  }

  function commitEdit() {
    if (!editingId || skipBlurCommit.current) return;
    skipBlurCommit.current = true;
    const trimmed = draft.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setDraft('');
  }

  function cancelEdit() {
    skipBlurCommit.current = true;
    setEditingId(null);
    setDraft('');
  }

  return (
    <section className="section" aria-labelledby="teams-heading">
      <header className="section-header">
        <h2 id="teams-heading" className="section-title">
          Teams
        </h2>
        <span className="count">{teams.length}</span>
      </header>

      <form className="add-field" onSubmit={handleSubmit}>
        <Icon name="plus" className="add-field-icon" />
        <input
          id={TEAM_INPUT_ID}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a team"
          aria-label="Team name"
          autoComplete="off"
          enterKeyHint="done"
        />
      </form>

      {teams.length === 0 ? (
        <p className="hint">Create at least one team to assign into.</p>
      ) : (
        <ul className="entity-list">
          {teams.map((team) => (
            <li key={team.id} className="entity-row">
              {editingId === team.id ? (
                <form
                  className="rename-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitEdit();
                  }}
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    aria-label={`Rename ${team.name}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                  />
                  <span className="rename-hint" aria-hidden="true">
                    Enter to save · Esc to cancel
                  </span>
                </form>
              ) : (
                <>
                  <span className="team-swatch" aria-hidden="true" />
                  <span
                    className="entity-name"
                    onDoubleClick={() => startEdit(team)}
                    title="Double-click to rename"
                  >
                    {team.name}
                  </span>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => startEdit(team)}
                      aria-label={`Rename ${team.name}`}
                      title="Rename"
                    >
                      <Icon name="pencil" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => onRemove(team.id)}
                      aria-label={`Delete ${team.name}`}
                      title="Delete"
                    >
                      <Icon name="trash" />
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
