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

// `SESSIONS_ROOT` is fixed when the module loads, so point it at a throwaway
// home before importing; the purge checks below create and remove real paths.
const testHome = await fsp.mkdtemp(join(tmpdir(), 'dmr-home-'));
process.env.DSH_HOME = testHome;
const { apply, sessionDirectory, validSessionId } = await import('./index.js');
const sessionsRoot = join(testHome, 'sessions');
await fsp.mkdir(sessionsRoot, { recursive: true });

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
    // A junction is removed like a file, but only when `recursive` is set on
    // Windows; a bare rm leaves the reparse point behind and the root cleanup
    // below then fails with ENOTEMPTY.
    await fsp.rm(linkedPath, { recursive: true, force: true }).catch(() => {});
    await fsp.rm(outsideParent, { recursive: true, force: true });
  }
});

await fsp.rm(realRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

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
  sessionQuery: {
    readSession: async () => ({
      session: { id: 'session-source', cwd: 'D:/tmp', agentPreset: 'preset-a' },
      events: [
        { seq: 0, type: 'turn/start', data: { turn: 1 } },
        { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] } },
        { seq: 2, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
      ],
    }),
  },
  sessionController: {
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

// A file rollback is offered only while every recorded change can be read back
// and reverted. The recorder truncates `files` at maxFiles while `total` keeps
// the real count, and stores a file outside the session cwd as an absolute path
// that the rewind plan refuses; both must show up as `incomplete` before the
// user can confirm a file rollback.
const summaryEvents = [
  { seq: 0, type: 'turn/start', data: { turn: 1 } },
  { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] } },
  { seq: 2, type: 'workspace/changes', data: { turn: 1 } },
  { seq: 3, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
];
const contextWithSummary = (summary) => makeContext({
  workspaceChanges: { summary: () => summary, diff: async () => undefined },
  sessionQuery: {
    readSession: async () => ({ session: { id: 'session-source', cwd: tmpdir() }, events: summaryEvents }),
  },
});
const incompleteSummaries = [
  ['a maxFiles-truncated summary', { turn: 1, cwd: tmpdir(), files: [{ path: 'a.txt', display: 'a.txt' }], total: 2, added: 0, deleted: 0 }, ['a.txt']],
  ['a change outside the session cwd', { turn: 1, cwd: tmpdir(), files: [{ path: join(tmpdir(), 'outside.txt'), display: '../outside.txt' }], total: 1, added: 1, deleted: 0 }, ['../outside.txt']],
];
for (const [label, summary, files] of incompleteSummaries) {
  await check(`${label} is reported as incomplete`, async () => {
    apply(contextWithSummary(summary));
    const handler = registrations.at(-1).handler;
    const inspected = await rpc(handler, 'inspect', { sessionId: 'session-source', seq: 1 });
    assert.deepEqual(inspected.envelope.result.value.files, files);
    assert.equal(inspected.envelope.result.value.incomplete, true);
    const refused = await rpc(handler, 'execute', { sessionId: 'session-source', seq: 1, action: 'delete', rewindFiles: true });
    assert.equal(refused.envelope.result.ok, false);
    assert.equal(refused.envelope.result.error.details.rewindCode, 'incomplete-snapshot');
  });
}

await check("only a turn's last recorded summary is loaded", async () => {
  const summaries = [];
  const context = makeContext({
    workspaceChanges: {
      summary: (sessionId, seq) => {
        summaries.push(seq);
        return { turn: 1, cwd: 'D:/tmp', files: [], total: 0, added: 0, deleted: 0 };
      },
      diff: async () => undefined,
    },
    sessionQuery: {
      readSession: async () => ({
        session: { id: 'session-source', cwd: 'D:/tmp' },
        events: [
          { seq: 0, type: 'turn/start', data: { turn: 1 } },
          { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] } },
          { seq: 2, type: 'workspace/changes', data: { turn: 1 } },
          { seq: 3, type: 'workspace/changes', data: { turn: 1 } },
          { seq: 4, type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
        ],
      }),
    },
  });
  apply(context);
  const { envelope } = await rpc(registrations.at(-1).handler, 'inspect', { sessionId: 'session-source', seq: 1 });
  assert.equal(envelope.result.ok, true);
  assert.deepEqual(summaries, [3]);
});

await check('an oversized text comparison is reported as its own code', async () => {
  const summary = { turn: 1, cwd: tmpdir(), files: [{ path: 'big.txt', display: 'big.txt' }], total: 1, added: 1, deleted: 0 };
  const context = makeContext({
    workspaceChanges: {
      summary: () => summary,
      diff: async () => ({ kind: 'oversized', path: 'big.txt', display: 'big.txt' }),
    },
    sessionQuery: {
      readSession: async () => ({ session: { id: 'session-source', cwd: tmpdir() }, events: summaryEvents }),
    },
  });
  apply(context);
  const { envelope } = await rpc(registrations.at(-1).handler, 'execute', { sessionId: 'session-source', seq: 1, action: 'delete', rewindFiles: true });
  assert.equal(envelope.result.ok, false);
  assert.equal(envelope.result.error.details.rewindCode, 'oversized-file');
});

await check('an open turn is refused with a localizable code', async () => {
  const context = makeContext({
    sessionQuery: {
      readSession: async () => ({
        session: { id: 'session-source', cwd: 'D:/tmp' },
        events: [
          { seq: 0, type: 'turn/start', data: { turn: 1 } },
          { seq: 1, type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] } },
        ],
      }),
    },
  });
  apply(context);
  const { envelope } = await rpc(registrations.at(-1).handler, 'execute', { sessionId: 'session-source', seq: 1, action: 'delete', rewindFiles: false });
  assert.equal(envelope.result.error.details.rewindCode, 'open-turn');
});

await check('a deleted session is reported with a localizable code', async () => {
  const context = makeContext({
    sessionQuery: {
      readSession: async () => {
        throw Object.assign(new Error('session "session-source" not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' });
      },
    },
  });
  apply(context);
  const { envelope } = await rpc(registrations.at(-1).handler, 'inspect', { sessionId: 'session-source', seq: 1 });
  assert.equal(envelope.result.ok, false);
  assert.equal(envelope.result.error.details.rewindCode, 'missing-session');
});

const makePurgeContext = (sessionId, calls, options = {}) => {
  let live = options.live === false ? undefined : { id: sessionId };
  const registry = {
    archivedSessionIds: options.archived === true ? [sessionId] : [],
    list: () => [{
      id: 'ws-1',
      sessionIds: [sessionId],
      detachSession: async (id) => { calls.push(['workspace', id]); },
    }],
  };
  return makeContext({
    get: (name) => {
      if (name === 'sessions') {
        return {
          get: (id) => (id === sessionId ? live : undefined),
          flush: async () => { calls.push('flush'); },
          liveEntryFor: () => live,
          detachEntered: () => {
            calls.push('detach');
            if (options.failDetach === true) throw new Error('session is still live');
            live = undefined;
          },
        };
      }
      if (name === 'workspaceRegistry') return registry;
      if (name === 'sessionProjectionCache') {
        return { requireTable: () => ({ delete: async (id) => { calls.push(['cache', id]); } }) };
      }
      return undefined;
    },
    workspaceController: {
      archiveSession: async () => { calls.push('archive'); },
      unarchiveSession: async () => { calls.push('unarchive'); },
    },
    parallel: async (event) => { calls.push(['parallel', event]); },
    emit: (event, id) => { calls.push(['emit', event, id]); },
  });
};

const makeSessionDir = async (sessionId) => {
  const directory = join(sessionsRoot, '--D-Code-test--', sessionId);
  await fsp.mkdir(directory, { recursive: true });
  await fsp.writeFile(join(directory, 'session.v4.jsonl.zstd'), 'log');
  return directory;
};

await check('purge deletes a live source session directly, without archiving', async () => {
  const sessionId = 'session-11111111-1111-1111-1111-111111111111';
  const directory = await makeSessionDir(sessionId);
  const calls = [];
  apply(makePurgeContext(sessionId, calls));
  const { envelope } = await rpc(registrations.at(-1).handler, 'purge', { sessionId });
  assert.equal(envelope.result.ok, true);
  assert.equal(envelope.result.value.removed, true);
  assert.equal(await fsp.stat(directory).catch(() => undefined), undefined);
  assert.ok(calls.includes('flush'), 'the live session was flushed before deletion');
  assert.ok(calls.includes('detach'), 'the live session was detached');
  assert.ok(calls.some((call) => call[0] === 'parallel' && call[1] === 'workspace/session-stop'), 'queued work was stopped');
  assert.ok(calls.some((call) => call[0] === 'workspace' && call[1] === sessionId), 'workspace accounting was dropped');
  assert.ok(calls.some((call) => call[0] === 'cache' && call[1] === sessionId), 'the projection cache was dropped');
  assert.equal(calls.includes('archive'), false, 'the source was not archived');
});

await check('purge keeps the log and archives when a live session cannot be detached', async () => {
  const sessionId = 'session-33333333-3333-3333-3333-333333333333';
  const directory = await makeSessionDir(sessionId);
  const calls = [];
  apply(makePurgeContext(sessionId, calls, { failDetach: true }));
  const { envelope } = await rpc(registrations.at(-1).handler, 'purge', { sessionId });
  assert.equal(envelope.result.value.removed, false);
  assert.equal(envelope.result.value.archivedOnly, true);
  assert.ok(calls.includes('archive'), 'the undetachable session was archived instead');
  assert.ok(await fsp.stat(directory), 'the log was left in place');
});

await check('purge removes a cold session row and its archived flag', async () => {
  const sessionId = 'session-22222222-2222-2222-2222-222222222222';
  const directory = await makeSessionDir(sessionId);
  const calls = [];
  apply(makePurgeContext(sessionId, calls, { live: false, archived: true }));
  const { envelope } = await rpc(registrations.at(-1).handler, 'purge', { sessionId });
  assert.equal(envelope.result.value.removed, true);
  assert.equal(await fsp.stat(directory).catch(() => undefined), undefined);
  assert.ok(calls.some((call) => call[0] === 'emit' && call[1] === 'api-session/removed'), 'the client row was removed');
  assert.ok(calls.includes('unarchive'), 'an archive flag left by an older version was dropped');
});

await check('purge reports a missing log directory honestly', async () => {
  apply(makeContext());
  const { envelope } = await rpc(registrations.at(-1).handler, 'purge', { sessionId: 'session-11111111-2222-3333-4444-555555555555' });
  assert.equal(envelope.result.value.removed, false);
  assert.equal(envelope.result.value.archivedOnly, false);
  assert.equal(routeCalls.some((call) => call[0] === 'archive'), false, 'a missing log was not archived');
});

await fsp.rm(testHome, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

console.log(`index self-check passed (${passed} scenarios)`);
