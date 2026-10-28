import assert from 'node:assert/strict';
import { prepareCut, inversePatch, textSide, terminated } from './rollback.js';

// Real session order: a turn opens, then the user message lands inside it.
const base = [
  { seq: 0, type: 'turn/start' },
  { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'first' }] } },
  { seq: 2, type: 'turn/end' },
  { seq: 3, type: 'turn/start' },
  { seq: 4, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'second' }] } },
];
const events = [...base, { seq: 5, type: 'workspace/changes' }];
assert.deepEqual(prepareCut(events, 1), { content: [{ type: 'text', text: 'first' }], boundary: undefined, hasOpenTurn: true, records: [5] });
assert.deepEqual(prepareCut(events, 4), { content: [{ type: 'text', text: 'second' }], boundary: 2, hasOpenTurn: true, records: [5] });
const closed = [...base, { seq: 5, type: 'turn/end' }, { seq: 6, type: 'workspace/changes' }];
assert.equal(prepareCut(closed, 4).hasOpenTurn, false);
assert.deepEqual(prepareCut(closed, 4).records, [6]);

// A prompt queued during the previous turn sits between that turn and this one;
// the cut must not hand the branch a still-pending queue item.
const queued = [
  { seq: 0, type: 'turn/start' },
  { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'first' }] } },
  { seq: 2, type: 'turn/end' },
  { seq: 3, type: 'agent/inbox/spliced', data: { target: 'next-turn', start: 0, inserted: [{ content: [{ type: 'text', text: 'queued' }] }] } },
  { seq: 4, type: 'turn/start' },
  { seq: 5, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'queued' }] } },
  { seq: 6, type: 'turn/end' },
];
assert.equal(prepareCut(queued, 5).boundary, 2);
const doubleQueued = [
  { seq: 0, type: 'turn/start' },
  { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'first' }] } },
  { seq: 2, type: 'turn/end' },
  { seq: 3, type: 'agent/inbox/spliced', data: { target: 'next-turn', start: 0, inserted: [{}] } },
  { seq: 4, type: 'agent/inbox/spliced', data: { target: 'next-turn', start: 0, inserted: [{}] } },
  { seq: 5, type: 'turn/start' },
  { seq: 6, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'x' }] } },
];
assert.equal(prepareCut(doubleQueued, 6).boundary, 2);
assert.throws(() => prepareCut(events, 2));
assert.throws(() => prepareCut(events, 0));
assert.throws(() => prepareCut(events, 99));

// A compacted session starts above seq 0; the cut must follow `seq`, not the array index.
const offset = [
  { seq: 40, type: 'turn/start' },
  { seq: 41, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'later' }] } },
  { seq: 42, type: 'turn/end' },
  { seq: 43, type: 'turn/start' },
  { seq: 44, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'last' }] } },
  { seq: 45, type: 'turn/end' },
];
assert.deepEqual(prepareCut(offset, 44), { content: [{ type: 'text', text: 'last' }], boundary: 42, hasOpenTurn: false, records: [] });
assert.deepEqual(prepareCut(offset, 41), { content: [{ type: 'text', text: 'later' }], boundary: undefined, hasOpenTurn: false, records: [] });

const current = 'zero\none\ntwo\nthree\nfour\n';
const diff = { before: true, after: true, hunks: [{ oldStart: 2, oldLines: 2, newStart: 2, newLines: 3, lines: [' one\n', '-two\n', '+TWO\n', '+two again\n', ' three\n'] }] };
assert.equal(textSide(true, diff.hunks, true), 'one\nTWO\ntwo again\nthree\n');
assert.equal(textSide(true, diff.hunks, false), 'one\ntwo\nthree\n');
assert.equal(inversePatch('zero\none\nTWO\ntwo again\nthree\nfour\n', diff.hunks), current);
const created = { before: false, after: true, hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+new\n'] }] };
assert.equal(textSide(created.before, created.hunks, false), null);
assert.equal(inversePatch('new\n', created.hunks), '');
assert.throws(() => inversePatch('zero\none\nTWO\nthree\nfour\n', diff.hunks));

// The recorder diffs terminated text, so a file stored without a final newline
// must still invert instead of reading as "the file version changed".
assert.equal(terminated('a'), 'a\n');
assert.equal(terminated('a\n'), 'a\n');
assert.equal(terminated(''), '');
assert.equal(inversePatch('abc', [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, lines: ['+abc'] }]), '');
const unterminated = [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 2, lines: [' x\n', '+y'] }];
assert.equal(inversePatch('x\ny', unterminated), 'x\n');
console.log('rollback self-check passed');

