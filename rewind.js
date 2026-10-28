/**
 * Pure history math for message rewind: where to cut, what the cut removed,
 * and how to undo a recorded file diff. Kept free of Cordis so it can be tested.
 */

/**
 * Attach a stable code to a user-facing failure so the Client can localize it
 * while the Host keeps a readable fallback message.
 * @param code - stable identifier the Client maps to a dictionary entry.
 * @param message - human-readable fallback text.
 * @returns the tagged error.
 */
export function userError(code, message) {
  return Object.assign(new Error(message), { rewindCode: code });
}

/**
 * Locate one user message and the branch point just before its turn.
 * @param events - a session's event prefix, ordered by `seq`.
 * @param seq - the exact `seq` of the user message to cut at.
 * @returns the message content, the fork boundary (undefined when nothing precedes the turn),
 *   whether the cut spans an open turn, and the `workspace/changes` sequences removed by the cut.
 */
export function prepareCut(events, seq) {
  if (!Number.isSafeInteger(seq) || seq < 0) throw userError('invalid-message', '消息位置无效。');
  const index = new Map(events.map((event, position) => [event.seq, position]));
  const position = index.get(seq);
  const target = position === undefined ? undefined : events[position];
  if (target === undefined) throw userError('stale-message', '这条消息已不在当前对话记录里，请刷新后重试。');
  if (target.type !== 'user/message' || target.data?.source?.kind !== 'user') throw userError('not-user-message', '只能编辑或删除你发送的消息。');
  const content = structuredClone(target.data.content ?? []);
  let boundary = position > 0 ? events[position - 1].seq : undefined;
  for (let cursor = position - 1; cursor >= 0; cursor--) {
    if (events[cursor].type !== 'turn/start') continue;
    boundary = cursor > 0 ? events[cursor - 1].seq : undefined;
    break;
  }
  // A prompt queued while the previous turn ran is a bookkeeping event that sits
  // between that turn and this one. Ending the cut there would hand the branch a
  // still-pending queue item, so step back over those trailing splices.
  while (boundary !== undefined) {
    const previous = index.get(boundary);
    if (previous === undefined || events[previous].type !== 'agent/inbox/spliced') break;
    boundary = previous > 0 ? events[previous - 1].seq : undefined;
  }
  let hasOpenTurn = false;
  for (const event of events) {
    if (event.type === 'turn/start') hasOpenTurn = true;
    else if (event.type === 'turn/end') hasOpenTurn = false;
  }
  const records = events
    .slice(position)
    .filter((event) => event.type === 'workspace/changes')
    .map((event) => event.seq)
    .sort((left, right) => left - right);
  return { content, boundary, hasOpenTurn, records };
}

/**
 * A side's text with its final line terminated. The recorder diffs terminated
 * text, so a file stored without a trailing newline is compared with one.
 */
export function terminated(text) {
  if (text === '') return '';
  return text.endsWith('\n') ? text : `${text}\n`;
}

/**
 * Undo one recorded diff against the current text.
 * A hunk carries only changed and context lines; unrelated trailing lines are retained.
 * @param current - the file's current text.
 * @param hunks - the recorded hunks, in file order.
 * @returns the text as it was before the recorded change.
 */
export function inversePatch(current, hunks) {
  const source = terminated(current);
  const lines = source === '' ? [] : source.slice(0, -1).split('\n').map((line) => `${line}\n`);
  const output = [];
  let cursor = 0;
  for (const hunk of hunks) {
    const start = hunk.newStart === 0 ? 0 : hunk.newStart - 1;
    if (!Number.isSafeInteger(start) || start < cursor || start > lines.length) throw userError('file-changed', '文件版本已改变，未回滚任何文件。');
    output.push(...lines.slice(cursor, start));
    cursor = start;
    for (const line of hunk.lines) {
      const marker = line[0];
      const body = terminated(line.slice(1));
      if (marker === '\\') throw userError('unsupported-diff', '无结尾换行的文件差异暂不支持，未回滚任何文件。');
      if (marker === '+') {
        if (lines[cursor] !== body) throw userError('file-changed', '文件版本已改变，未回滚任何文件。');
        cursor++;
      } else if (marker === '-') {
        output.push(body);
      } else if (marker === ' ') {
        if (lines[cursor] !== body) throw userError('file-changed', '文件版本已改变，未回滚任何文件。');
        output.push(lines[cursor++]);
      } else {
        throw userError('unsupported-diff', '文件差异无法验证，未回滚任何文件。');
      }
    }
  }
  output.push(...lines.slice(cursor));
  return output.join('');
}

/**
 * Rebuild one side of a diff from its hunk lines alone.
 * @param exists - whether that side existed at all.
 * @param hunks - the recorded hunks.
 * @param after - true for the post-change side, false for the pre-change side.
 * @returns that side's text, or null when the file did not exist.
 */
export function textSide(exists, hunks, after) {
  const lines = [];
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      const wanted = after ? line[0] !== '-' : line[0] !== '+';
      if (wanted && line[0] !== '\\') lines.push(terminated(line.slice(1)));
    }
  }
  if (!exists) {
    if (lines.length !== 0) throw userError('unsupported-diff', '文件差异与文件是否存在不一致。');
    return null;
  }
  return lines.join('');
}
