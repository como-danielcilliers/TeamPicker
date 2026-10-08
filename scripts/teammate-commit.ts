/**
 * Simulates a teammate editing the shared file directly on GitHub.
 *   npx tsx scripts/teammate-commit.ts add-member "Name"
 */
import { readDataFile, writeDataFile } from '../src/lib/github';

const token = process.env.GH_TOKEN ?? '';
const [owner, repo] = (process.env.TEST_REPO ?? '').split('/');
const [, , action, arg] = process.argv;
const ref = { owner, repo };

const file = await readDataFile(token, ref);
if (!file) throw new Error('No teampicker.json in repo');
const data = JSON.parse(file.text);

if (action === 'add-member') {
  data.members.push({ id: `teammate-${Date.now()}`, name: arg, absent: false });
} else {
  throw new Error(`Unknown action ${action}`);
}
data.exportedAt = new Date().toISOString();

const sha = await writeDataFile(
  token,
  ref,
  `${JSON.stringify(data, null, 2)}\n`,
  file.sha,
  `Teammate: ${action} ${arg}`,
);
console.log(`committed ${sha}`);
