import { useEffect, useState } from 'react';
import { AssignmentBoard } from './components/AssignmentBoard';
import { DataTransfer } from './components/DataTransfer';
import { MemberList } from './components/MemberList';
import { TeamList } from './components/TeamList';
import { assignEqually } from './lib/assign';
import {
  createId,
  loadMembers,
  loadTeams,
  saveMembers,
  saveTeams,
} from './lib/storage';
import type { AssignmentResult, Member, Team } from './types';
import './styles.css';

export default function App() {
  const [members, setMembers] = useState<Member[]>(() => loadMembers());
  const [teams, setTeams] = useState<Team[]>(() => loadTeams());
  const [assignment, setAssignment] = useState<AssignmentResult | null>(null);

  useEffect(() => {
    saveMembers(members);
  }, [members]);

  useEffect(() => {
    saveTeams(teams);
  }, [teams]);

  function addMember(name: string) {
    setMembers((prev) => [...prev, { id: createId(), name, absent: false }]);
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    setAssignment(null);
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
    setTeams((prev) => prev.filter((t) => t.id !== id));
    setAssignment(null);
  }

  function handleAssign() {
    const available = members.filter((m) => !m.absent);
    setAssignment(assignEqually(available, teams));
  }

  const availableMemberCount = members.filter((m) => !m.absent).length;

  function handleClear() {
    setAssignment(null);
  }

  function handleImport(nextMembers: Member[], nextTeams: Team[]) {
    setMembers(nextMembers);
    setTeams(nextTeams);
    setAssignment(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1>TeamPicker</h1>
          <DataTransfer
            members={members}
            teams={teams}
            onImport={handleImport}
          />
        </div>
        <p>Build teams, then assign members evenly for this session.</p>
      </header>

      <div className="workspace">
        <div className="side-panels">
          <MemberList
            members={members}
            onAdd={addMember}
            onRemove={removeMember}
            onToggleAbsent={toggleAbsent}
          />
          <TeamList
            teams={teams}
            onAdd={addTeam}
            onRename={renameTeam}
            onRemove={removeTeam}
          />
        </div>

        <AssignmentBoard
          teams={teams}
          assignment={assignment?.teams ?? null}
          leaders={assignment?.leaders ?? {}}
          memberCount={availableMemberCount}
          onAssign={handleAssign}
          onClear={handleClear}
        />
      </div>
    </div>
  );
}
