/**
 * File rewind: turn one recorded change list back into the pre-cut file state.
 *
 * The recorder compares each file at turn start and turn end, so a deletion is
 * representable — `before: true, after: false` — and restoring it means writing
 * the pre-turn text back. This module keeps that math independent of Cordis so
 * it can be tested against a real directory.
 */
import { promises as fsp } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { inversePatch, textSide } from './rewind.js';

const MAX_TEXT_BYTES = 4 * 1024 * 1024;

const text = (error) => (error instanceof Error ? error.message : String(error));

export function insideRoot(root, path) {
  const prefix = root.endsWith(sep) ? root : root + sep;
  return path !== root && path.startsWith(prefix);
}

/** Read one file as UTF-8 text, reporting absence instead of failing. */
export async function readFileState(path, display) {
  let info;
  try {
    info = await fsp.stat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, text: null };
    throw new Error(`无法读取 ${display}：${text(error)}`);
  }
  if (!info.isFile()) throw new Error(`${display} 不是普通文件，未回滚任何文件。`);
  if (info.size > MAX_TEXT_BYTES) throw new Error(`${display} 超过文本回滚上限，未回滚任何文件。`);
  const bytes = await fsp.readFile(path);
  try {
    return { exists: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    throw new Error(`${display} 不是 UTF-8 文本，未回滚任何文件。`);
  }
}

/**
 * Apply one recorded diff backwards: current state in, the state before that turn out.
 * @param state - what is on disk now.
 * @param diff - the recorded text comparison.
 * @returns the state this turn started from.
 */
export function invert(state, diff) {
  if (state.exists !== diff.after) throw new Error(`${diff.display} 在记录之后又被修改过，已停止回滚。`);
  // A file this turn created has nothing to invert: the pre-turn state is absence.
  if (!diff.before) return { exists: false, text: null };
  // A file this turn deleted restores from the removed lines alone.
  if (!diff.after) return { exists: true, text: textSide(true, diff.hunks, false) };
  return { exists: true, text: inversePatch(state.text ?? '', diff.hunks) };
}

async function pruneEmptyParents(path, root) {
  let parent = dirname(path);
  while (insideRoot(root, parent)) {
    try {
      const entries = await fsp.readdir(parent);
      if (entries.length > 0) return;
      await fsp.rmdir(parent);
    } catch {
      return;
    }
    parent = dirname(parent);
  }
}

/**
 * Resolve every touched file to its pre-cut content without touching disk.
 * @param readDiff - reads one recorded comparison; throws when it is unavailable.
 * @param records - `workspace/changes` records in ascending sequence order.
 * @returns per-path plan carrying the current state and the target state.
 */
export async function planRewind(readDiff, records) {
  const targets = new Map();
  for (const { seq, summary } of records) {
    if (!summary) continue;
    const root = resolve(summary.cwd);
    for (let index = 0; index < summary.files.length; index += 1) {
      const file = summary.files[index];
      const path = resolve(root, file.path);
      if (!insideRoot(root, path)) throw new Error(`${file.display} 不在该轮工作区内，未回滚任何文件。`);
      if (!targets.has(path)) targets.set(path, { path, display: file.display, root, steps: [] });
      targets.get(path).steps.push({ seq, index });
    }
  }
  for (const target of targets.values()) {
    target.actual = await readFileState(target.path, target.display);
    let state = { ...target.actual };
    // Newest change first: each diff expects the file as that turn left it.
    for (let index = target.steps.length - 1; index >= 0; index -= 1) {
      const step = target.steps[index];
      try {
        state = invert(state, await readDiff(step.seq, step.index));
      } catch (error) {
        throw new Error(`${target.display}：${text(error)}`);
      }
    }
    target.original = state;
  }
  return targets;
}

async function restoreTargets(done) {
  const failures = [];
  for (const target of [...done].reverse()) {
    try {
      if (!target.actual.exists) await fsp.rm(target.path, { force: true });
      else {
        await fsp.mkdir(dirname(target.path), { recursive: true });
        await fsp.writeFile(target.path, target.actual.text, 'utf8');
      }
    } catch (restoreError) {
      failures.push(`${target.display}：${text(restoreError)}`);
    }
  }
  return failures;
}

/**
 * Write every planned pre-cut content and return an undo restoring the current state.
 * @param targets - the plan from {@link planRewind}.
 * @returns the number of files written and the undo, or throws after undoing a partial write.
 */
export async function applyRewind(targets) {
  const done = [];
  try {
    for (const target of targets.values()) {
      if (target.original.exists) {
        await fsp.mkdir(dirname(target.path), { recursive: true });
        await fsp.writeFile(target.path, target.original.text, 'utf8');
        done.push(target);
      } else if (target.actual.exists) {
        await fsp.rm(target.path);
        done.push(target);
      }
    }
  } catch (error) {
    const failures = await restoreTargets(done);
    if (failures.length) throw new Error(`文件回滚中断，以下文件需人工检查：${failures.join('；')}`);
    throw error;
  }
  for (const target of done) if (!target.original.exists) await pruneEmptyParents(target.path, target.root);
  const undo = async () => {
    const failures = await restoreTargets(done);
    if (failures.length) throw new Error(`文件未能恢复原状，请人工检查：${failures.join('；')}`);
  };
  return { written: done.length, undo };
}
