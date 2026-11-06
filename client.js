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
      cancel: '取消', loading: '正在检查文件改动…', save: '保存并重发', deleteConfirm: '删除', scope: '回滚范围', body: '消息内容',
      editTitle: '编辑消息', deleteTitle: '删除这条消息？',
      editNote: '截断之后的对话，再按新内容重发。',
      deleteNote: '之后的对话会一起删除，无法恢复。',
      filesCount: '已记录 {n} 处文件改动',
      messagesOnly: '只回滚消息', withFiles: '连文件一起回滚',
      fileWarning: '文件会还原到这条消息之前。',
      incomplete: '文件快照已失效，只能回滚消息。',
      running: '当前有未结束的轮次，请先停止运行',
      queued: '排队中的消息会一并作废。',
      noGit: '工作区不在 Git 仓库内：只有 DSH 文件工具的改动可回滚。',
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
      'error.missing-session': '找不到这个会话，它可能已被删除。',
      'error.unknown-endpoint': '未知接口。',
      'error.request-too-large': '请求体过大。',
      'error.bad-request': '请求格式无效。',
      'error.unknown': '操作失败，请重试。',
    };
    const en = {
      edit: 'Edit and resend', remove: 'Delete this message and every following turn', copy: 'Copy', copied: 'Copied',
      'clock.md': '{m}/{d}', 'clock.ymd': '{y}-{m}-{d}',
      cancel: 'Cancel', loading: 'Checking file changes…', save: 'Save and resend', deleteConfirm: 'Delete', scope: 'Rollback scope', body: 'Message text',
      editTitle: 'Edit message', deleteTitle: 'Delete this message?',
      editNote: 'Cuts off later turns, then resends.',
      deleteNote: 'Following turns are deleted too, for good.',
      filesCount: '{n} file changes recorded',
      messagesOnly: 'Messages only', withFiles: 'Messages + files',
      fileWarning: 'Files are restored to their state before this message.',
      incomplete: 'File snapshots are gone; messages only.',
      running: 'A turn is still running — stop it first',
      queued: 'Queued prompts are discarded too.',
      noGit: 'No Git here: only DSH file-tool edits can be rolled back.',
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
      'error.missing-session': 'This conversation no longer exists.',
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
      .dmr-action:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
      .dmr-danger:not(:disabled):hover{color:var(--dsw-alias-state-error-primary)}
      .dmr-layer{position:fixed;inset:0;z-index:1000;pointer-events:none}
      .dmr-pop{position:fixed;z-index:1;box-sizing:border-box;visibility:hidden;pointer-events:auto;padding:14px 14px 12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);box-shadow:var(--dsw-elevation-prominent);font-size:13px;line-height:20px}
      .dmr-pop-edit{width:min(420px,calc(100vw - 16px))}
      .dmr-pop-delete{width:min(320px,calc(100vw - 16px))}
      .dmr-pop[data-ready]{visibility:visible}
      .dmr-pop[data-ready][data-side=bottom]{animation:dmr-drop .15s cubic-bezier(.2,.9,.3,1) both}
      .dmr-pop[data-ready][data-side=top]{animation:dmr-rise .15s cubic-bezier(.2,.9,.3,1) both}
      .dmr-pop:focus{outline:none}
      .dmr-arrow{position:absolute;top:-6px;left:0;box-sizing:border-box;width:11px;height:11px;background:inherit;border:1px solid var(--dsw-alias-border-l2);transform:rotate(45deg);pointer-events:none}
      .dmr-pop[data-side=bottom] .dmr-arrow{border-right-color:transparent;border-bottom-color:transparent}
      .dmr-pop[data-side=top] .dmr-arrow{top:auto;bottom:-6px;border-left-color:transparent;border-top-color:transparent}
      @keyframes dmr-drop{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
      @keyframes dmr-rise{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
      .dmr-head{margin:0 0 8px}
      .dmr-title{font-size:13px;font-weight:600;line-height:19px;margin:0;color:var(--dsw-alias-label-primary)}
      .dmr-note{font-size:12px;line-height:17px;margin:3px 0 0;color:var(--dsw-alias-label-tertiary)}
      .dmr-body{max-height:min(62vh,460px);overflow:auto;overscroll-behavior:contain}
      .dmr-body>:first-child{margin-top:0}
      .dmr-text{display:block;box-sizing:border-box;width:100%;min-height:104px;max-height:220px;resize:vertical;margin:0;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;padding:8px 10px;transition:border-color .12s}
      .dmr-text:hover{border-color:var(--dsw-alias-border-l3)}
      .dmr-text:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
      .dmr-files-block{margin:10px 0 0}
      .dmr-summary{display:flex;align-items:center;gap:7px;width:fit-content;padding:1px 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);cursor:pointer;list-style:none;user-select:none;border-radius:var(--dsw-radius-xs)}
      .dmr-summary::-webkit-details-marker{display:none}
      .dmr-summary:hover{color:var(--dsw-alias-label-primary)}
      .dmr-summary:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}
      .dmr-chevron{width:5px;height:5px;flex:0 0 auto;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .12s}
      .dmr-files-block[open] .dmr-chevron{transform:rotate(45deg)}
      .dmr-files{display:flex;flex-direction:column;gap:2px;max-height:112px;overflow:auto;margin:6px 0 0;padding:0 0 0 12px;list-style:none}
      .dmr-files li{font:11.5px/16px var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere}
      .dmr-scope{display:flex;gap:2px;margin:10px 0 0;padding:2px;background:var(--dsw-alias-interactive-bg-hover);border-radius:calc(var(--dsw-radius-sm) + 1px)}
      .dmr-seg{flex:1 1 0;min-width:0;overflow:hidden;border:0;border-radius:var(--dsw-radius-xs);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:16px;padding:4px 6px;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}
      .dmr-seg:hover{color:var(--dsw-alias-label-primary)}
      .dmr-seg[aria-checked=true]{background:var(--dsw-alias-button-elevated-fill);color:var(--dsw-alias-label-primary);font-weight:500;box-shadow:0 1px 3px rgba(0,0,0,.16),0 0 0 .5px var(--dsw-alias-border-l2)}
      .dmr-seg:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
      .dmr-warning{margin:8px 0 0;font-size:12px;line-height:17px;color:var(--dsw-alias-state-warn-primary)}
      .dmr-error{margin:8px 0 0;font-size:12px;line-height:17px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}
      .dmr-hint{display:flex;align-items:center;gap:6px;margin:8px 0 0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
      .dmr-spinner{width:11px;height:11px;flex:0 0 auto;border:1.5px solid var(--dsw-alias-border-l4);border-top-color:var(--dsw-alias-label-tertiary);border-radius:50%;animation:dmr-spin .8s linear infinite}
      @keyframes dmr-spin{to{transform:rotate(360deg)}}
      .dmr-footer{display:flex;justify-content:flex-end;gap:6px;margin-top:12px}
      .dmr-button{border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12.5px;line-height:18px;padding:5px 10px;white-space:nowrap;cursor:pointer;transition:background .12s,color .12s}
      .dmr-button:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dmr-button:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}
      .dmr-button:disabled{opacity:.45;cursor:not-allowed}
      .dmr-primary{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-weight:500;padding:5px 12px}
      .dmr-primary:not(:disabled):hover{background:var(--dsw-alias-button-primary-hover);color:var(--dsw-alias-label-primary-foreground)}
      .dmr-destructive{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-foreground);font-weight:500;padding:5px 12px}
      .dmr-destructive:not(:disabled):hover{background:var(--dsw-alias-state-error-primary);box-shadow:inset 0 0 0 999px rgba(0,0,0,.12);color:var(--dsw-alias-label-primary-foreground)}
      @media (prefers-reduced-motion:reduce){.dmr-pop[data-ready]{animation:none}.dmr-spinner{animation-duration:2.4s}}
      @media (max-width:480px){.dmr-pop{padding:12px 12px 10px}.dmr-pop-edit,.dmr-pop-delete{width:calc(100vw - 16px)}}
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

    // Popover geometry stays pure so client.test.js can exercise the flip/clamp
    // math without a browser; the markers below delimit the extractable region.
    // #region popover-geometry
    const POP_GAP = 8;
    const POP_MARGIN = 8;
    const ARROW_SIZE = 11;
    const ARROW_INSET = 14;
    const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
    /** Below the trigger when it fits, otherwise above; clamp both axes and the arrow. */
    function placePopover(anchor, pop, view) {
      const roomBelow = view.height - anchor.bottom - POP_GAP - POP_MARGIN;
      const roomAbove = anchor.top - POP_GAP - POP_MARGIN;
      const below = roomBelow >= pop.height || roomBelow >= roomAbove;
      const center = anchor.left + anchor.width / 2;
      const left = clamp(center - pop.width / 2, POP_MARGIN, view.width - pop.width - POP_MARGIN);
      const rawTop = below ? anchor.bottom + POP_GAP : anchor.top - POP_GAP - pop.height;
      const top = clamp(rawTop, POP_MARGIN, view.height - pop.height - POP_MARGIN);
      const arrow = clamp(center - left - ARROW_SIZE / 2, ARROW_INSET, pop.width - ARROW_INSET - ARROW_SIZE);
      return { left: Math.round(left), top: Math.round(top), arrow: Math.round(arrow), below };
    }
    // #endregion

    function Popover({ anchor, kind, title, note, locked, onClose, children, footer }) {
      const ref = React.useRef(null);
      const [layout, setLayout] = React.useState(null);
      const lockedRef = React.useRef(locked);
      lockedRef.current = locked;
      // Measure before paint when the host React supports it, so the popover is
      // never shown at a stale position for a frame. The headless test harness
      // only provides useEffect, hence the fallback.
      const useEffect = typeof React.useLayoutEffect === 'function' ? React.useLayoutEffect : React.useEffect;
      // Mount-only: the popover is unmounted whenever the dialog closes, and a
      // fresh instance id remounts it per open, so the captured anchor is live.
      useEffect(() => {
        const node = ref.current;
        const trigger = anchor;
        const previous = document.activeElement;
        const first = node?.querySelector?.('textarea, button');
        if (first && typeof first.focus === 'function') {
          first.focus();
          if (first.tagName === 'TEXTAREA' && typeof first.setSelectionRange === 'function') first.setSelectionRange(first.value.length, first.value.length);
        }
        let frame = 0;
        const measure = () => {
          if (!node || typeof node.getBoundingClientRect !== 'function') return;
          // Client sizes exclude the scrollbar, so the popover never tucks under it.
          const view = {
            width: document.documentElement?.clientWidth || window.innerWidth || 0,
            height: document.documentElement?.clientHeight || window.innerHeight || 0,
          };
          // A missing or detached trigger (keyboard shortcut, collapsed row)
          // still gets a sensible spot: centred, above the middle of the view.
          const box = typeof trigger?.getBoundingClientRect === 'function' && trigger.isConnected !== false
            ? trigger.getBoundingClientRect()
            : { top: Math.round(view.height * 0.3), bottom: Math.round(view.height * 0.3), left: view.width / 2, width: 0 };
          const next = placePopover(box, node.getBoundingClientRect(), view);
          setLayout((last) => (last !== null && last.left === next.left && last.top === next.top && last.arrow === next.arrow && last.below === next.below ? last : next));
        };
        const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : null;
        const caf = typeof window.cancelAnimationFrame === 'function' ? window.cancelAnimationFrame.bind(window) : null;
        const schedule = raf === null ? measure : () => { if (frame !== 0) return; frame = raf(() => { frame = 0; measure(); }); };
        const onKey = (event) => {
          if (event.key === 'Escape' && !lockedRef.current) { event.preventDefault(); onClose(); return; }
          if (event.key !== 'Tab' || !node) return;
          const items = [...(node.querySelectorAll?.('textarea, input:not(:disabled), button:not(:disabled)') ?? [])];
          if (items.length === 0) { event.preventDefault(); return; }
          const firstItem = items[0];
          const lastItem = items[items.length - 1];
          if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
          else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
        };
        // Click-away dismisses; the trigger is excluded because its own click
        // toggles the popover, and a busy write is never abandoned.
        const onAway = (event) => {
          if (lockedRef.current) return;
          const target = event.target;
          if (!target || node?.contains?.(target) || trigger?.contains?.(target)) return;
          onClose();
        };
        const follow = () => schedule();
        document.addEventListener?.('keydown', onKey);
        document.addEventListener?.('mousedown', onAway, true);
        window.addEventListener?.('scroll', follow, true);
        window.addEventListener?.('resize', follow);
        let observer = null;
        if (typeof ResizeObserver === 'function' && node) { observer = new ResizeObserver(() => schedule()); observer.observe(node); }
        measure();
        return () => {
          document.removeEventListener?.('keydown', onKey);
          document.removeEventListener?.('mousedown', onAway, true);
          window.removeEventListener?.('scroll', follow, true);
          window.removeEventListener?.('resize', follow);
          observer?.disconnect?.();
          if (caf !== null && frame !== 0) caf(frame);
          if (previous?.isConnected !== false) previous?.focus?.();
        };
      }, []);
      const side = layout === null || layout.below ? 'bottom' : 'top';
      return h('div', { className: 'dmr-layer' },
        h('div', {
          className: `dmr-pop dmr-pop-${kind}`,
          role: 'dialog',
          'aria-modal': 'false',
          'aria-label': title,
          tabIndex: -1,
          ref,
          'data-side': side,
          'data-ready': layout === null ? undefined : '',
          style: layout === null ? undefined : { top: `${layout.top}px`, left: `${layout.left}px` },
        },
        h('span', { className: 'dmr-arrow', 'aria-hidden': 'true', style: layout === null ? undefined : { left: `${layout.arrow}px` } }),
        h('div', { className: 'dmr-head' },
          h('h2', { className: 'dmr-title' }, title),
          note ? h('p', { className: 'dmr-note' }, note) : null),
        h('div', { className: 'dmr-body' }, children),
        footer));
    }

    return {
      name: 'dsh-message-rewind',
      inject: ['slots', 'uiWorkspace', 'locale', 'connection', 'sessions'],
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
        // Each open mints an instance id: it keys the popover (a fresh button
        // anchor and a fresh measurement per open) and discards a stale draft.
        let opens = 0;
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

        // 0.2.2 only opens a Session its Client catalog knows. A child the Host
        // creates over RPC enters that catalog through a forwarded
        // Session-added frame that races this reply, so pull the Session list
        // (a refresh) until the row lands before navigating; otherwise
        // `openSession` throws and strands the user on the source conversation.
        async function openCreated(sessionId) {
          const catalogued = () => {
            try {
              return ctx.sessions.list.getSnapshot().byId[sessionId] !== undefined;
            } catch {
              return false;
            }
          };
          for (let attempt = 0; attempt < 10 && !catalogued(); attempt += 1) {
            if (attempt > 0) await new Promise((resolveDelay) => window.setTimeout(resolveDelay, 100));
            await ctx.sessions.refresh().catch(() => {});
          }
          ctx.uiWorkspace.openSession(sessionId);
        }

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
            try {
              await openCreated(result.sessionId);
            } catch (error) {
              // The rollback happened; never retire the source the UI still shows.
              console.warn('[message-rewind] the new conversation could not be opened:', error instanceof Error ? error.message : String(error));
              return;
            }
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

        const isOpenFor = (kind, sessionId, seq) => current !== null && current.kind === kind && current.sessionId === sessionId && current.seq === seq;

        function openEdit(sessionId, seq, text, anchor) {
          const dialog = { token: {}, instance: ++opens, kind: 'edit', sessionId, seq, text, anchor: anchor ?? null, phase: 'edit', busy: false, checking: true, error: null, details: null, abort: new AbortController() };
          publish(dialog);
          void inspectEdit(dialog);
        }

        function openDelete(sessionId, seq, anchor) {
          publish({ token: {}, instance: ++opens, kind: 'delete', sessionId, seq, text: '', anchor: anchor ?? null, phase: 'loading', busy: true, error: null, details: null, abort: new AbortController() });
          void check();
        }

        function RewindDialog() {
          const dialog = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
          // Typing is local until save; the draft belongs to one opening, so a
          // popover reopened for the same message starts from the message text.
          const [draft, setDraft] = React.useState(null);
          if (!dialog) return null;
          const text = draft !== null && draft.instance === dialog.instance ? draft.text : dialog.text;
          const editing = dialog.kind === 'edit';
          const phase = dialog.phase;
          const details = dialog.details;
          const files = details?.files ?? [];
          const blocked = Boolean(details?.unfinished);
          const selected = dialog.withFiles === true;
          const canRollback = details !== null && files.length > 0 && !details.incomplete;
          const spinnerLine = h('p', { className: 'dmr-hint' }, h('span', { className: 'dmr-spinner', 'aria-hidden': 'true' }), t('loading'));
          // Both dialogs ask the same question — how far the rewind reaches — so
          // the scope control is built once. A lost snapshot leaves exactly one
          // possible answer, so no choice is offered at all.
          const scope = canRollback ? h('div', { className: 'dmr-scope', role: 'radiogroup', 'aria-label': t('scope') },
            h('button', {
              className: 'dmr-seg',
              type: 'button',
              role: 'radio',
              'aria-checked': !selected,
              onClick: () => patchIf(dialog.token, { withFiles: false }),
            }, t('messagesOnly')),
            h('button', {
              className: 'dmr-seg',
              type: 'button',
              role: 'radio',
              'aria-checked': selected,
              onClick: () => patchIf(dialog.token, { withFiles: true }),
            }, t('withFiles'))) : null;
          const fileSection = details !== null && (files.length > 0 || details.incomplete) ? h(React.Fragment, null,
            files.length > 0 && h('details', { className: 'dmr-files-block' },
              h('summary', { className: 'dmr-summary' },
                h('span', { className: 'dmr-chevron', 'aria-hidden': 'true' }),
                t('filesCount', { n: files.length })),
              h('ul', { className: 'dmr-files' }, files.map((file, index) => h('li', { key: `${index}:${file}`, title: file }, file)))),
            scope,
            details.incomplete
              ? h('p', { className: 'dmr-warning', role: 'status' }, t('incomplete'))
              : selected ? h('p', { className: 'dmr-hint' }, t('fileWarning')) : null,
            details.git === false ? h('p', { className: 'dmr-hint' }, t('noGit')) : null) : null;
          const content = phase === 'edit'
            ? h(React.Fragment, null,
              h('textarea', {
                className: 'dmr-text',
                value: text,
                disabled: dialog.busy,
                'aria-label': t('body'),
                onChange: (event) => setDraft({ instance: dialog.instance, text: event.target.value }),
              }),
              dialog.checking ? spinnerLine : null,
              fileSection)
            : phase === 'loading' ? spinnerLine : fileSection;
          const primary = phase === 'edit'
            ? h('button', {
              className: 'dmr-button dmr-primary',
              type: 'button',
              disabled: dialog.busy || dialog.checking || text.trim() === '' || blocked,
              onClick: () => {
                patchIf(dialog.token, { text });
                if (details === null) { void inspectEdit(current); return; }
                void execute(canRollback && selected);
              },
            }, t('save'))
            : h('button', {
              className: 'dmr-button dmr-destructive',
              type: 'button',
              disabled: dialog.busy || blocked,
              onClick: () => void execute(canRollback && selected),
            }, t('deleteConfirm'));
          return h(Popover, {
            // Remount per open so the anchor/measurement effect always belongs
            // to the button that is currently being pointed at.
            key: dialog.instance,
            anchor: dialog.anchor ?? null,
            kind: dialog.kind,
            title: editing ? t('editTitle') : t('deleteTitle'),
            note: editing ? t('editNote') : t('deleteNote'),
            locked: dialog.busy && phase !== 'loading',
            onClose: close,
            footer: h('div', { className: 'dmr-footer' },
              h('button', { className: 'dmr-button', type: 'button', onClick: close, disabled: dialog.busy && phase !== 'loading' }, t('cancel')),
              primary),
          },
          h(React.Fragment, null,
            content,
            blocked && h('p', { className: 'dmr-warning', role: 'status' }, t('running')),
            (details?.queued ?? 0) > 0 && h('p', { className: 'dmr-warning', role: 'status' }, t('queued')),
            dialog.error && h('p', { className: 'dmr-error', role: 'alert' }, dialog.error)));
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
          // The freshly clicked button is the anchor the popover points at;
          // clicking the same action again toggles it closed.
          const openFrom = (kind, event) => {
            const anchor = event?.currentTarget ?? null;
            if (isOpenFor(kind, sessionId, data.seq)) { close(); return; }
            if (kind === 'edit') openEdit(sessionId, data.seq, parts.text, anchor);
            else openDelete(sessionId, data.seq, anchor);
          };
          return h('div', { className: 'dmr-row' },
            renderFactorySlot('conversation.chat.user.content', { content, loadImage, facts, interactive: true }),
            h('div', { className: 'dmr-actions' },
              data.time === undefined ? null : h('span', { className: 'dmr-time' }, formatMessageClock(data.time, t)),
              button(IconEdit,
                attachmentBlocked ? t('attachments') : running ? t('running') : t('edit'),
                (event) => openFrom('edit', event),
                { disabled: running || attachmentBlocked }),
              button(IconTrash,
                running ? t('running') : t('remove'),
                (event) => openFrom('delete', event),
                { danger: true, disabled: running }),
              button(copied ? IconCheck : IconCopy,
                copied ? t('copied') : t('copy'),
                () => copyText())));
        }

        ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({ name: 'conversation.chat.node', key: 'user', priority: -1, locale: NS }, UserActions));
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'message-rewind.dialog', locale: NS }, RewindDialog));
      }
    };
  },
});



