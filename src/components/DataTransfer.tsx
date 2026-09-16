import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  buildExportPayload,
  parseImportPayload,
} from '../lib/storage';
import type { LeaderRun, Member, Team } from '../types';

type DataTransferProps = {
  members: Member[];
  teams: Team[];
  leaderHistory: LeaderRun[];
  onImport: (
    members: Member[],
    teams: Team[],
    leaderHistory: LeaderRun[],
  ) => void;
};

export function DataTransfer({
  members,
  teams,
  leaderHistory,
  onImport,
}: DataTransferProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    const payload = buildExportPayload(members, teams, leaderHistory);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'teampicker-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const confirmed = window.confirm(
      'Replace all members, teams, and leader history with this file?',
    );
    if (!confirmed) return;

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error('Invalid backup: file is not valid JSON.');
      }
      const {
        members: nextMembers,
        teams: nextTeams,
        leaderHistory: nextHistory,
      } = parseImportPayload(parsed);
      onImport(nextMembers, nextTeams, nextHistory);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
  }

  return (
    <div className="data-transfer">
      <div className="data-transfer-actions">
        <button type="button" className="btn-ghost" onClick={handleExport}>
          Export
        </button>
        <button type="button" className="btn-ghost" onClick={handleImportClick}>
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="data-transfer-input"
          onChange={handleFileChange}
          aria-label="Import backup file"
        />
      </div>
      {error ? <p className="data-transfer-error">{error}</p> : null}
    </div>
  );
}
