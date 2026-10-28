/**
 * Self-check for the Host half's disk and RPC surface.
 *
 * `sessionDirectory` is the only place that maps a session id onto disk, so it
 * must never return a path outside the sessions root — a bad id previously
 * resolved to `$DSH_HOME` or a parent directory before `purge` recursively
 * removed it. The route check drives the registered handler with a stub context
 * so admission, envelope validation, error codes, and the purge guard stay
 * covered without a running Harness.
 */
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply, sessionDirectory, validSessionId } from './index.js';

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

// --- route surface ---------------------------------------------------------
const routeCalls = [];
const registrations = [];
const makeContext = (overrides = {}) => ({
  effect: (factory) => factory(),
  get: (name) => (name === 'workspaceRegistry'
    ? { list: () => [{ id: 'ws-1', sessionIds: ['session-source'] }] }
    : name === 'sessions'
      ? { get: () => undefined }
      : undefined),
  webServer: {
    register: (route) => { registrations.push(route); return () => {}; },
  },
  connection: { admit: () => ({ peer: {} }) },
  workspaceController: {
    archiveSession: async ({ sessionId }) => { routeCalls.push(['archive', sessionId]); },
  },
  workspaceChanges: { summary: () => undefined, diff: async () => undefined },
  sessionController: {
    inspect: async () => ({
      meta: { cwd: 'D:/tmp', agentPreset: 'preset-a' },
      events: [
        { seq: 0, type: 'turn/start', data: { turn: 1 } },
        { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] } },
        { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
      ],
    }),
    fork: async () => ({ sessionId: 'session-child' }),
    create: async (request) => { routeCalls.push(['create', request]); return { sessionId: 'session-child' }; },
    prompt: async () => ({ accepted: true }),
  },
  ...overrides,
});

const rpc = async (handler, endpoint, payload) => {
  const body = JSON.stringify({ type: 'client-request', rpcId: 'rpc-1', method: endpoint, payload });
  let status;
  let bodyText;
  const request = {
    method: 'POST',
    url: `/message-rewind/${endpoint}`,
    async *[Symbol.asyncIterator]() { yield Buffer.from(body); },
  };
  await handler(request, { writeHead: (code) => { status = code; }, end: (value) => { bodyText = value; } });
  return { status, envelope: bodyText === undefined ? undefined : JSON.parse(bodyText) };
};

await check('the route is registered as one prefix', async () => {
  apply(makeContext());
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].kind, 'prefix');
  assert.equal(registrations[0].path, '/message-rewind');
});

await check('an unauthenticated request is rejected before the body is read', async () => {
  apply(makeContext({ connection: { admit: () => ({ rejection: 401 }) } }));
  const handler = registrations.at(-1).handler;
  let status;
  await handler({ method: 'POST', url: '/message-rewind/inspect', headers: {} }, { writeHead: (code) => { status = code; }, end: () => {} });
  assert.equal(status, 401);
});

await check('a traversal id never reaches the filesystem', async () => {
  apply(makeContext());
  const handler = registrations.at(-1).handler;
  for (const bad of ['..', '../../..', 'session-..', 'session-1/../..']) {
    const { envelope } = await rpc(handler, 'purge', { sessionId: bad });
    assert.equal(envelope.result.ok, false, `purge accepted ${JSON.stringify(bad)}`);
    assert.equal(envelope.result.error.details.rewindCode, 'invalid-session');
  }
  assert.equal(routeCalls.some((call) => call[0] === 'archive'), false, 'purge archived before validating');
});

await check('a bad envelope is refused with a code', async () => {
  const handler = registrations.at(-1).handler;
  const body = JSON.stringify({ type: 'wrong', rpcId: 'rpc-2', method: 'inspect', payload: {} });
  let bodyText;
  await handler({
    method: 'POST',
    url: '/message-rewind/inspect',
    async *[Symbol.asyncIterator]() { yield Buffer.from(body); },
  }, { writeHead: () => {}, end: (value) => { bodyText = value; } });
  assert.equal(JSON.parse(bodyText).result.error.details.rewindCode, 'bad-request');
});

await check('execute binds the replacement to the source workspace', async () => {
  const handler = registrations.at(-1).handler;
  const { envelope } = await rpc(handler, 'execute', { sessionId: 'session-source', seq: 1, action: 'edit', text: 'edited', rewindFiles: false });
  assert.equal(envelope.result.ok, true);
  assert.deepEqual(envelope.result.value, { sessionId: 'session-child', restored: 0, sourceSessionId: 'session-source' });
  assert.deepEqual(routeCalls.filter((call) => call[0] === 'create').at(-1)[1], { workspaceId: 'ws-1', agentPreset: 'preset-a' });
});

await check('an open turn is refused with a localizable code', async () => {
  const context = makeContext({
    sessionController: {
      inspect: async () => ({
        meta: { cwd: 'D:/tmp' },
        events: [
          { seq: 0, type: 'turn/start', data: { turn: 1 } },
          { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] } },
        ],
      }),
      fork: async () => ({ sessionId: 'session-child' }),
      create: async () => ({ sessionId: 'session-child' }),
      prompt: async () => ({ accepted: true }),
    },
  });
  apply(context);
  const { envelope } = await rpc(registrations.at(-1).handler, 'execute', { sessionId: 'session-source', seq: 1, action: 'delete', rewindFiles: false });
  assert.equal(envelope.result.error.details.rewindCode, 'open-turn');
});

await check('purge reports a failed archive instead of deleting', async () => {
  const context = makeContext({
    workspaceController: { archiveSession: async () => { throw new Error('workspace/session-active'); } },
  });
  apply(context);
  const { envelope } = await rpc(registrations.at(-1).handler, 'purge', { sessionId: 'session-11111111-2222-3333-4444-555555555555' });
  assert.equal(envelope.result.ok, true);
  assert.equal(envelope.result.value.removed, false);
  assert.match(envelope.result.value.message, /归档失败/);
});

await check('purge reports a missing log directory honestly', async () => {
  apply(makeContext());
  const { envelope } = await rpc(registrations.at(-1).handler, 'purge', { sessionId: 'session-11111111-2222-3333-4444-555555555555' });
  assert.equal(envelope.result.value.removed, false);
  assert.equal(envelope.result.value.archivedOnly, false);
});

console.log(`index self-check passed (${passed} scenarios)`);
