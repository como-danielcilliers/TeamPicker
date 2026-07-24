import type { Assignment, Team } from '../types';

type AssignmentBoardProps = {
  teams: Team[];
  assignment: Assignment | null;
  leaders: Record<string, string>;
  memberCount: number;
  onAssign: () => void;
  onClear: () => void;
};

export function AssignmentBoard({
  teams,
  assignment,
  leaders,
  memberCount,
  onAssign,
  onClear,
}: AssignmentBoardProps) {
  const canAssign = teams.length > 0 && memberCount > 0;

  return (
    <section className="assignment" aria-labelledby="assignment-heading">
      <header className="assignment-header">
        <div>
          <h2 id="assignment-heading">Assignment</h2>
          <p className="status">
            {memberCount} member{memberCount === 1 ? '' : 's'} → {teams.length}{' '}
            team{teams.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="assignment-actions">
          <button
            type="button"
            className="btn-accent"
            onClick={onAssign}
            disabled={!canAssign}
          >
            Assign randomly
          </button>
          {assignment && (
            <button type="button" className="btn-ghost" onClick={onClear}>
              Clear assignment
            </button>
          )}
        </div>
      </header>

      {!canAssign && (
        <p className="empty">
          Add at least one member and one team to assign.
        </p>
      )}

      {assignment && (
        <div className="assignment-grid" key={Object.keys(assignment).join('-')}>
          {teams.map((team) => {
            const roster = assignment[team.id] ?? [];
            const leaderId = leaders[team.id];
            return (
              <div key={team.id} className="team-column">
                <h3>
                  {team.name}
                  <span className="count">{roster.length}</span>
                </h3>
                {roster.length === 0 ? (
                  <p className="empty subtle">Empty</p>
                ) : (
                  <ul>
                    {roster.map((member) => {
                      const isLeader = member.id === leaderId;
                      return (
                        <li
                          key={member.id}
                          className={isLeader ? 'leader' : undefined}
                        >
                          <span className="member-name">{member.name}</span>
                          {isLeader && (
                            <span className="leader-label">Leader</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canAssign && !assignment && (
        <p className="empty">Run assign to see the lineup for this session.</p>
      )}
    </section>
  );
}
