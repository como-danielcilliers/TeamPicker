import { useEffect, useMemo, useState } from 'react';
import { AssignmentBoard } from './components/AssignmentBoard';
import { DataTransfer } from './components/DataTransfer';
import { Icon } from './components/Icon';
import { MemberList } from './components/MemberList';
import { RepoSync } from './components/RepoSync';
import { TeamList } from './components/TeamList';
import { assignEqually, buildLeaderStats } from './lib/assign';
import { plural } from './lib/format';
import {
  createId,
  loadLeaderHistory,
  loadMembers,
  loadTeams,
  saveLeaderHistory,
  saveMembers,
  saveTeams,
  upsertLeaderRun,
} from './lib/storage';
import { applyTheme, loadTheme } from './lib/theme';
import type { Theme } from './lib/theme';
import { summarizeDraw } from './lib/sync';
import { useToast } from './lib/toast';
import { useRepoSync } from './lib/useRepoSync';
import type { SharedData } from './lib/useRepoSync';
import type { AssignmentResult, LeaderRun, Member, Team } from './types';
import './styles.css';

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = [...list];
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}

/**
 * Move a member to another team for this session only, optionally swapping
 * with someone already there. Leaders are never moved, so the persisted
 * leader history stays accurate.
 */
function moveMember(
  result: AssignmentResult,
  memberId: string,
  toTeamId: string,
  swapWithId: string | null,
): AssignmentResult {
  const teams = Object.fromEntries(
    Object.entries(result.teams).map(([id, roster]) => [id, [...roster]]),
  );
  const fromTeamId = Object.keys(teams).find((id) =>
    teams[id].some((m) => m.id === memberId),
  );
  if (!fromTeamId || fromTeamId === toTeamId || !teams[toTeamId]) return result;
  if (Object.values(result.leaders).includes(memberId)) return result;

  const fromRoster = teams[fromTeamId];
  const toRoster = teams[toTeamId];
  const moving = fromRoster.splice(
    fromRoster.findIndex((m) => m.id === memberId),
    1,
  )[0];

  const swapIndex = swapWithId ? toRoster.findIndex((m) => m.id === swapWithId) : -1;
  if (swapIndex >= 0 && result.leaders[toTeamId] !== swapWithId) {
    const [swapped] = toRoster.splice(swapIndex, 1, moving);
    fromRoster.push(swapped);
  } else {
    toRoster.push(moving);
  }

  return { ...result, teams };
}

export default function App() {
  const [members, setMembers] = useState<Member[]>(() => loadMembers());
  const [teams, setTeams] = useState<Team[]>(() => loadTeams());
  const [leaderHistory, setLeaderHistory] = useState<LeaderRun[]>(() =>
    loadLeaderHistory(),
  );
  const [assignment, setAssignment] = useState<AssignmentResult | null>(null);
  const [drawKey, setDrawKey] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const toast = useToast();

  useEffect(() => {
    saveMembers(members);
  }, [members]);

  useEffect(() => {
    saveTeams(teams);
  }, [teams]);

  useEffect(() => {
    saveLeaderHistory(leaderHistory);
  }, [leaderHistory]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const leaderStats = useMemo(
    () => buildLeaderStats(leaderHistory, members.map((member) => member.id)),
    [leaderHistory, members],
  );

  const draw = useMemo(() => {
    if (!assignment) return null;
    const at =
      leaderHistory.find((run) => run.id === assignment.runId)?.at ??
      new Date().toISOString();
    return summarizeDraw(assignment, teams, at);
  }, [assignment, teams, leaderHistory]);

  const sync = useRepoSync({
    data: { members, teams, leaderHistory },
    draw,
    onApply: applySharedData,
  });

  function applySharedData(data: SharedData) {
    setMembers(data.members);
    setTeams(data.teams);
    setLeaderHistory(data.leaderHistory);
    setAssignment(null);
  }

  function addMember(name: string) {
    setMembers((prev) => [...prev, { id: createId(), name, absent: false }]);
  }

  function removeMember(id: string) {
    const index = members.findIndex((m) => m.id === id);
    const removed = members[index];
    if (!removed) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setAssignment(null);
    toast({
      message: `Removed ${removed.name}`,
      action: {
        label: 'Undo',
        onClick: () =>
          setMembers((prev) =>
            prev.some((m) => m.id === removed.id)
              ? prev
              : insertAt(prev, index, removed),
          ),
      },
    });
  }

  function toggleAbsent(id: string) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, absent: !m.absent } : m)),
    );
    setAssignment(null);
  }

  function addTeam(name: string) {
    setTeams((prev) => [...prev, { id: createId(), name }]);
  }

  function renameTeam(id: string, name: string) {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }

  function removeTeam(id: string) {
    const index = teams.findIndex((t) => t.id === id);
    const removed = teams[index];
    if (!removed) return;
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setAssignment(null);
    toast({
      message: `Deleted ${removed.name}`,
      action: {
        label: 'Undo',
        onClick: () =>
          setTeams((prev) =>
            prev.some((t) => t.id === removed.id)
              ? prev
              : insertAt(prev, index, removed),
          ),
      },
    });
  }

  function handleAssign() {
    const historyForStats = assignment
      ? leaderHistory.filter((run) => run.id !== assignment.runId)
      : leaderHistory;
    const stats = buildLeaderStats(
      historyForStats,
      members.map((member) => member.id),
    );
    const runId = assignment?.runId ?? createId();
    const result = assignEqually(members, teams, stats, runId);
    const run: LeaderRun = {
      id: runId,
      at: new Date().toISOString(),
      leaders: result.leaders,
    };
    setAssignment(result);
    setDrawKey((key) => key + 1);
    setLeaderHistory((prev) => upsertLeaderRun(prev, run));
  }

  function handleMove(memberId: string, toTeamId: string, swapWithId: string | null) {
    setAssignment((current) =>
      current ? moveMember(current, memberId, toTeamId, swapWithId) : current,
    );
  }

  const presentCount = members.filter((m) => !m.absent).length;
  const awayCount = members.length - presentCount;

  function handleClear() {
    setAssignment(null);
  }

  function resetLeaderHistory() {
    setLeaderHistory([]);
    setAssignment(null);
    toast({ message: 'Leader history reset', tone: 'success' });
  }

  function handleImport(
    nextMembers: Member[],
    nextTeams: Team[],
    nextHistory: LeaderRun[],
  ) {
    setMembers(nextMembers);
    setTeams(nextTeams);
    setLeaderHistory(nextHistory);
    setAssignment(null);
  }

  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="users" size={16} />
          </span>
          <h1 className="brand-name">TeamPicker</h1>
        </div>

        <p className="topbar-stats" aria-label="Session summary">
          <span>{presentCount} present</span>
          {awayCount > 0 && <span>{awayCount} away</span>}
          <span>{plural(teams.length, 'team')}</span>
        </p>

        <div className="topbar-actions">
          <RepoSync sync={sync} />
          <DataTransfer
            members={members}
            teams={teams}
            leaderHistory={leaderHistory}
            onImport={handleImport}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme(nextTheme)}
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar" aria-label="Members and teams">
          <MemberList
            members={members}
            leaderStats={leaderStats}
            leaderHistory={leaderHistory}
            hasLeaderHistory={leaderHistory.length > 0}
            onAdd={addMember}
            onRemove={removeMember}
            onToggleAbsent={toggleAbsent}
            onResetLeaderHistory={resetLeaderHistory}
          />
          <TeamList
            teams={teams}
            onAdd={addTeam}
            onRename={renameTeam}
            onRemove={removeTeam}
          />
        </aside>

        <AssignmentBoard
          teams={teams}
          assignment={assignment?.teams ?? null}
          leaders={assignment?.leaders ?? {}}
          memberCount={presentCount}
          drawKey={drawKey}
          onAssign={handleAssign}
          onClear={handleClear}
          onMove={handleMove}
          commit={
            sync.config
              ? {
                  state:
                    sync.busy === 'commit'
                      ? 'busy'
                      : sync.drawCommitted
                        ? 'done'
                        : 'idle',
                  disabled: sync.busy !== null && sync.busy !== 'commit',
                  onCommit: () => void sync.commit(),
                }
              : null
          }
        />
      </main>
    </div>
  );
}
