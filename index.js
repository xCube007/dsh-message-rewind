import { promises as fsp } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { prepareCut, userError } from './rewind.js';
import { planRewind, applyRewind } from './files.js';

const MAX_BODY_BYTES = 1024 * 1024;
const CHANNEL = '/message-rewind';
const DIFF_TIMEOUT = 30_000;
/** Matches the `$DSH_HOME` > `~/.dsh` resolution the harness itself uses, where a blank override counts as unset. */
const SESSIONS_ROOT = join(process.env.DSH_HOME?.trim() ? process.env.DSH_HOME : join(homedir(), '.dsh'), 'sessions');
/** The harness mints `session-<uuid>`; refuse anything that could address a path. */
const SESSION_ID = /^session-[0-9a-zA-Z]+(?:-[0-9a-zA-Z]+)*$/;

export const inject = ['sessionController', 'sessionQuery', 'workspaceChanges', 'workspaceController', 'connection', 'webServer'];

const text = (error) => (error instanceof Error ? error.message : String(error));

function diffTimeout() {
  return AbortSignal.timeout(DIFF_TIMEOUT);
}

/** Whether a value is a session id this plugin may address on disk. */
export function validSessionId(sessionId) {
  return typeof sessionId === 'string' && SESSION_ID.test(sessionId);
}

/**
 * Locate one session's on-disk directory. A workspace session lives under its
 * cwd slug; a session without a cwd sits directly in the sessions root.
 *
 * The id is validated and the resolved path is confined to the root, so a
 * crafted id can never make `purge` delete a directory outside the sessions
 * tree.
 * @param root - sessions root directory.
 * @param sessionId - durable session identity.
 * @returns the real directory, or undefined when it is absent or outside the root.
 */
export async function sessionDirectory(root, sessionId) {
  if (!validSessionId(sessionId)) return undefined;
  let realRoot;
  try {
    realRoot = await fsp.realpath(root);
  } catch {
    return undefined;
  }
  let entries;
  try {
    entries = await fsp.readdir(realRoot, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const candidates = [join(realRoot, sessionId)];
  for (const entry of entries) {
    if (entry.isDirectory()) candidates.push(join(realRoot, entry.name, sessionId));
  }
  for (const candidate of candidates) {
    let real;
    try {
      real = await fsp.realpath(candidate);
    } catch {
      continue;
    }
    if (basename(real) !== sessionId) continue;
    const relativePath = relative(realRoot, real);
    if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) continue;
    const parts = relativePath.split(sep);
    if (parts.length > 2) continue;
    return real;
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
    // `dirname` reaches a fixed point (`.` or the filesystem root) even for a
    // relative cwd, where joining `..` would never end the walk.
    const parent = dirname(current);
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
    if (!diff) throw userError('snapshot-missing', '文件改动快照已不可用，未回滚任何文件。');
    // Oversized text is refused by the recorder before it can be compared; it
    // is not binary, so report the size limit instead of the encoding.
    if (diff.kind === 'oversized') throw userError('oversized-file', `文件超过回滚大小上限：${diff.display}`);
    if (diff.kind !== 'text') throw userError('binary-file', `只能回滚文本文件：${diff.display}`);
    if (diff.coarse) throw userError('coarse-diff', `改动过大，无法安全回滚：${diff.display}`);
    return diff;
  }

  /**
   * Read one session's recorded events and creation metadata without activating
   * it. DSH 0.2.2 replaced `sessionController.inspect` with the cold-safe
   * `sessionQuery.readSession`, whose `session` field is the Session header.
   * @param sessionId - session whose durable log is read.
   * @returns the full event log and the metadata the cut needs.
   */
  async function readInspection(sessionId) {
    let read;
    try {
      read = await ctx.sessionQuery.readSession(sessionId);
    } catch (error) {
      if (error?.code === 'SESSION_QUERY_SESSION_NOT_FOUND') throw userError('missing-session', '找不到这个会话，它可能已被删除。');
      throw error;
    }
    return { events: read.events, meta: { cwd: read.session.cwd, agentPreset: read.session.agentPreset } };
  }

  async function load(sessionId, seq) {
    const inspection = await readInspection(sessionId);
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
      // The recorder caps `files` at its maxFiles budget while `total` counts
      // every changed file; the surplus cannot be read back, so the snapshot is
      // not complete and rolling files back would silently leave some changed.
      if (summary.total > summary.files.length) incomplete = true;
      // A path outside the session working directory is stored absolute; the
      // rewind plan refuses it, so the dialog must not offer a file rollback.
      if (summary.files.some((file) => isAbsolute(file.path))) incomplete = true;
      for (const file of summary.files) files.set(`${summary.cwd}\0${file.path}`, file.display);
    }
    return { files: [...files.values()], incomplete };
  }

  /** Read every recorded diff and compute the pre-cut content without touching disk. */
  const plan = (sessionId, records) => planRewind((seq, index) => readDiff(sessionId, seq, index), records);

  /** The workspace owning one session, when the registry is available. */
  function workspaceFor(sessionId) {
    const registry = ctx.get('workspaceRegistry');
    if (registry === undefined) return undefined;
    return registry.list().find((workspace) => workspace.sessionIds.includes(sessionId));
  }

  async function forkOrCreate(sessionId, boundary, meta) {
    if (boundary !== undefined) {
      const forked = await ctx.sessionController.fork({ sessionId, atSeq: boundary });
      return forked.sessionId;
    }
    // The first-message cut has no boundary to fork at, so it creates a fresh
    // session. A bare `cwd` is not attached to any workspace, while the fork
    // path is: reuse the source workspace so the conversation stays in its group.
    const request = {};
    const workspace = workspaceFor(sessionId);
    if (workspace !== undefined) request.workspaceId = workspace.id;
    else if (meta.cwd !== undefined) request.cwd = meta.cwd;
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
    if (action !== 'delete' && action !== 'edit') throw userError('bad-action', '操作类型无效。');
    const withFiles = request?.rewindFiles === true;
    const { inspection, cut, records } = await load(sessionId, request?.seq);
    if (cut.hasOpenTurn) throw userError('open-turn', '请先停止当前运行，再编辑或回滚消息。');
    if (action === 'edit' && cut.content.some((block) => block.type !== 'text')) throw userError('attachments', '含附件的消息暂时只能回滚，不能编辑。');
    let content = cut.content;
    if (action === 'edit') {
      const replacement = typeof request?.text === 'string' ? request.text.trim() : '';
      if (replacement === '') throw userError('empty-message', '消息不能为空。');
      content = [{ type: 'text', text: replacement }];
    }
    let restored = 0;
    let undo = null;
    if (withFiles) {
      if (describe(records).incomplete) throw userError('incomplete-snapshot', '部分文件改动快照不可用或记录不完整，只能回滚消息。');
      if (records.some((record) => record.summary)) {
        if (!inspection.meta.cwd) throw userError('no-workspace', '这个会话没有工作区，只能回滚消息。');
        const targets = await plan(sessionId, records);
        const applied = await applyRewind(targets);
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
   * Detach one live source Session. The store's disposal event closes its
   * persistence writer and makes the harness publish `api-session/removed`, so
   * the log can be deleted after the write handle is gone.
   * @param sessionId - session to detach.
   * @returns true when a live session was detached, false when it was cold.
   * @throws when a live session is still attached afterwards.
   */
  async function detachSession(sessionId) {
    const sessions = ctx.get('sessions');
    const live = sessions?.get?.(sessionId);
    if (live === undefined) return false;
    // Archive used to stop queued work before hiding the session; keep that
    // stop without writing an archive entry.
    try { await ctx.parallel?.('workspace/session-stop', { sessionId }); } catch { /* stop is best effort */ }
    try { await sessions.flush?.(live); } catch { /* the log is about to be deleted */ }
    try {
      const entry = sessions.liveEntryFor?.(live);
      if (entry !== undefined) sessions.detachEntered?.(entry);
    } catch (error) {
      throw new Error(`会话仍在本进程中运行，无法移除：${text(error)}`);
    }
    if (sessions.get?.(sessionId) !== undefined) throw new Error('会话仍在本进程中运行，无法移除。');
    return true;
  }

  /**
   * Drop the traces a deleted source session leaves outside its log: the
   * archived/pinned registry flags, workspace accounting, and projection cache.
   * @param sessionId - deleted session.
   * @param detachedLive - whether {@link detachSession} already published its removal.
   */
  async function cleanupSession(sessionId, detachedLive) {
    if (!detachedLive) {
      try { ctx.emit?.('api-session/removed', sessionId); } catch { /* client refresh is the fallback */ }
    }
    const registry = ctx.get('workspaceRegistry');
    try {
      if (registry?.archivedSessionIds?.includes?.(sessionId) === true) {
        await ctx.workspaceController.unarchiveSession({ sessionId });
      }
    } catch {
      /* a stale archive id is cleaned up by the harness/archive surfaces */
    }
    try {
      if (registry?.pinnedSessionIds?.includes?.(sessionId) === true) {
        await ctx.workspaceController.unpinSession({ sessionId });
      }
    } catch {
      /* a stale pin never renders a row without a session */
    }
    try {
      const table = ctx.get('sessionProjectionCache')?.requireTable?.();
      if (table !== undefined) await table.delete(sessionId);
    } catch {
      /* the projection cache is a fold shortcut, not an authority */
    }
    try {
      for (const workspace of registry?.list?.() ?? []) {
        if (typeof workspace.detachSession === 'function') await workspace.detachSession(sessionId);
      }
    } catch {
      /* stale accounting never shows a row without a live or persisted session */
    }
  }

  /**
   * Remove a rolled-back source session for good. The harness keeps session logs
   * append-only and offers no delete API, so this retires the artifact itself:
   * detach the live Session, delete its directory, and drop its archive flag /
   * workspace accounting / projection cache. The normal path never archives, so
   * repeated rewinds cannot fill the archive with copies of one conversation.
   */
  async function purge(sessionId) {
    const directory = await sessionDirectory(SESSIONS_ROOT, sessionId);
    let detachedLive = false;
    if (directory === undefined) {
      // A log another surface already removed still needs its row cleaned up.
      try { detachedLive = await detachSession(sessionId); } catch { /* remove the row below */ }
      await cleanupSession(sessionId, detachedLive);
      return { removed: false, archivedOnly: false, message: '未找到会话日志目录，未删除任何内容。' };
    }
    if (ctx.get('sessions')?.get?.(sessionId) !== undefined) {
      try {
        detachedLive = await detachSession(sessionId);
      } catch (error) {
        // Leaving a live session with its log is better than deleting the log
        // out from under it; hide the row with the old archive fallback.
        try {
          await ctx.workspaceController.archiveSession({ sessionId, stopActivity: true });
          return { removed: false, archivedOnly: true, message: `${text(error)}，已移出侧边栏` };
        } catch (archiveError) {
          return { removed: false, archivedOnly: false, message: `${text(error)}；${text(archiveError)}` };
        }
      }
    }
    let failure;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await fsp.rm(directory, { recursive: true, force: true });
        failure = undefined;
        break;
      } catch (error) {
        failure = error;
        await delay(250);
      }
    }
    if (failure !== undefined) {
      // Keep the old fallback only when the bytes could not be removed.
      try {
        await ctx.workspaceController.archiveSession({ sessionId, stopActivity: true });
        return { removed: false, archivedOnly: true, message: `日志目录无法删除，已移出侧边栏：${text(failure)}` };
      } catch (archiveError) {
        return { removed: false, archivedOnly: false, message: `日志目录无法删除，且未能移出侧边栏：${text(failure)}；${text(archiveError)}` };
      }
    }
    await cleanupSession(sessionId, detachedLive);
    return { removed: true, archivedOnly: false };
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
      if (!validSessionId(sessionId)) throw userError('invalid-session', '会话标识无效。');
      return ordered(sessionId, () => purge(sessionId));
    }
    throw userError('unknown-endpoint', `未知接口：${endpoint}`);
  }


  async function readBody(request) {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) throw userError('request-too-large', '请求体过大。');
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
        reply({ ok: false, error: { code: 'message-rewind/bad-request', message: '请求格式无效。', details: { rewindCode: 'bad-request' } } });
        return;
      }
      try {
        reply({ ok: true, value: await dispatch(endpoint, envelope.payload) });
      } catch (error) {
        const rewindCode = typeof error?.rewindCode === 'string' ? error.rewindCode : 'unknown';
        reply({ ok: false, error: { code: 'message-rewind/failed', message: text(error), details: { rewindCode } } });
      }
  }

  ctx.effect(registerRoute, 'message-rewind: rpc route');
}

