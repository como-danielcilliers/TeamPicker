/**
 * Integration test for the GitHub sync layer against a real repo.
 *
 *   GH_TOKEN=$(gh auth token) TEST_REPO=owner/repo npx tsx scripts/github-sync.integration.ts
 *
 * WARNING: overwrites teampicker.json in TEST_REPO. Use a throwaway repo.
 */
import {
  GitHubConflictError,
  GitHubError,
  checkRepo,
  parseRepoInput,
  readDataFile,
  writeDataFile,
} from '../src/lib/github';
import { buildExportPayload, parseImportPayload } from '../src/lib/storage';
import { commitMessageFor, sameDraw, snapshotOf, summarizeDraw } from '../src/lib/sync';
import type { AssignmentResult, LeaderRun, Member, Team } from '../src/types';

const token = process.env.GH_TOKEN ?? '';
const repoInput = process.env.TEST_REPO ?? '';
if (!token || !repoInput) {
  console.error('Set GH_TOKEN and TEST_REPO.');
  process.exit(2);
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${name}\n       ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function expectReject(promise: Promise<unknown>, check: (err: unknown) => boolean, label: string) {
  try {
    await promise;
  } catch (err) {
    assert(check(err), `${label}: wrong error ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
    return err;
  }
  throw new Error(`${label}: expected rejection`);
}

const members: Member[] = [
  { id: 'm1', name: 'Zoë Müller', absent: false },
  { id: 'm2', name: 'Søren 李', absent: false },
  { id: 'm3', name: 'Ana 🚀', absent: true },
  { id: 'm4', name: 'Bob', absent: false },
];
const teams: Team[] = [
  { id: 't1', name: 'Red' },
  { id: 't2', name: 'Blue' },
];
const history: LeaderRun[] = [
  { id: 'r1', at: '2026-10-07T07:00:00.000Z', leaders: { t1: 'm1', t2: 'm2' } },
];
const assignment: AssignmentResult = {
  runId: 'r1',
  leaders: { t1: 'm1', t2: 'm2' },
  teams: { t1: [members[0], members[3]], t2: [members[1]] },
};

const ref = parseRepoInput(repoInput)!;

console.log(`\nUnit checks`);

await test('parseRepoInput accepts common forms', () => {
  const forms = [
    'owner/repo',
    ' owner/repo ',
    'github.com/owner/repo',
    'https://github.com/owner/repo',
    'https://github.com/owner/repo/',
    'https://github.com/owner/repo.git',
    'git@github.com:owner/repo.git',
  ];
  for (const form of forms) {
    const parsed = parseRepoInput(form);
    assert(parsed?.owner === 'owner' && parsed.repo === 'repo', `failed on "${form}"`);
  }
  assert(parseRepoInput('my-org/team.data_1')?.repo === 'team.data_1', 'dots/underscores');
});

await test('parseRepoInput rejects junk', () => {
  for (const bad of ['', 'owner', 'owner/', '/repo', 'a/b/c', 'https://gitlab.com/a/b', '-bad/repo']) {
    assert(parseRepoInput(bad) === null, `accepted "${bad}"`);
  }
});

await test('snapshotOf ignores key order and leader order', () => {
  const a = snapshotOf(members, teams, history);
  const reordered = snapshotOf(
    members.map((m) => ({ absent: m.absent, name: m.name, id: m.id })),
    teams.map((t) => ({ name: t.name, id: t.id })),
    [{ leaders: { t2: 'm2', t1: 'm1' }, at: history[0].at, id: 'r1' }],
  );
  assert(a === reordered, 'snapshots differ');
  assert(a !== snapshotOf([{ ...members[0], absent: true }, ...members.slice(1)], teams, history), 'absent change not detected');
});

await test('summarizeDraw / sameDraw / commitMessageFor', () => {
  const draw = summarizeDraw(assignment, teams, '2026-10-08T08:00:00.000Z');
  assert(draw.teams[0].leader === 'Zoë Müller', 'leader name');
  assert(draw.teams[0].members.join() === 'Zoë Müller,Bob', 'members');
  assert(sameDraw(draw, { ...draw, at: 'other' }), 'at should be ignored');
  const moved = summarizeDraw(
    { ...assignment, teams: { t1: [members[0]], t2: [members[1], members[3]] } },
    teams,
    draw.at,
  );
  assert(!sameDraw(draw, moved), 'moved member not detected');
  const msg = commitMessageFor(draw, true);
  assert(msg.startsWith('Draw teams for'), msg);
  assert(msg.includes('- Red: Zoë Müller (lead), Bob'), msg);
  assert(commitMessageFor(draw, false) === 'Update TeamPicker data', 'non-draw message');
});

console.log(`\nGitHub API (${ref.owner}/${ref.repo})`);

await test('checkRepo reports private + push access', async () => {
  const info = await checkRepo(token, ref);
  assert(info.isPrivate, 'expected private repo');
  assert(info.canPush, 'expected push permission');
});

await test('bad token gives a clear 401', async () => {
  const err = await expectReject(checkRepo('ghp_invalidtoken000000000000000000000000', ref), (e) => e instanceof GitHubError && e.status === 401, '401');
  assert((err as Error).message.includes('rejected the token'), (err as Error).message);
});

await test('missing repo gives a clear 404', async () => {
  const err = await expectReject(checkRepo(token, { owner: ref.owner, repo: 'definitely-not-a-repo-xyz-123' }), (e) => e instanceof GitHubError && e.status === 404, '404');
  assert((err as Error).message.includes('not found'), (err as Error).message);
});

// Start clean so the run is repeatable.
const existing = await readDataFile(token, ref);
if (existing) {
  await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}/contents/teampicker.json`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify({ message: 'Reset for integration test', sha: existing.sha }),
  });
}

await test('readDataFile returns null when file is absent', async () => {
  assert((await readDataFile(token, ref)) === null, 'expected null');
});

const draw = summarizeDraw(assignment, teams, history[0].at);
const text1 = `${JSON.stringify(buildExportPayload(members, teams, history, draw), null, 2)}\n`;
let sha1 = '';

await test('create file (sha null) with unicode content', async () => {
  sha1 = await writeDataFile(token, ref, text1, null, commitMessageFor(draw, true));
  assert(/^[0-9a-f]{40}$/.test(sha1), `bad sha ${sha1}`);
});

await test('read back is byte-identical and parses', async () => {
  const file = await readDataFile(token, ref);
  assert(file, 'file missing');
  assert(file.sha === sha1, `sha ${file.sha} != ${sha1}`);
  assert(file.text === text1, 'content differs after round trip');
  const parsed = parseImportPayload(JSON.parse(file.text));
  assert(parsed.members[1].name === 'Søren 李', 'unicode name');
  assert(parsed.members[2].absent === true, 'absent flag');
  assert(sameDraw(parsed.lastDraw, draw), 'lastDraw round trip');
  assert(snapshotOf(parsed.members, parsed.teams, parsed.leaderHistory) === snapshotOf(members, teams, history), 'snapshot round trip');
});

await test('create again without sha is a conflict (file exists)', async () => {
  await expectReject(writeDataFile(token, ref, text1, null, 'should fail'), (e) => e instanceof GitHubConflictError, 'conflict');
});

const history2: LeaderRun[] = [...history, { id: 'r2', at: '2026-10-08T07:00:00.000Z', leaders: { t1: 'm4', t2: 'm1' } }];
const text2 = `${JSON.stringify(buildExportPayload(members, teams, history2), null, 2)}\n`;
let sha2 = '';

await test('update with current sha succeeds', async () => {
  sha2 = await writeDataFile(token, ref, text2, sha1, 'Update TeamPicker data');
  assert(sha2 !== sha1, 'sha unchanged');
});

await test('update with stale sha is a conflict', async () => {
  await expectReject(writeDataFile(token, ref, text1, sha1, 'stale'), (e) => e instanceof GitHubConflictError, 'conflict');
});

await test('read sees latest immediately (no stale cache)', async () => {
  const file = await readDataFile(token, ref);
  assert(file?.sha === sha2, `got ${file?.sha}, expected ${sha2}`);
  assert(parseImportPayload(JSON.parse(file.text)).leaderHistory.length === 2, 'history length');
});

await test('large payload (500 runs) round trips', async () => {
  const big: LeaderRun[] = Array.from({ length: 600 }, (_, i) => ({
    id: `run-${i}`,
    at: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString(),
    leaders: { t1: 'm1', t2: 'm2' },
  }));
  const text = `${JSON.stringify(buildExportPayload(members, teams, big), null, 2)}\n`;
  const sha = await writeDataFile(token, ref, text, sha2, 'Big history');
  const file = await readDataFile(token, ref);
  assert(file?.sha === sha, 'sha mismatch');
  const parsed = parseImportPayload(JSON.parse(file.text));
  assert(parsed.leaderHistory.length === 500, `capped length ${parsed.leaderHistory.length}`);
  assert(parsed.leaderHistory[499].id === 'run-599', 'kept newest');
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
