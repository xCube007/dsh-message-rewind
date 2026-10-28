import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { prepareCut } from './rollback.js';
import { planRollback, applyRollback } from './files.js';

const MAX_BODY_BYTES = 1024 * 1024;
const CHANNEL = '/message-rollback';
const DIFF_TIMEOUT = 30_000;
/** Matches the `$DSH_HOME` > `~/.dsh` resolution the harness itself uses. */
const SESSIONS_ROOT = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'sessions');

export const inject = ['sessionController', 'workspaceChanges', 'sessions', 'workspaceController', 'connection', 'webServer'];

const text = (error) => (error instanceof Error ? error.message : String(error));

function diffTimeout() {
  return AbortSignal.timeout(DIFF_TIMEOUT);
}

/**
 * Locate one session's on-disk directory. A workspace session lives under its
 * cwd slug; a session without a cwd sits directly in the sessions root.
 */
async function sessionDirectory(sessionId) {
  const candidates = [join(SESSIONS_ROOT, sessionId)];
  try {
    for (const entry of await fsp.readdir(SESSIONS_ROOT, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(join(SESSIONS_ROOT, entry.name, sessionId));
    }
  } catch {
    return undefined;
  }
  for (const candidate of candidates) {
    try {
      const info = await fsp.stat(candidate);
      if (info.isDirectory()) return candidate;
    } catch {
      /* not this slug */
    }
  }
  return undefined;
}

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

/**
 * Whether a directory sits inside a Git work tree. The change recorder reaches
 * shell-command effects through Git; outside a repository it records only the
 * files DSH's own write/edit tools touched.
 * @param cwd - absolute session working directory.
 * @returns true when some ancestor holds a `.git` entry.
 */
async function insideGitWorkTree(cwd) {
  let current = join(cwd);
  for (;;) {
    try {
      await fsp.stat(join(current, '.git'));
      return true;
    } catch {
      /* keep walking up */
    }
    const parent = join(current, '..');
    if (parent === current) return false;
    current = parent;
  }
}

export function apply(ctx) {
  const chains = new Map();
  const ordered = (sessionId, operation) => {
    const result = (chains.get(sessionId) ?? Promise.resolve()).then(operation);
    chains.set(sessionId, result.catch(() => {}));
    return result;
  };

  async function readDiff(sessionId, seq, index) {
    const diff = await ctx.workspaceChanges.diff(sessionId, seq, index, diffTimeout());
    if (!diff) throw new Error('文件改动快照已不可用，未回滚任何文件。');
    if (diff.kind !== 'text') throw new Error(`只能回滚文本文件：${diff.display}`);
    if (diff.coarse) throw new Error(`改动过大，无法安全回滚：${diff.display}`);
    return diff;
  }

  async function load(sessionId, seq) {
    const inspection = await ctx.sessionController.inspect(sessionId);
    const cut = prepareCut(inspection.events, seq);
    const records = cut.records.map((recordSeq) => ({
      seq: recordSeq,
      summary: ctx.workspaceChanges.summary(sessionId, recordSeq),
    }));
    return { inspection, cut, records };
  }

  /** Replay the inbox splices to count prompts still waiting for a turn. */
  function pendingQueue(events) {
    let queued = 0;
    for (const event of events) {
      if (event.type !== 'agent/inbox/spliced') continue;
      const data = event.data;
      if (data?.target !== 'next-turn') continue;
      const removed = Number(data.removedCount ?? 0);
      const inserted = Array.isArray(data.inserted) ? data.inserted.length : 0;
      queued = Math.max(0, queued - removed) + inserted;
    }
    return queued;
  }

  function describe(records) {
    const files = new Map();
    let incomplete = false;
    for (const { summary } of records) {
      if (!summary) {
        incomplete = true;
        continue;
      }
      for (const file of summary.files) files.set(`${summary.cwd}\0${file.path}`, file.display);
    }
    return { files: [...files.values()], incomplete };
  }

  /** Read every recorded diff and compute the pre-cut content without touching disk. */
  const plan = (sessionId, records) => planRollback((seq, index) => readDiff(sessionId, seq, index), records);

  async function forkOrCreate(sessionId, boundary, meta) {
    if (boundary !== undefined) {
      const forked = await ctx.sessionController.fork({ sessionId, atSeq: boundary });
      return forked.sessionId;
    }
    const request = {};
    if (meta.cwd !== undefined) request.cwd = meta.cwd;
    if (meta.agentPreset !== undefined) request.agentPreset = meta.agentPreset;
    const created = await ctx.sessionController.create(request);
    return created.sessionId;
  }

  async function inspect(sessionId, seq) {
    const { inspection, cut, records } = await load(sessionId, seq);
    const { files, incomplete } = describe(records);
    const cwd = inspection.meta.cwd;
    const git = cwd === undefined ? true : await insideGitWorkTree(cwd);
    return { files, incomplete, unfinished: cut.hasOpenTurn, queued: pendingQueue(inspection.events), git };
  }

  async function execute(request) {
    const sessionId = String(request?.sessionId ?? '');
    const action = request?.action;
    if (action !== 'delete' && action !== 'edit') throw new Error('操作类型无效。');
    const withFiles = request?.rollbackFiles === true;
    const { inspection, cut, records } = await load(sessionId, request?.seq);
    if (cut.hasOpenTurn) throw new Error('请先停止当前运行，再编辑或删除消息。');
    if (action === 'edit' && cut.content.some((block) => block.type !== 'text')) throw new Error('含附件的消息暂时只能删除，不能编辑。');
    let content = cut.content;
    if (action === 'edit') {
      const replacement = typeof request?.text === 'string' ? request.text.trim() : '';
      if (replacement === '') throw new Error('消息不能为空。');
      content = content.map((block, index) => (index === 0 ? { ...block, text: replacement } : block));
    }
    let restored = 0;
    let undo = null;
    if (withFiles) {
      if (describe(records).incomplete) throw new Error('部分文件改动快照已不可用，只能只回滚消息。');
      if (records.some((record) => record.summary)) {
        if (!inspection.meta.cwd) throw new Error('这个会话没有工作区，只能只回滚消息。');
        const targets = await plan(sessionId, records);
        const applied = await applyRollback(targets);
        undo = applied.undo;
        restored = applied.written;
      }
    }
    let childId;
    try {
      childId = await forkOrCreate(sessionId, cut.boundary, inspection.meta);
      if (action === 'edit') {
        await ctx.sessionController.prompt({
          requestId: randomUUID(),
          sessionId: childId,
          mode: 'queue',
          content,
        }, new AbortController().signal);
      }
    } catch (error) {
      if (undo) await undo().catch((undoError) => { error.message = `${text(error)}；${text(undoError)}`; });
      throw error;
    }
    return { sessionId: childId, restored, sourceSessionId: sessionId };
  }

  /**
   * Remove a rolled-back source session for good. The harness keeps session logs
   * append-only and offers no delete API, so this retires the artifact instead:
   * archive it out of the sidebar, wait for its writer to release, delete the
   * directory, and report whether the bytes are gone.
   */
  async function purge(sessionId) {
    await ctx.workspaceController.archiveSession({ sessionId, stopActivity: true }).catch(() => {});
    for (let attempt = 0; attempt < 40 && ctx.sessions.get(sessionId) !== undefined; attempt += 1) await delay(100);
    const directory = await sessionDirectory(sessionId);
    if (directory === undefined) return { removed: true, archivedOnly: false };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await fsp.rm(directory, { recursive: true, force: true });
        return { removed: true, archivedOnly: false };
      } catch (error) {
        if (attempt === 5) return { removed: false, archivedOnly: true, message: text(error) };
        await delay(250);
      }
    }
    return { removed: false, archivedOnly: true };
  }

  async function dispatch(endpoint, payload) {
    if (endpoint === 'inspect') {
      const sessionId = String(payload?.sessionId ?? '');
      return ordered(sessionId, () => inspect(sessionId, payload?.seq));
    }
    if (endpoint === 'execute') {
      const sessionId = String(payload?.sessionId ?? '');
      return ordered(sessionId, () => execute(payload));
    }
    if (endpoint === 'purge') {
      const sessionId = String(payload?.sessionId ?? '');
      if (sessionId === '') throw new Error('会话标识无效。');
      return purge(sessionId);
    }
    throw new Error(`未知接口：${endpoint}`);
  }


  async function readBody(request) {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) throw new Error('请求体过大。');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  function send(response, status, body) {
    const json = JSON.stringify(body);
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    response.end(json);
  }

  function registerRoute() {
    // A reload replaces this plugin's fiber; drop the route the previous fiber
    // could not dispose so reactivation stays idempotent.
    const prefixes = ctx.webServer.prefixes;
    if (prefixes instanceof Map && prefixes.get(CHANNEL) !== undefined) prefixes.delete(CHANNEL);
    return ctx.webServer.register({
      kind: 'prefix',
      path: CHANNEL,
      handler: routeHandler,
    });
  }

  async function routeHandler(request, response) {
      const admission = ctx.connection.admit(request);
      if ('rejection' in admission) {
        response.writeHead(admission.rejection);
        response.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden');
        return;
      }
      const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
      const endpoint = pathname.startsWith(`${CHANNEL}/`) ? pathname.slice(CHANNEL.length + 1) : '';
      if (request.method !== 'POST' || endpoint === '' || endpoint.includes('/')) {
        send(response, 404, { error: 'not found' });
        return;
      }
      let envelope;
      try {
        envelope = JSON.parse(await readBody(request));
      } catch (error) {
        send(response, 400, { error: text(error) });
        return;
      }
      const rpcId = typeof envelope?.rpcId === 'string' ? envelope.rpcId : 'invalid-request';
      const reply = (result) => send(response, 200, { type: 'server-response', rpcId, result });
      if (envelope?.type !== 'client-request' || envelope.method !== endpoint) {
        reply({ ok: false, error: { code: 'message-rollback/bad-request', message: '请求格式无效。', details: {} } });
        return;
      }
      try {
        reply({ ok: true, value: await dispatch(endpoint, envelope.payload) });
      } catch (error) {
        reply({ ok: false, error: { code: 'message-rollback/failed', message: text(error), details: {} } });
      }
  }

  ctx.effect(registerRoute, 'message-rollback: rpc route');
}

