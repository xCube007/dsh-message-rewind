window.__ModuleLoader__.load({
  id: '@xcube007/dsh-message-rollback',
  factory(require) {
    const React = require('react');
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;
    const NS = 'message-rollback';
    const CHANNEL = '/message-rollback';

    const zh = {
      edit: '编辑并重发', remove: '删除这条消息及其后的对话', copy: '复制', copied: '已复制',
      cancel: '取消', close: '关闭', loading: '正在检查文件改动…', save: '保存并重发',
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
    };
    const en = {
      edit: 'Edit and resend', remove: 'Delete this message and every following turn', copy: 'Copy', copied: 'Copied',
      cancel: 'Cancel', close: 'Close', loading: 'Checking file changes…', save: 'Save and resend',
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
      empty: 'Message cannot be empty', failed: 'Operation failed. Please try again.', dialog: 'Message rollback',
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
      .dmr-mask{position:fixed;inset:0;z-index:1300;pointer-events:auto;background:var(--dsw-alias-bg-mask-drop);display:flex;align-items:center;justify-content:center;padding:24px}
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
      .dmr-warning{color:var(--dsw-alias-state-warn-primary);font-size:12px;line-height:18px;margin:10px 0}
      .dmr-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin:12px 0;overflow-wrap:anywhere}
      @media (max-width:480px){.dmr-mask{padding:12px}.dmr-modal{padding:16px}.dmr-footer{flex-direction:column}.dmr-button{width:100%}}
    `;

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

    function Modal({ title, busy, onClose, children }) {
      const ref = React.useRef(null);
      React.useEffect(() => {
        const previous = document.activeElement;
        const target = ref.current?.querySelector('textarea, button');
        target?.focus();
        if (target?.tagName === 'TEXTAREA') target.setSelectionRange(target.value.length, target.value.length);
        const onKey = (event) => {
          if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return; }
          if (event.key !== 'Tab') return;
          const items = [...(ref.current?.querySelectorAll('textarea, button:not(:disabled)') ?? [])];
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
      }, [busy, onClose]);
      return h('div', { className: 'dmr-mask', onMouseDown: (event) => { if (event.target === event.currentTarget && !busy) onClose(); } },
        h('section', { className: 'dmr-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, ref },
          h('h2', { className: 'dmr-title' }, title), children));
    }

    return {
      name: '@xcube007/dsh-message-rollback',
      inject: ['slots', 'uiWorkspace', 'locale', 'connection'],
      apply(ctx) {
        try {
          install(ctx);
        } catch (error) {
          console.error('[message-rollback] client half failed to install', error);
        }
      },
    };

    function install(ctx) {
      {
        ctx.effect(() => {
          const style = document.createElement('style');
          style.dataset.plugin = '@xcube007/dsh-message-rollback';
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
        const t = (key) => ctx.locale.bind(NS)(key);

        const remote = (endpoint, payload) => ctx.connection.rpc.call(CHANNEL, endpoint, payload).then((result) => {
          if (!result || result.ok !== true) throw new Error(result?.error?.message ?? t('failed'));
          return result.value;
        });

        let current = null;
        const listeners = new Set();
        const publish = (next) => { current = next; for (const listener of listeners) listener(); };
        const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
        const getSnapshot = () => current;
        const close = () => { if (!current || current.busy) return; publish(null); };
        const patch = (fields) => { if (current) publish({ ...current, ...fields }); };

        async function execute(rollbackFiles) {
          const request = current;
          if (!request || request.busy) return;
          patch({ busy: true, error: null });
          try {
            const result = await remote('execute', {
              sessionId: request.sessionId,
              seq: request.seq,
              action: request.kind,
              text: request.text,
              rollbackFiles,
            });
            if (!result || typeof result.sessionId !== 'string') throw new Error(t('failed'));
            publish(null);
            // Navigate first so the source's client reference is released, then let
            // the host retire its log: the sidebar keeps exactly one conversation.
            ctx.uiWorkspace.openSession(result.sessionId);
            const source = result.sourceSessionId;
            if (typeof source === 'string' && source !== result.sessionId) {
              Promise.resolve()
                .then(() => new Promise((resolveDelay) => window.setTimeout(resolveDelay, 200)))
                .then(() => remote('purge', { sessionId: source }))
                .catch(() => {});
            }
          } catch (error) {
            patch({ busy: false, error: error instanceof Error ? error.message : String(error) });
          }
        }

        async function check() {
          const request = current;
          if (!request) return;
          patch({ phase: 'loading', busy: true, error: null });
          try {
            const details = await remote('inspect', { sessionId: request.sessionId, seq: request.seq });
            const questions = details.files.length > 0 || details.incomplete;
            if (request.kind === 'edit' && !questions && !details.unfinished) {
              patch({ busy: false, details });
              await execute(false);
              return;
            }
            patch({ busy: false, details, phase: questions ? 'choice' : 'confirm' });
          } catch (error) {
            patch({ busy: false, phase: request.kind === 'edit' ? 'edit' : 'confirm', error: error instanceof Error ? error.message : String(error) });
          }
        }

        function openEdit(sessionId, seq, text) {
          publish({ kind: 'edit', sessionId, seq, text, phase: 'edit', busy: false, error: null, details: null });
        }

        function openDelete(sessionId, seq) {
          publish({ kind: 'delete', sessionId, seq, text: '', phase: 'loading', busy: true, error: null, details: null });
          void check();
        }

        function RollbackDialog() {
          const dialog = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
          const [text, setText] = React.useState('');
          const key = dialog ? `${dialog.sessionId}:${dialog.seq}:${dialog.kind}` : null;
          React.useEffect(() => { setText(dialog?.text ?? ''); }, [key]);
          if (!dialog) return null;
          const editing = dialog.kind === 'edit';
          const phase = dialog.phase;
          const details = dialog.details;
          const blocked = Boolean(details?.unfinished);
          return h(Modal, {
            title: editing ? t('editTitle') : t('deleteTitle'),
            busy: dialog.busy,
            onClose: close,
          },
          phase === 'edit' && h(React.Fragment, null,
            h('p', { className: 'dmr-hint' }, t('editHint')),
            h('textarea', {
              className: 'dmr-text',
              value: text,
              disabled: dialog.busy,
              'aria-label': t('edit'),
              onChange: (event) => setText(event.target.value),
            })),
          phase === 'loading' && h('p', { className: 'dmr-hint' }, t('loading')),
          phase === 'confirm' && h('p', { className: 'dmr-hint' }, editing ? t('editHint') : t('deleteHint')),
          phase === 'choice' && h(React.Fragment, null,
            h('p', { className: 'dmr-hint' }, editing ? t('editHint') : t('deleteHint')),
            details.files.length > 0 && h('p', { className: 'dmr-hint' }, t('hasFiles')),
            details.files.length > 0 && h('ul', { className: 'dmr-files' }, details.files.map((file) => h('li', { key: file }, file))),
            h('p', { className: 'dmr-warning' }, details.incomplete ? t('incomplete') : t('fileWarning'))),
          blocked && h('p', { className: 'dmr-warning', role: 'status' }, t('running')),
          (details?.queued ?? 0) > 0 && h('p', { className: 'dmr-warning', role: 'status' }, t('queued')),
          details?.git === false && h('p', { className: 'dmr-warning', role: 'status' }, t('noGit')),
          dialog.error && h('p', { className: 'dmr-error', role: 'alert' }, dialog.error),
          phase === 'edit' && h('div', { className: 'dmr-footer' },
            h('button', { className: 'dmr-button', type: 'button', onClick: close, disabled: dialog.busy }, t('cancel')),
            h('button', {
              className: 'dmr-button dmr-primary',
              type: 'button',
              disabled: dialog.busy || text.trim() === '',
              onClick: () => { patch({ text }); void check(); },
            }, t('save'))),
          (phase === 'confirm' || phase === 'choice') && h('div', { className: 'dmr-footer' },
            h('button', { className: 'dmr-button', type: 'button', onClick: close, disabled: dialog.busy }, t('cancel')),
            h('button', {
              className: 'dmr-button',
              type: 'button',
              disabled: dialog.busy || blocked,
              onClick: () => void execute(false),
            }, editing ? t('save') : t('messagesOnly')),
            phase === 'choice' && h('button', {
              className: 'dmr-button dmr-primary',
              type: 'button',
              disabled: dialog.busy || blocked || details.incomplete,
              title: details.incomplete ? t('incomplete') : t('fileWarning'),
              onClick: () => void execute(true),
            }, t('withFiles'))));
        }

        function UserActions({ node, sessionId, renderFactorySlot, loadImage, useSession }) {
          const data = node.data;
          const running = typeof useSession === 'function' ? useSession((snapshot) => snapshot.running === true) : false;
          const [copied, setCopied] = React.useState(false);
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
          const attachmentBlocked = parts.rest.length > 0;
          const copyText = () => {
            const write = primitives.writeClipboard;
            if (typeof write === 'function') { void write(parts.text).then((ok) => { if (ok) setCopied(true); }); return; }
            navigator.clipboard.writeText(parts.text).then(() => setCopied(true), () => {});
          };
          const button = (name, label, onClick, options = {}) => h(primitives.Tooltip, { label, side: 'bottom' },
            h('button', {
              type: 'button',
              className: `dmr-action${options.danger ? ' dmr-danger' : ''}`,
              'aria-label': label,
              'data-unavailable': options.disabled ? true : undefined,
              disabled: options.disabled ? true : undefined,
              onClick,
            }, h(name, {})));
          return h('div', { className: 'dmr-row' },
            renderFactorySlot('conversation.chat.user.content', { content, loadImage, facts, interactive: true }),
            h('div', { className: 'dmr-actions' },
              data.time === undefined ? null : h('span', { className: 'dmr-time' }, new Date(data.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
              button(primitives.IconEditOutlineRegular,
                attachmentBlocked ? t('attachments') : running ? t('running') : t('edit'),
                () => openEdit(sessionId, data.seq, parts.text),
                { disabled: running || attachmentBlocked }),
              button(primitives.IconTrashOutlineRegular,
                running ? t('running') : t('remove'),
                () => openDelete(sessionId, data.seq),
                { danger: true, disabled: running }),
              button(copied ? primitives.IconCheckOutlineRegular : primitives.IconCopyOutlineRegular,
                copied ? t('copied') : t('copy'),
                () => void copyText())));
        }

        ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'user' }, UserActions));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'message-rollback.dialog' }, RollbackDialog));
      }
    };
  },
});



