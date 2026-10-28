/**
 * Self-check for the purge path guard. `sessionDirectory` is the only place
 * that maps a session id onto disk, so it must never return a path outside the
 * sessions root — a bad id previously resolved to `$DSH_HOME` or a parent
 * directory before `purge` recursively removed it.
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sessionDirectory, validSessionId } from './index.js';

let passed = 0;
const check = async (label, fn) => {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
};

const root = await fsp.mkdtemp(join(tmpdir(), 'dmr-sessions-'));
const realRoot = await fsp.realpath(root);
const nested = 'session-11111111-2222-3333-4444-555555555555';
const flat = 'session-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

await check('nested project directory is found', async () => {
  await fsp.mkdir(join(realRoot, '--workspace--', nested), { recursive: true });
  assert.equal(await sessionDirectory(realRoot, nested), join(realRoot, '--workspace--', nested));
});

await check('root-level session directory is found', async () => {
  await fsp.mkdir(join(realRoot, flat), { recursive: true });
  assert.equal(await sessionDirectory(realRoot, flat), join(realRoot, flat));
});

await check('path traversal ids are rejected', async () => {
  for (const id of ['..', '../..', '../../..', 'session-..', 'session-../..', 'a/b', 'C:\\Windows', '', 'session-']) {
    assert.equal(await sessionDirectory(realRoot, id), undefined, `accepted ${JSON.stringify(id)}`);
  }
});

await check('id validation matches the harness format', async () => {
  assert.equal(validSessionId(nested), true);
  assert.equal(validSessionId('session-123'), true);
  assert.equal(validSessionId('..'), false);
  assert.equal(validSessionId('session-..'), false);
  assert.equal(validSessionId('session-1/../..'), false);
  assert.equal(validSessionId(42), false);
});

await check('a junction cannot escape the sessions root', async () => {
  const outsideParent = await fsp.mkdtemp(join(tmpdir(), 'dmr-outside-'));
  const linked = 'session-99999999-8888-7777-6666-555555555555';
  const outside = join(outsideParent, linked);
  const linkedPath = join(realRoot, '--workspace--', linked);
  await fsp.mkdir(outside, { recursive: true });
  try {
    await fsp.symlink(outside, linkedPath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    await fsp.rm(outsideParent, { recursive: true, force: true });
    if (error?.code === 'EPERM' || error?.code === 'EACCES') return;
    throw error;
  }
  try {
    assert.equal(await sessionDirectory(realRoot, linked), undefined);
  } finally {
    await fsp.rm(linkedPath, { force: true }).catch(() => {});
    await fsp.rm(outsideParent, { recursive: true, force: true });
  }
});

await fsp.rm(realRoot, { recursive: true, force: true });
console.log(`index self-check passed (${passed} scenarios)`);
