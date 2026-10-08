import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { useFlip } from '../lib/flip';
import {
  focusById,
  hueOf,
  initials,
  MEMBER_INPUT_ID,
  plural,
  TEAM_INPUT_ID,
} from '../lib/format';
import type { Assignment, Team } from '../types';
import { Icon } from './Icon';

type AssignmentBoardProps = {
  teams: Team[];
  assignment: Assignment | null;
  leaders: Record<string, string>;
  memberCount: number;
  drawKey: number;
  onAssign: () => void;
  onClear: () => void;
  onMove: (memberId: string, toTeamId: string, swapWithId: string | null) => void;
  /** Present only when a team repo is connected. */
  commit?: {
    state: 'idle' | 'busy' | 'done';
    disabled: boolean;
    onCommit: () => void;
  } | null;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

function teamOf(assignment: Assignment, memberId: string): string | null {
  for (const [teamId, roster] of Object.entries(assignment)) {
    if (roster.some((m) => m.id === memberId)) return teamId;
  }
  return null;
}

/** 100 when sizes are equal or differ by one; drops as the spread grows. */
function balanceOf(sizes: number[]): { score: number; label: string } {
  if (sizes.length === 0 || sizes.every((s) => s === 0)) {
    return { score: 0, label: '—' };
  }
  const spread = Math.max(...sizes) - Math.min(...sizes);
  if (spread <= 1) return { score: 100, label: 'Even' };
  return { score: Math.max(8, 100 - (spread - 1) * 30), label: `±${spread}` };
}

export function AssignmentBoard({
  teams,
  assignment,
  leaders,
  memberCount,
  drawKey,
  onAssign,
  onClear,
  onMove,
  commit = null,
}: AssignmentBoardProps) {
  const canAssign = teams.length > 0 && memberCount > 0;
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTeamId, setDropTeamId] = useState<string | null>(null);

  useFlip(gridRef, assignment, drawKey);

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

  const sizes = assignment ? teams.map((t) => assignment[t.id]?.length ?? 0) : [];
  const balance = balanceOf(sizes);

  function endDrag() {
    setDragId(null);
    setDropTeamId(null);
  }

  function handleDrop(event: DragEvent, teamId: string, overMemberId: string | null) {
    event.preventDefault();
    event.stopPropagation();
    const memberId = dragId ?? event.dataTransfer.getData('text/plain');
    endDrag();
    if (!memberId || !assignment) return;
    const fromTeamId = teamOf(assignment, memberId);
    if (!fromTeamId || fromTeamId === teamId) return;
    const swapWith =
      overMemberId && overMemberId !== leaders[teamId] ? overMemberId : null;
    onMove(memberId, teamId, swapWith);
  }

  return (
    <section className="board" aria-labelledby="board-heading">
      <header className="board-bar">
        <div className="board-bar-text">
          <h2 id="board-heading" className="board-title">
            {assignment ? 'Lineup' : 'Assignment'}
          </h2>
          <p className="board-summary">
            {plural(memberCount, 'member')} into {plural(teams.length, 'team')}
          </p>
        </div>
        <div className="board-actions">
          {assignment && (
            <div className="balance" title="How evenly sized the teams are">
              <span className="balance-label">Balance</span>
              <span className="balance-meter" aria-hidden="true">
                <span style={{ width: `${balance.score}%` }} />
              </span>
              <span className="balance-value">{balance.label}</span>
            </div>
          )}
          {assignment && (
            <button type="button" className="btn btn-ghost" onClick={onClear}>
              Clear
            </button>
          )}
          {assignment && commit && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={commit.onCommit}
              disabled={commit.disabled || commit.state !== 'idle'}
              title={
                commit.state === 'done'
                  ? 'This draw is saved to the team repo'
                  : 'Save this draw and the leader history to the team repo'
              }
            >
              <Icon name={commit.state === 'done' ? 'check' : 'commit'} />
              {commit.state === 'busy'
                ? 'Committing…'
                : commit.state === 'done'
                  ? 'Committed'
                  : 'Commit'}
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
            {assignment ? 'Reshuffle' : 'Draw teams'}
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
          <h3>Ready to draw</h3>
          <p>
            Press <kbd className="kbd">R</kbd> and watch everyone fly to their
            team.
          </p>
        </div>
      )}

      {assignment && (
        <>
          <div className="lanes" ref={gridRef}>
            {teams.map((team) => {
              const leaderId = leaders[team.id];
              const roster = [...(assignment[team.id] ?? [])].sort(
                (a, b) => Number(b.id === leaderId) - Number(a.id === leaderId),
              );
              const isDropTarget = dropTeamId === team.id;
              return (
                <article
                  key={team.id}
                  className={isDropTarget ? 'lane is-drop' : 'lane'}
                  onDragOver={(event) => {
                    if (!dragId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    if (dropTeamId !== team.id) setDropTeamId(team.id);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                      setDropTeamId((current) => (current === team.id ? null : current));
                    }
                  }}
                  onDrop={(event) => handleDrop(event, team.id, null)}
                >
                  <header className="lane-header">
                    <h3>{team.name}</h3>
                    <span className="count">{roster.length}</span>
                  </header>
                  {roster.length === 0 ? (
                    <div className="lane-ghost">Drop someone here</div>
                  ) : (
                    <ul className="lane-slots">
                      {roster.map((member) => {
                        const isLeader = member.id === leaderId;
                        const classes = ['token'];
                        if (isLeader) classes.push('is-leader');
                        if (dragId === member.id) classes.push('is-dragging');
                        return (
                          <li
                            key={member.id}
                            data-flip-id={member.id}
                            className={classes.join(' ')}
                            style={{ '--hue': hueOf(member.name) } as CSSProperties}
                            draggable={!isLeader}
                            title={
                              isLeader
                                ? 'Team leader — stays with this team'
                                : 'Drag onto another team, or onto someone to swap'
                            }
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', member.id);
                              setDragId(member.id);
                            }}
                            onDragEnd={endDrag}
                            onDrop={(event) => handleDrop(event, team.id, member.id)}
                          >
                            <span className="token-avatar" aria-hidden="true">
                              {initials(member.name)}
                            </span>
                            <span className="token-name">{member.name}</span>
                            {isLeader ? (
                              <span className="token-crown" title="Team leader">
                                <Icon name="crown" size={14} />
                                <span className="visually-hidden">Leader</span>
                              </span>
                            ) : (
                              <span className="token-grip" aria-hidden="true">
                                <Icon name="grip" size={14} />
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
          <p className="board-tip">
            Drag a member onto another team to move them, or onto someone to
            swap. Leaders stay put.
          </p>
        </>
      )}
    </section>
  );
}
