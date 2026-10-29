window.__ModuleLoader__.load({
  id: 'dsh-message-rewind',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'message-rewind';
    const CHANNEL = '/message-rewind';

    const zh = {
      edit: '编辑并重发', remove: '删除这条消息及其后的对话', copy: '复制', copied: '已复制',
      'clock.md': '{m}月{d}日', 'clock.ymd': '{y}年{m}月{d}日',
      cancel: '取消', close: '关闭', loading: '正在检查文件改动…', save: '保存并重发', deleteConfirm: '删除', scope: '回滚范围', body: '消息内容',
      editTitle: '编辑并重新发送', deleteTitle: '删除这条消息？',
      editHint: '将删除这条消息及其后的所有对话，并用修改后的内容重新发送。删除前的记录会被永久删除，无法恢复。',
      deleteHint: '将删除这条消息及其后的所有对话。删除前的记录会被永久删除，无法恢复。',
      hasFiles: '这条消息之后记录到以下文件改动：',
      messagesOnly: '只回滚消息', withFiles: '同时回滚消息和文件',
      fileWarning: '文件会恢复到这条消息之前的内容；若文件之后又被修改，将停止而不会覆盖。',
      incomplete: '部分改动快照已不可用，无法完整回滚文件；仍可以只回滚消息。',
      running: '当前有未结束的轮次，请先停止运行',
      queued: '还有排队中的消息，会随原记录一起作废。',
      noGit: '当前工作区不在 Git 仓库内：只能记录 DSH 文件工具（写/改）动过的文件，shell 命令删除或修改的文件无法回滚。在这个目录执行 git init 后即可完整记录。',
      attachments: '含附件的消息暂时只能删除，不能编辑',
      empty: '消息不能为空', failed: '操作失败，请重试。', dialog: '消息回滚',
      'error.invalid-message': '消息位置无效。',
      'error.stale-message': '这条消息已不在当前对话记录里，请刷新后重试。',
      'error.not-user-message': '只能编辑或删除你发送的消息。',
      'error.file-changed': '文件在记录之后又被修改过，已停止回滚，未覆盖任何文件。',
      'error.unsupported-diff': '这份文件差异暂不支持回滚。',
      'error.file-unreadable': '有文件无法读取，未回滚任何文件。',
      'error.file-too-large': '有文件超过文本回滚上限，未回滚任何文件。',
      'error.file-binary': '有文件不是 UTF-8 文本，未回滚任何文件。',
      'error.file-rewind': '文件回滚失败，未写入任何文件。',
      'error.path-escape': '有文件不在该轮工作区内，未回滚任何文件。',
      'error.file-restore-failed': '文件回滚中断，部分文件需人工检查。',
      'error.snapshot-missing': '文件改动快照已不可用，未回滚任何文件。',
      'error.binary-file': '只能回滚文本文件。',
      'error.coarse-diff': '改动过大，无法安全回滚。',
      'error.bad-action': '操作类型无效。',
      'error.open-turn': '请先停止当前运行，再编辑或删除消息。',
      'error.attachments': '含附件的消息暂时只能删除，不能编辑。',
      'error.empty-message': '消息不能为空。',
      'error.incomplete-snapshot': '部分文件改动快照已不可用，只能只回滚消息。',
      'error.no-workspace': '这个会话没有工作区，只能只回滚消息。',
      'error.invalid-session': '会话标识无效。',
      'error.unknown-endpoint': '未知接口。',
      'error.request-too-large': '请求体过大。',
      'error.bad-request': '请求格式无效。',
      'error.unknown': '操作失败，请重试。',
    };
    const en = {
      edit: 'Edit and resend', remove: 'Delete this message and every following turn', copy: 'Copy', copied: 'Copied',
      'clock.md': '{m}/{d}', 'clock.ymd': '{y}-{m}-{d}',
      cancel: 'Cancel', close: 'Close', loading: 'Checking file changes…', save: 'Save and resend', deleteConfirm: 'Delete', scope: 'Rollback scope', body: 'Message text',
      editTitle: 'Edit and resend', deleteTitle: 'Delete this message?',
      editHint: 'Deletes this message and every following turn, then sends the edited text. The prior record is deleted for good and cannot be restored.',
      deleteHint: 'Deletes this message and every following turn. The prior record is deleted for good and cannot be restored.',
      hasFiles: 'File changes were recorded after this message:',
      messagesOnly: 'Roll back messages only', withFiles: 'Roll back messages and files',
      fileWarning: 'Files are restored to their state before this message. Later edits stop the operation instead of being overwritten.',
      incomplete: 'Some snapshots are unavailable, so files cannot be fully rolled back. Rolling back messages only still works.',
      running: 'A turn is still running — stop it first',
      queued: 'Queued prompts are discarded along with the deleted record.',
      noGit: 'This workspace is not inside a Git repository, so only files touched by DSH write/edit tools are recorded; files changed by shell commands cannot be rolled back. Run git init in this directory to record everything.',
      attachments: 'Messages with attachments can only be deleted, not edited',
      empty: 'Message cannot be empty', failed: 'Operation failed. Please try again.', dialog: 'Message rewind',
      'error.invalid-message': 'Invalid message position.',
      'error.stale-message': 'This message is no longer in the conversation. Refresh and try again.',
      'error.not-user-message': 'Only messages you sent can be edited or deleted.',
      'error.file-changed': 'A file changed after it was recorded, so nothing was rolled back.',
      'error.unsupported-diff': 'This file diff cannot be rolled back.',
      'error.file-unreadable': 'A file could not be read, so nothing was rolled back.',
      'error.file-too-large': 'A file exceeds the text-rollback size limit, so nothing was rolled back.',
      'error.file-binary': 'A file is not UTF-8 text, so nothing was rolled back.',
      'error.file-rewind': 'File rollback failed; nothing was written.',
      'error.path-escape': 'A file lies outside that turn\u2019s workspace, so nothing was rolled back.',
      'error.file-restore-failed': 'File rollback was interrupted; some files need manual checking.',
      'error.snapshot-missing': 'The recorded file snapshot is unavailable, so nothing was rolled back.',
      'error.binary-file': 'Only text files can be rolled back.',
      'error.coarse-diff': 'The change is too large to roll back safely.',
      'error.bad-action': 'Invalid operation.',
      'error.open-turn': 'Stop the running turn before editing or deleting messages.',
      'error.attachments': 'Messages with attachments can only be deleted.',
      'error.empty-message': 'The message cannot be empty.',
      'error.incomplete-snapshot': 'Some file snapshots are unavailable; roll back messages only.',
      'error.no-workspace': 'This conversation has no workspace; roll back messages only.',
      'error.invalid-session': 'Invalid session id.',
      'error.unknown-endpoint': 'Unknown endpoint.',
      'error.request-too-large': 'The request body is too large.',
      'error.bad-request': 'Invalid request.',
      'error.unknown': 'Operation failed. Please try again.',
    };

    const css = `
      .dmr-row{flex-direction:column;align-items:flex-end;gap:6px;display:flex}
      .dmr-actions{height:calc(28px + var(--dsh-content-font-delta,0px));align-items:center;gap:8px;display:flex}
      .dmr-time{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);white-space:nowrap;padding-right:12px}
      .dmr-action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}
      .dmr-action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}
      .dmr-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
      .dmr-action:disabled,.dmr-action[data-unavailable]{cursor:default;opacity:.4}
      .dmr-action:disabled:hover{background:0 0;color:var(--dsw-alias-label-tertiary)}
      .dmr-danger:not(:disabled):hover{color:var(--dsw-alias-state-error-primary)}
      .dmr-mask{position:fixed;inset:0;z-index:1000;pointer-events:auto;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);display:flex;align-items:center;justify-content:center;padding:24px}
      .dmr-modal{box-sizing:border-box;width:min(460px,100%);max-height:calc(100vh - 48px);overflow:auto;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);box-shadow:var(--dsw-elevation-prominent);padding:20px}
      .dmr-title{font-size:16px;font-weight:600;line-height:24px;margin:0 0 10px}
      .dmr-hint{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary);margin:0 0 12px}
      .dmr-text{box-sizing:border-box;width:100%;min-height:140px;resize:vertical;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;line-height:22px;padding:10px 12px}
      .dmr-text:focus{outline:2px solid var(--dsw-focus-ring-color);outline-offset:1px}
      .dmr-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;flex-wrap:wrap}
      .dmr-button{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:7px 12px;cursor:pointer}
      .dmr-button:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dmr-button:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:2px}
      .dmr-button:disabled{opacity:.5;cursor:not-allowed}
      .dmr-primary{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground);font-weight:500}
      .dmr-primary:not(:disabled):hover{background:var(--dsw-alias-button-primary-hover)}
      .dmr-files{margin:0 0 12px;padding:10px 12px;max-height:150px;overflow:auto;background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-md);font:12px/20px var(--ds-font-family-code);color:var(--dsw-alias-label-secondary);list-style:none;overflow-wrap:anywhere}
      .dmr-choice{margin:0 0 12px;display:flex;flex-direction:column;gap:4px}
      .dmr-choice-title{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);margin:0 0 2px}
      .dmr-option{display:flex;align-items:center;gap:8px;font-size:13px;line-height:22px;color:var(--dsw-alias-label-primary);cursor:pointer}
      .dmr-option input{margin:0;accent-color:var(--dsw-alias-button-primary-fill);cursor:pointer}
      .dmr-option-disabled{color:var(--dsw-alias-label-tertiary);cursor:not-allowed}
      .dmr-option-disabled input{cursor:not-allowed}
      .dmr-warning{color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px;margin:10px 0}
      .dmr-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin:12px 0;overflow-wrap:anywhere}
      @media (max-width:480px){.dmr-mask{padding:12px}.dmr-modal{padding:16px}.dmr-footer{flex-direction:column}.dmr-button{width:100%}}
    `;

    const pad2 = (value) => String(value).padStart(2, '0');
    /** Match the shipped `formatMessageClock`: 24h clock plus a localized date prefix. */
    function formatMessageClock(time, t, now = Date.now()) {
      const date = new Date(time);
      const current = new Date(now);
      const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
      if (date.getFullYear() === current.getFullYear() && date.getMonth() === current.getMonth() && date.getDate() === current.getDate()) return clock;
      const params = { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
      return `${date.getFullYear() === current.getFullYear() ? t('clock.md', params) : t('clock.ymd', params)} ${clock}`;
    }

    // Own controls instead of requiring a Harness Client package: primitives are
    // not a plugin contract, and a missing export would blank the Chat row.
    const iconProps = { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };
    function IconEdit() { return h('svg', iconProps, h('path', { d: 'M10.4 2.8l2.8 2.8L5 13.8H2.2v-2.8l8.2-8.2z' }), h('path', { d: 'M9 4.2l2.8 2.8' })); }
    function IconTrash() { return h('svg', iconProps, h('path', { d: 'M2.8 4.4h10.4' }), h('path', { d: 'M6.2 4.4V2.8h3.6v1.6' }), h('path', { d: 'M4.4 4.4l.6 8.8h6l.6-8.8' })); }
    function IconCopy() { return h('svg', iconProps, h('rect', { x: '5.4', y: '5.4', width: '7.8', height: '7.8', rx: '1.4' }), h('path', { d: 'M3.4 10.6V4.2a1.4 1.4 0 0 1 1.4-1.4h6.4' })); }
    function IconCheck() { return h('svg', iconProps, h('path', { d: 'M2.8 8.6l3.4 3.2 7-7.4' })); }

    /** Copy text with the same clipboard fallback the host uses; never throws. */
    async function writeClipboard(text) {
      try {
        if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
      } catch { /* fall through to execCommand */ }
      const exec = typeof document.execCommand === 'function' ? document.execCommand.bind(document) : undefined;
      if (exec === undefined) return false;
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(area);
      area.select();
      try { return exec('copy'); } catch { return false; } finally { area.remove(); }
    }

    function contentParts(content) {
      const texts = [];
      const attachments = [];
      const rest = [];
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text);
        else if (block.type === 'image' && block.attachment !== undefined) attachments.push({ type: 'image', image: { attachment: block.attachment } });
        else if (block.type === 'file' && block.attachment !== undefined) attachments.push({ type: 'file', file: block.attachment });
        else rest.push(block);
      }
      return { text: texts.join(''), attachments, rest };
    }

    function Modal({ title, locked, onClose, children }) {
      const ref = React.useRef(null);
      const lockedRef = React.useRef(locked);
      lockedRef.current = locked;
      React.useEffect(() => {
        const previous = document.activeElement;
        const target = ref.current?.querySelector('textarea, button');
        target?.focus();
        if (target?.tagName === 'TEXTAREA' && typeof target.setSelectionRange === 'function') target.setSelectionRange(target.value.length, target.value.length);
        const onKey = (event) => {
          if (event.key === 'Escape' && !lockedRef.current) { event.preventDefault(); onClose(); return; }
          if (event.key !== 'Tab') return;
          const items = [...(ref.current?.querySelectorAll('textarea, input:not(:disabled), button:not(:disabled)') ?? [])];
          if (items.length === 0) { event.preventDefault(); return; }
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('keydown', onKey);
          if (previous?.isConnected !== false) previous?.focus?.();
        };
      }, [onClose]);
      return h('div', { className: 'dmr-mask', onMouseDown: (event) => { if (event.target === event.currentTarget && !lockedRef.current) onClose(); } },
        h('section', { className: 'dmr-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, ref },
          h('h2', { className: 'dmr-title' }, title), children));
    }

    return {
      name: 'dsh-message-rewind',
      inject: ['slots', 'uiWorkspace', 'locale', 'connection'],
      apply(ctx) {
        try {
          install(ctx);
        } catch (error) {
          console.error('[message-rewind] client half failed to install', error);
        }
      },
    };

    function install(ctx) {
      {
        ctx.effect(() => {
          const style = document.createElement('style');
          style.dataset.plugin = 'dsh-message-rewind';
          style.dataset.pluginCss = `${NS}.module.css`;
          style.textContent = css;
          document.head.appendChild(style);
          return () => style.remove();
        }, `${NS}: styles`);
        ctx.effect(() => {
          const disposeZh = ctx.locale.register(NS, 'zh', zh);
          const disposeEn = ctx.locale.register(NS, 'en', en);
          return () => { disposeZh(); disposeEn(); };
        }, `${NS}: dictionaries`);
        const t = (key, params) => ctx.locale.bind(NS)(key, params);

        // Host failures carry a stable code; translate it and fall back to the
        // Host's own message only when the dictionary has no entry.
        const errorText = (error) => {
          const code = error?.rewindCode;
          if (typeof code === 'string') {
            const key = `error.${code}`;
            const translated = t(key);
            if (translated !== key) return translated;
          }
          return error instanceof Error ? error.message : String(error);
        };

        const REQUEST_TIMEOUT = 30_000;
        const remote = (endpoint, payload, signal) => ctx.connection.rpc.call(CHANNEL, endpoint, payload, signal).then((result) => {
          if (!result || result.ok !== true) {
            const error = new Error(result?.error?.message ?? t('failed'));
            if (typeof result?.error?.details?.rewindCode === 'string') error.rewindCode = result.error.details.rewindCode;
            throw error;
          }
          return result.value;
        });

        // A dialog's own AbortController cancels its read; the timeout bounds a
        // hung Host. Both are passed to the official RPC call.
        const signalFor = (request) => {
          const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT) : undefined;
          const abort = request?.abort?.signal;
          if (abort === undefined) return timeout;
          if (timeout === undefined) return abort;
          return typeof AbortSignal.any === 'function' ? AbortSignal.any([abort, timeout]) : timeout;
        };

        let current = null;
        const listeners = new Set();
        const publish = (next) => { current = next; for (const listener of listeners) listener(); };
        const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
        const getSnapshot = () => current;
        // Loading is the only cancellable busy phase: an execute that already
        // reached the Host cannot be safely abandoned from the Client.
        const close = () => {
          if (!current) return;
          if (current.busy && current.phase !== 'loading') return;
          current.abort?.abort();
          publish(null);
        };
        // Every open mints a token; a late response patches only the dialog it
        // belongs to, so a closed or replaced dialog is never resurrected.
        const patchIf = (token, fields) => { if (current !== null && current.token === token) publish({ ...current, ...fields }); };

        async function execute(rewindFiles) {
          const request = current;
          if (!request || request.busy) return;
          const token = request.token;
          patchIf(token, { busy: true, error: null });
          try {
            const result = await remote('execute', {
              sessionId: request.sessionId,
              seq: request.seq,
              action: request.kind,
              text: request.text,
              rewindFiles,
            }, signalFor(request));
            if (current?.token !== token) return;
            if (!result || typeof result.sessionId !== 'string') throw new Error(t('failed'));
            publish(null);
            // Navigate first so the source's client reference is released, then let
            // the host retire its log: the sidebar keeps exactly one conversation.
            ctx.uiWorkspace.openSession(result.sessionId);
            const source = result.sourceSessionId;
            if (typeof source === 'string' && source !== result.sessionId) {
              Promise.resolve()
                .then(() => new Promise((resolveDelay) => window.setTimeout(resolveDelay, 200)))
                .then(() => remote('purge', { sessionId: source }, typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT) : undefined))
                .then((outcome) => {
                  if (!outcome || outcome.removed !== true) console.warn('[message-rewind] source session kept in archive:', outcome?.message ?? 'log not deleted');
                })
                .catch((error) => { console.warn('[message-rewind] purge failed:', error instanceof Error ? error.message : String(error)); });
            }
          } catch (error) {
            patchIf(token, { busy: false, error: errorText(error) });
          }
        }

        async function check() {
          const request = current;
          if (!request) return;
          const token = request.token;
          patchIf(token, { phase: 'loading', busy: true, error: null });
          try {
            const details = await remote('inspect', { sessionId: request.sessionId, seq: request.seq }, signalFor(request));
            if (current?.token !== token) return;
            patchIf(token, { busy: false, details, phase: 'confirm' });
          } catch (error) {
            if (current?.token !== token) return;
            patchIf(token, { busy: false, phase: 'confirm', error: errorText(error) });
          }
        }

        // The edit dialog reads the recorded changes while the user types, so the
        // rollback scope is visible before the first save. `checking` gates the
        // actions without hiding the textarea or locking the dialog.
        async function inspectEdit(request) {
          const token = request.token;
          patchIf(token, { checking: true, error: null });
          try {
            const details = await remote('inspect', { sessionId: request.sessionId, seq: request.seq }, signalFor(request));
            if (current?.token !== token) return;
            patchIf(token, { checking: false, details });
          } catch (error) {
            if (current?.token !== token) return;
            patchIf(token, { checking: false, error: errorText(error) });
          }
        }

        function openEdit(sessionId, seq, text) {
          const dialog = { token: {}, kind: 'edit', sessionId, seq, text, phase: 'edit', busy: false, checking: true, error: null, details: null, abort: new AbortController() };
          publish(dialog);
          void inspectEdit(dialog);
        }

        function openDelete(sessionId, seq) {
          publish({ token: {}, kind: 'delete', sessionId, seq, text: '', phase: 'loading', busy: true, error: null, details: null, abort: new AbortController() });
          void check();
        }

        function RewindDialog() {
          const dialog = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
          const [text, setText] = React.useState('');
          const key = dialog ? `${dialog.sessionId}:${dialog.seq}:${dialog.kind}` : null;
          React.useEffect(() => { setText(dialog?.text ?? ''); }, [key]);
          if (!dialog) return null;
          const editing = dialog.kind === 'edit';
          const phase = dialog.phase;
          const details = dialog.details;
          const files = details?.files ?? [];
          const blocked = Boolean(details?.unfinished);
          const selected = dialog.withFiles === true;
          const canRollback = details !== null && files.length > 0 && !details.incomplete;
          // Both dialogs ask the same question — how far the rewind reaches — and
          // differ only in the action that follows it, so the choice renders once.
          const fileSection = details !== null && (files.length > 0 || details.incomplete) ? h(React.Fragment, null,
            files.length > 0 && h('p', { className: 'dmr-hint' }, t('hasFiles')),
            files.length > 0 && h('ul', { className: 'dmr-files' }, files.map((file, index) => h('li', { key: `${index}:${file}` }, file))),
            h('div', { className: 'dmr-choice', role: 'radiogroup', 'aria-label': t('scope') },
              h('p', { className: 'dmr-choice-title' }, t('scope')),
              h('label', { className: 'dmr-option' },
                h('input', {
                  type: 'radio',
                  name: 'dmr-rollback-scope',
                  checked: !selected,
                  onChange: () => patchIf(dialog.token, { withFiles: false }),
                }),
                t('messagesOnly')),
              h('label', { className: canRollback ? 'dmr-option' : 'dmr-option dmr-option-disabled' },
                h('input', {
                  type: 'radio',
                  name: 'dmr-rollback-scope',
                  checked: selected,
                  disabled: !canRollback,
                  onChange: () => patchIf(dialog.token, { withFiles: true }),
                }),
                t('withFiles'))),
            h('p', { className: 'dmr-warning' }, details.incomplete ? t('incomplete') : t('fileWarning'))) : null;
          const cancelButton = h('button', { className: 'dmr-button', type: 'button', onClick: close, disabled: dialog.busy }, t('cancel'));
          return h(Modal, {
            title: editing ? t('editTitle') : t('deleteTitle'),
            locked: dialog.busy && phase !== 'loading',
            onClose: close,
          },
          phase === 'edit' && h(React.Fragment, null,
            h('p', { className: 'dmr-hint' }, t('editHint')),
            h('textarea', {
              className: 'dmr-text',
              value: text,
              disabled: dialog.busy,
              'aria-label': t('body'),
              onChange: (event) => setText(event.target.value),
            }),
            dialog.checking && h('p', { className: 'dmr-hint' }, t('loading')),
            fileSection),
          phase === 'loading' && h(React.Fragment, null,
            h('p', { className: 'dmr-hint' }, t('loading')),
            h('div', { className: 'dmr-footer' },
              h('button', { className: 'dmr-button', type: 'button', onClick: close }, t('cancel')))),
          phase === 'confirm' && h(React.Fragment, null,
            h('p', { className: 'dmr-hint' }, t('deleteHint')),
            fileSection),
          blocked && h('p', { className: 'dmr-warning', role: 'status' }, t('running')),
          (details?.queued ?? 0) > 0 && h('p', { className: 'dmr-warning', role: 'status' }, t('queued')),
          details?.git === false && h('p', { className: 'dmr-warning', role: 'status' }, t('noGit')),
          dialog.error && h('p', { className: 'dmr-error', role: 'alert' }, dialog.error),
          phase === 'edit' && h('div', { className: 'dmr-footer' },
            cancelButton,
            h('button', {
              className: 'dmr-button dmr-primary',
              type: 'button',
              disabled: dialog.busy || dialog.checking || text.trim() === '' || blocked,
              onClick: () => {
                patchIf(dialog.token, { text });
                if (details === null) { void inspectEdit(current); return; }
                void execute(canRollback && selected);
              },
            }, t('save'))),
          phase === 'confirm' && h('div', { className: 'dmr-footer' },
            cancelButton,
            h('button', {
              className: 'dmr-button dmr-primary',
              type: 'button',
              disabled: dialog.busy || blocked,
              onClick: () => void execute(canRollback && selected),
            }, t('deleteConfirm'))));
        }

        function UserActions({ node, sessionId, renderFactorySlot, loadImage, useSession }) {
          const data = node.data;
          const running = typeof useSession === 'function' ? useSession((snapshot) => snapshot.running === true) : false;
          const [copied, setCopied] = React.useState(false);
          const copyPending = React.useRef(false);
          React.useEffect(() => {
            if (!copied) return undefined;
            const timer = window.setTimeout(() => setCopied(false), 1000);
            return () => window.clearTimeout(timer);
          }, [copied]);
          const parts = React.useMemo(() => contentParts(data?.content ?? []), [data?.content]);
          const content = React.useMemo(() => ({
            text: parts.text,
            attachments: parts.attachments,
            extraBlocks: parts.rest,
            ...(data?.referenceLabels === undefined ? {} : { referenceLabels: data.referenceLabels }),
          }), [parts, data?.referenceLabels]);
          const facts = React.useMemo(() => ({
            ...(data?.referenceLabels === undefined ? {} : { sessionLabels: data.referenceLabels }),
            ...(data?.skillNames === undefined ? {} : { skillNames: data.skillNames }),
          }), [data?.referenceLabels, data?.skillNames]);
          if (typeof data?.seq !== 'number') return null;
          if (typeof renderFactorySlot !== 'function') return h('div', { className: 'dmr-row' }, h('span', null, parts.text));
          const attachmentBlocked = parts.attachments.length > 0 || parts.rest.length > 0;
          const copyText = () => {
            if (copied || copyPending.current) return;
            copyPending.current = true;
            void writeClipboard(parts.text).then((ok) => {
              copyPending.current = false;
              if (ok) setCopied(true);
            });
          };
          // The disabled reason rides `aria-label`/`title`; a disabled action is
          // never reachable, so it cannot be mis-clicked while a turn runs.
          const button = (Icon, label, onClick, options = {}) => h('button', {
            type: 'button',
            className: `dmr-action${options.danger ? ' dmr-danger' : ''}`,
            'aria-label': label,
            'aria-disabled': options.disabled ? true : undefined,
            'data-unavailable': options.disabled ? true : undefined,
            disabled: options.disabled ? true : undefined,
            title: label,
            onClick,
          }, h(Icon, {}));
          return h('div', { className: 'dmr-row' },
            renderFactorySlot('conversation.chat.user.content', { content, loadImage, facts, interactive: true }),
            h('div', { className: 'dmr-actions' },
              data.time === undefined ? null : h('span', { className: 'dmr-time' }, formatMessageClock(data.time, t)),
              button(IconEdit,
                attachmentBlocked ? t('attachments') : running ? t('running') : t('edit'),
                () => openEdit(sessionId, data.seq, parts.text),
                { disabled: running || attachmentBlocked }),
              button(IconTrash,
                running ? t('running') : t('remove'),
                () => openDelete(sessionId, data.seq),
                { danger: true, disabled: running }),
              button(copied ? IconCheck : IconCopy,
                copied ? t('copied') : t('copy'),
                () => copyText())));
        }

        ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'user', locale: NS }, UserActions));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'message-rewind.dialog', locale: NS }, RewindDialog));
      }
    };
  },
});



