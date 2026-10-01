import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { AssignmentBoard } from './components/AssignmentBoard';
import { DataTransfer } from './components/DataTransfer';
import { Icon } from './components/Icon';
import { MemberList } from './components/MemberList';
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
import { useToast } from './lib/toast';
import type { AssignmentResult, LeaderRun, Member, Team } from './types';
import './styles.css';

function insertAt<T>(list: T[], index: number, item: T): T[] {
  const next = [...list];
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}

function withViewTransition(update: () => void) {
  const reduceMotion = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  if (reduceMotion || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}

export default function App() {
  const [members, setMembers] = useState<Member[]>(() => loadMembers());
  const [teams, setTeams] = useState<Team[]>(() => loadTeams());
  const [leaderHistory, setLeaderHistory] = useState<LeaderRun[]>(() =>
    loadLeaderHistory(),
  );
  const [assignment, setAssignment] = useState<AssignmentResult | null>(null);
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
    withViewTransition(() => {
      setAssignment(result);
      setLeaderHistory((prev) => upsertLeaderRun(prev, run));
    });
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
          onAssign={handleAssign}
          onClear={handleClear}
        />
      </main>
    </div>
  );
}
