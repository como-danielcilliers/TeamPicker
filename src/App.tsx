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
import type { Assignment, Member, Team } from './types';
import './styles.css';

export default function App() {
  const [members, setMembers] = useState<Member[]>(() => loadMembers());
  const [teams, setTeams] = useState<Team[]>(() => loadTeams());
  const [assignment, setAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    saveMembers(members);
  }, [members]);

  useEffect(() => {
    saveTeams(teams);
  }, [teams]);

  function addMember(name: string) {
    setMembers((prev) => [...prev, { id: createId(), name }]);
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
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
    setAssignment(assignEqually(members, teams));
  }

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
          assignment={assignment}
          memberCount={members.length}
          onAssign={handleAssign}
          onClear={handleClear}
        />
      </div>
    </div>
  );
}
