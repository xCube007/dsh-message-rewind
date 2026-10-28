/**
 * File-rewind self-check against a real temporary directory. The recorded
 * diffs are handcrafted to match what `dsh-workspace-changes` produces: it diffs
 * newline-terminated text with jsdiff, so every hunk line carries its `\n`, and a
 * deletion is `before: true, after: false`.
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planRewind, applyRewind, invert } from './files.js';

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
  const targets = await planRewind(readDiffFrom({ '1:0': deletedDiff }), recordsFor([{ seq: 1, files: [{ path: deletedName, display: deletedName }] }]));
  assert.deepEqual([...targets.values()][0].original, { exists: true, text: deletedBefore });
  await applyRewind(targets);
  assert.equal(await fsp.readFile(abs(deletedName), 'utf8'), deletedBefore);
});

// --- a turn that created a file is undone by removing it --------------------
const createdName = 'created.txt';
const createdDiff = textDiff(createdName, false, true, [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+abc'] }]);
await check('created file is removed', async () => {
  await fsp.writeFile(abs(createdName), 'abc', 'utf8');
  const targets = await planRewind(readDiffFrom({ '2:0': createdDiff }), recordsFor([{ seq: 2, files: [{ path: createdName, display: createdName }] }]));
  assert.deepEqual([...targets.values()][0].original, { exists: false, text: null });
  await applyRewind(targets);
  await assert.rejects(() => fsp.stat(abs(createdName)));
});

// --- a turn that modified a file is reverted -------------------------------
const editedName = 'edited.txt';
const editedDiff = textDiff(editedName, true, true, [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [' zero\n', ' one\n', '-two\n', '+TWO\n'] }]);
await check('modified file is reverted', async () => {
  await fsp.writeFile(abs(editedName), 'zero\none\nTWO\n', 'utf8');
  const targets = await planRewind(readDiffFrom({ '3:0': editedDiff }), recordsFor([{ seq: 3, files: [{ path: editedName, display: editedName }] }]));
  await applyRewind(targets);
  assert.equal(await fsp.readFile(abs(editedName), 'utf8'), 'zero\none\ntwo\n');
});

// --- a file stored without a final newline still matches the diff ----------
const bareName = 'bare.txt';
const bareDiff = textDiff(bareName, true, true, [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [' x\n', '+y'] }]);
await check('unterminated file is reverted', async () => {
  await fsp.writeFile(abs(bareName), 'x\ny', 'utf8');
  const targets = await planRewind(readDiffFrom({ '4:0': bareDiff }), recordsFor([{ seq: 4, files: [{ path: bareName, display: bareName }] }]));
  await applyRewind(targets);
  assert.equal(await fsp.readFile(abs(bareName), 'utf8'), 'x\n');
});

// --- a UTF-8 BOM survives the round trip -----------------------------------
const bomName = 'bom.txt';
const bomDiff = textDiff(bomName, true, true, [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [' \uFEFFone\n', '-two\n', '+TWO\n'] }]);
await check('utf-8 BOM file is reverted without losing the BOM', async () => {
  const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
  await fsp.writeFile(abs(bomName), Buffer.concat([bom, Buffer.from('one\nTWO\n', 'utf8')]));
  const targets = await planRewind(readDiffFrom({ '10:0': bomDiff }), recordsFor([{ seq: 10, files: [{ path: bomName, display: bomName }] }]));
  await applyRewind(targets);
  const bytes = await fsp.readFile(abs(bomName));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
  assert.equal(bytes.toString('utf8'), '\uFEFFone\ntwo\n');
});

// --- a created file edited after its turn is refused, not deleted ----------
const createdLaterName = 'created-later.txt';
const createdLaterDiff = textDiff(createdLaterName, false, true, [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+original\n'] }]);
await check('created file edited later is refused', async () => {
  await fsp.writeFile(abs(createdLaterName), 'original\nplus a manual edit\n', 'utf8');
  await assert.rejects(
    () => planRewind(readDiffFrom({ '11:0': createdLaterDiff }), recordsFor([{ seq: 11, files: [{ path: createdLaterName, display: createdLaterName }] }])),
    /created-later\.txt：.*在记录之后又被修改过/,
  );
  await fsp.writeFile(abs(createdLaterName), 'original\n', 'utf8');
  const targets = await planRewind(readDiffFrom({ '12:0': createdLaterDiff }), recordsFor([{ seq: 12, files: [{ path: createdLaterName, display: createdLaterName }] }]));
  await applyRewind(targets);
  await assert.rejects(() => fsp.stat(abs(createdLaterName)));
});

// --- a file changed after that turn refuses instead of guessing -------------
await check('conflicting later edit is refused', async () => {
  await fsp.writeFile(abs(editedName), 'zero\none\nTHREE\n', 'utf8');
  await assert.rejects(
    () => planRewind(readDiffFrom({ '5:0': editedDiff }), recordsFor([{ seq: 5, files: [{ path: editedName, display: editedName }] }])),
    /edited\.txt：.*(在记录之后又被修改过|文件版本已改变)/,
  );
});

// --- several turns on one path unwind newest first -------------------------
const chainedName = 'chained.txt';
const chainedCreated = textDiff(chainedName, false, true, [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+abc'] }]);
const chainedEdited = textDiff(chainedName, true, true, [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [' abc\n', '+def\n'] }]);
await check('multi-turn path unwinds to absent', async () => {
  await fsp.writeFile(abs(chainedName), 'abc\ndef\n', 'utf8');
  const targets = await planRewind(
    readDiffFrom({ '6:0': chainedCreated, '7:0': chainedEdited }),
    recordsFor([
      { seq: 6, files: [{ path: chainedName, display: chainedName }] },
      { seq: 7, files: [{ path: chainedName, display: chainedName }] },
    ]),
  );
  await applyRewind(targets);
  await assert.rejects(() => fsp.stat(abs(chainedName)));
});

// --- undo restores exactly what the rewind replaced --------------------------
await check('undo restores the pre-rewind state', async () => {
  await fsp.writeFile(abs(editedName), 'zero\none\nTWO\n', 'utf8');
  const targets = await planRewind(readDiffFrom({ '8:0': editedDiff }), recordsFor([{ seq: 8, files: [{ path: editedName, display: editedName }] }]));
  const applied = await applyRewind(targets);
  assert.equal(await fsp.readFile(abs(editedName), 'utf8'), 'zero\none\ntwo\n');
  await applied.undo();
  assert.equal(await fsp.readFile(abs(editedName), 'utf8'), 'zero\none\nTWO\n');
});

// --- a path outside the recorded workspace is refused ----------------------
await check('path outside the workspace is refused', async () => {
  await assert.rejects(
    () => planRewind(readDiffFrom({}), recordsFor([{ seq: 9, files: [{ path: '../escape.txt', display: '../escape.txt' }] }])),
    /不在该轮工作区内/,
  );
});

// --- invert is a pure total function on absence ----------------------------
assert.deepEqual(invert({ exists: false, text: null }, deletedDiff), { exists: true, text: deletedBefore });
assert.deepEqual(invert({ exists: true, text: 'abc' }, createdDiff), { exists: false, text: null });
assert.throws(() => invert({ exists: true, text: 'abc changed' }, createdDiff), /在记录之后又被修改过/);

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

