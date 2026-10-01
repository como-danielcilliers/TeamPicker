import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { buildExportPayload, parseImportPayload } from '../lib/storage';
import { plural } from '../lib/format';
import { useToast } from '../lib/toast';
import type { LeaderRun, Member, Team } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';

type ImportData = {
  members: Member[];
  teams: Team[];
  leaderHistory: LeaderRun[];
};

type DataTransferProps = ImportData & {
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
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState<ImportData | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  function handleExport() {
    setMenuOpen(false);
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
    toast({ message: 'Backup downloaded', tone: 'success' });
  }

  function handleImportClick() {
    setMenuOpen(false);
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error('Invalid backup: file is not valid JSON.');
      }
      setPending(parseImportPayload(parsed));
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : 'Import failed.',
        tone: 'error',
        durationMs: 6000,
      });
    }
  }

  function confirmImport() {
    if (!pending) return;
    onImport(pending.members, pending.teams, pending.leaderHistory);
    toast({
      message: `Imported ${plural(pending.members.length, 'member')}, ${plural(
        pending.teams.length,
        'team',
      )}`,
      tone: 'success',
    });
    setPending(null);
  }

  return (
    <div className="menu" ref={menuRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label="Import or export data"
        title="Import / Export"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Icon name="more" />
      </button>
      {menuOpen && (
        <div className="menu-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={handleExport}
          >
            <Icon name="download" />
            Export backup
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={handleImportClick}
          >
            <Icon name="upload" />
            Import backup
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        onChange={handleFileChange}
        aria-label="Import backup file"
      />
      <ConfirmDialog
        open={pending !== null}
        title="Replace all data?"
        message={
          pending
            ? `This replaces your members, teams, and leader history with ${plural(
                pending.members.length,
                'member',
              )} and ${plural(pending.teams.length, 'team')} from the file.`
            : ''
        }
        confirmLabel="Replace data"
        danger
        onConfirm={confirmImport}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
