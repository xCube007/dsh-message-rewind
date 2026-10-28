/**
 * File-rollback self-check against a real temporary directory. The recorded
 * diffs are handcrafted to match what `dsh-workspace-changes` produces: it diffs
 * newline-terminated text with jsdiff, so every hunk line carries its `\n`, and a
 * deletion is `before: true, after: false`.
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planRollback, applyRollback, invert } from './files.js';

let passed = 0;
const check = (label, fn) => fn().then(() => { passed += 1; }, (error) => { throw new Error(`${label}: ${error.message}`); });

const workspace = await fsp.mkdtemp(join(tmpdir(), 'dmr-files-'));
const recordsFor = (entries) => entries.map(({ seq, files }) => ({
  seq,
  summary: { turn: 1, cwd: workspace, files, total: files.length, added: 0, deleted: 0 },
}));
const readDiffFrom = (table) => async (seq, index) => {
  const found = table[`${seq}:${index}`];
  if (!found) throw new Error(`no recorded diff for ${seq}:${index}`);
  return found;
};
const abs = (name) => join(workspace, name);
const textDiff = (path, before, after, hunks) => ({ kind: 'text', path, display: path, before, after, hunks, coarse: false });

// --- a turn that deleted a file is restorable ------------------------------
const deletedName = 'deleted.txt';
const deletedBefore = 'one\ntwo\n';
const deletedDiff = textDiff(deletedName, true, false, [{ oldStart: 1, oldLines: 2, newStart: 0, newLines: 0, lines: ['-one\n', '-two\n'] }]);
await check('deleted file is recreated', async () => {
  assert.deepEqual(await readExists(deletedName), null);
  const targets = await planRollback(readDiffFrom({ '1:0': deletedDiff }), recordsFor([{ seq: 1, files: [{ path: deletedName, display: deletedName }] }]));
  assert.deepEqual([...targets.values()][0].original, { exists: true, text: deletedBefore });
  await applyRollback(targets);
  assert.equal(await fsp.readFile(abs(deletedName), 'utf8'), deletedBefore);
});

// --- a turn that created a file is undone by removing it --------------------
const createdName = 'created.txt';
const createdDiff = textDiff(createdName, false, true, [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+abc'] }]);
await check('created file is removed', async () => {
  await fsp.writeFile(abs(createdName), 'abc', 'utf8');
  const targets = await planRollback(readDiffFrom({ '2:0': createdDiff }), recordsFor([{ seq: 2, files: [{ path: createdName, display: createdName }] }]));
  assert.deepEqual([...targets.values()][0].original, { exists: false, text: null });
  await applyRollback(targets);
  await assert.rejects(() => fsp.stat(abs(createdName)));
});

// --- a turn that modified a file is reverted -------------------------------
const editedName = 'edited.txt';
const editedDiff = textDiff(editedName, true, true, [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [' zero\n', ' one\n', '-two\n', '+TWO\n'] }]);
await check('modified file is reverted', async () => {
  await fsp.writeFile(abs(editedName), 'zero\none\nTWO\n', 'utf8');
  const targets = await planRollback(readDiffFrom({ '3:0': editedDiff }), recordsFor([{ seq: 3, files: [{ path: editedName, display: editedName }] }]));
  await applyRollback(targets);
  assert.equal(await fsp.readFile(abs(editedName), 'utf8'), 'zero\none\ntwo\n');
});

// --- a file stored without a final newline still matches the diff ----------
const bareName = 'bare.txt';
const bareDiff = textDiff(bareName, true, true, [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [' x\n', '+y'] }]);
await check('unterminated file is reverted', async () => {
  await fsp.writeFile(abs(bareName), 'x\ny', 'utf8');
  const targets = await planRollback(readDiffFrom({ '4:0': bareDiff }), recordsFor([{ seq: 4, files: [{ path: bareName, display: bareName }] }]));
  await applyRollback(targets);
  assert.equal(await fsp.readFile(abs(bareName), 'utf8'), 'x\n');
});

// --- a file changed after that turn refuses instead of guessing -------------
await check('conflicting later edit is refused', async () => {
  await fsp.writeFile(abs(editedName), 'zero\none\nTHREE\n', 'utf8');
  await assert.rejects(
    () => planRollback(readDiffFrom({ '5:0': editedDiff }), recordsFor([{ seq: 5, files: [{ path: editedName, display: editedName }] }])),
    /edited\.txt：.*(在记录之后又被修改过|文件版本已改变)/,
  );
});

// --- several turns on one path unwind newest first -------------------------
const chainedName = 'chained.txt';
const chainedCreated = textDiff(chainedName, false, true, [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+abc'] }]);
const chainedEdited = textDiff(chainedName, true, true, [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [' abc\n', '+def\n'] }]);
await check('multi-turn path unwinds to absent', async () => {
  await fsp.writeFile(abs(chainedName), 'abc\ndef\n', 'utf8');
  const targets = await planRollback(
    readDiffFrom({ '6:0': chainedCreated, '7:0': chainedEdited }),
    recordsFor([
      { seq: 6, files: [{ path: chainedName, display: chainedName }] },
      { seq: 7, files: [{ path: chainedName, display: chainedName }] },
    ]),
  );
  await applyRollback(targets);
  await assert.rejects(() => fsp.stat(abs(chainedName)));
});

// --- undo restores exactly what rollback replaced --------------------------
await check('undo restores the pre-rollback state', async () => {
  await fsp.writeFile(abs(editedName), 'zero\none\nTWO\n', 'utf8');
  const targets = await planRollback(readDiffFrom({ '8:0': editedDiff }), recordsFor([{ seq: 8, files: [{ path: editedName, display: editedName }] }]));
  const applied = await applyRollback(targets);
  assert.equal(await fsp.readFile(abs(editedName), 'utf8'), 'zero\none\ntwo\n');
  await applied.undo();
  assert.equal(await fsp.readFile(abs(editedName), 'utf8'), 'zero\none\nTWO\n');
});

// --- a path outside the recorded workspace is refused ----------------------
await check('path outside the workspace is refused', async () => {
  await assert.rejects(
    () => planRollback(readDiffFrom({}), recordsFor([{ seq: 9, files: [{ path: '../escape.txt', display: '../escape.txt' }] }])),
    /不在该轮工作区内/,
  );
});

// --- invert is a pure total function on absence ----------------------------
assert.deepEqual(invert({ exists: false, text: null }, deletedDiff), { exists: true, text: deletedBefore });
assert.deepEqual(invert({ exists: true, text: 'abc' }, createdDiff), { exists: false, text: null });

async function readExists(name) {
  try {
    return await fsp.readFile(abs(name), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

await fsp.rm(workspace, { recursive: true, force: true });
console.log(`files self-check passed (${passed} scenarios)`);

