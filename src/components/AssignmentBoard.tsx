import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { focusById, MEMBER_INPUT_ID, plural, TEAM_INPUT_ID } from '../lib/format';
import type { Assignment, Member, Team } from '../types';
import { Icon } from './Icon';

type AssignmentBoardProps = {
  teams: Team[];
  assignment: Assignment | null;
  leaders: Record<string, string>;
  memberCount: number;
  onAssign: () => void;
  onClear: () => void;
};

function transitionName(memberId: string): string {
  return `member-${memberId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export function AssignmentBoard({
  teams,
  assignment,
  leaders,
  memberCount,
  onAssign,
  onClear,
}: AssignmentBoardProps) {
  const canAssign = teams.length > 0 && memberCount > 0;

  useEffect(() => {
    if (!canAssign) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'r' && event.key !== 'R') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      onAssign();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [canAssign, onAssign]);

  return (
    <section className="board" aria-labelledby="board-heading">
      <header className="board-bar">
        <div className="board-bar-text">
          <h2 id="board-heading" className="board-title">
            Assignment
          </h2>
          <p className="board-summary">
            {plural(memberCount, 'member')} into {plural(teams.length, 'team')}
          </p>
        </div>
        <div className="board-actions">
          {assignment && (
            <button type="button" className="btn btn-ghost" onClick={onClear}>
              Clear
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAssign}
            disabled={!canAssign}
            aria-keyshortcuts="R"
          >
            <Icon name="shuffle" />
            {assignment ? 'Reshuffle' : 'Assign'}
            <kbd className="kbd" aria-hidden="true">
              R
            </kbd>
          </button>
        </div>
      </header>

      {!canAssign && (
        <div className="board-empty">
          <Icon name="users" size={28} className="board-empty-icon" />
          <h3>Set up your session</h3>
          <p>Teams are filled evenly from everyone marked present.</p>
          <ul className="checklist">
            <li className={memberCount > 0 ? 'is-done' : undefined}>
              <Icon name={memberCount > 0 ? 'check' : 'circle'} size={14} />
              <button type="button" onClick={() => focusById(MEMBER_INPUT_ID)}>
                Add members
              </button>
            </li>
            <li className={teams.length > 0 ? 'is-done' : undefined}>
              <Icon name={teams.length > 0 ? 'check' : 'circle'} size={14} />
              <button type="button" onClick={() => focusById(TEAM_INPUT_ID)}>
                Add teams
              </button>
            </li>
          </ul>
        </div>
      )}

      {canAssign && !assignment && (
        <div className="board-empty">
          <Icon name="shuffle" size={28} className="board-empty-icon" />
          <h3>Ready to assign</h3>
          <p>
            Press <kbd className="kbd">R</kbd> or click Assign to see this
            session's lineup.
          </p>
        </div>
      )}

      {assignment && (
        <div className="team-grid">
          {teams.map((team) => {
            const leaderId = leaders[team.id];
            const roster = [...(assignment[team.id] ?? [])].sort(
              (a: Member, b: Member) =>
                Number(b.id === leaderId) - Number(a.id === leaderId),
            );
            return (
              <article key={team.id} className="team-column">
                <header className="team-column-header">
                  <h3>{team.name}</h3>
                  <span className="count">{roster.length}</span>
                </header>
                {roster.length === 0 ? (
                  <p className="hint">No members</p>
                ) : (
                  <ul className="roster">
                    {roster.map((member) => {
                      const isLeader = member.id === leaderId;
                      const style = {
                        viewTransitionName: transitionName(member.id),
                      } as CSSProperties;
                      return (
                        <li
                          key={member.id}
                          className={isLeader ? 'roster-row is-leader' : 'roster-row'}
                          style={style}
                        >
                          <span className="roster-name">{member.name}</span>
                          {isLeader && (
                            <span className="leader-mark" title="Team leader">
                              <Icon name="crown" size={14} />
                              <span className="visually-hidden">Leader</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
