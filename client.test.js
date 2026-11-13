/**
 * Headless smoke test for the client half: it installs against a stubbed Cordis
 * context, then renders the message actions and the anchored edit/rollback
 * popover with a minimal React stand-in. No browser and no real React are
 * involved; the popover's placement math is pure and tested on its own.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./client.js', import.meta.url), 'utf8');

/** React stand-in that keeps hook state per component slot across renders. */
function makeReact() {
  const states = new Map();
  const refs = new Map();
  let slot = 'none';
  let index = 0;
  return {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    __enter(name) { slot = name; index = 0; },
    useState(initial) {
      const key = `${slot}:${index++}`;
      if (!states.has(key)) states.set(key, typeof initial === 'function' ? initial() : initial);
      return [states.get(key), (next) => { states.set(key, next); }];
    },
    useRef(value) {
      const key = `${slot}:${index++}`;
      if (!refs.has(key)) refs.set(key, { current: value });
      return refs.get(key);
    },
    useMemo: (factory) => { index++; return factory(); },
    useCallback: (fn) => { index++; return fn; },
    useEffect: (effect) => { index++; effect(); },
    useSyncExternalStore: (_subscribe, getSnapshot) => { index++; return getSnapshot(); },
    useId: () => `id${index++}`,
  };
}

const react = makeReact();

function makeElement(name) {
  return { dataset: {}, style: {}, textContent: '', remove() {}, setAttribute() {}, tagName: name };
}

function queryAll(root, predicate, found = []) {
  if (root === null || root === undefined) return found;
  if (Array.isArray(root)) { for (const item of root) queryAll(item, predicate, found); return found; }
  if (typeof root !== 'object') return found;
  if (predicate(root)) found.push(root);
  queryAll(root.children, predicate, found);
  return found;
}

const styleTags = [];
const calls = [];
const registrations = [];
globalThis.document = {
  head: { appendChild: (node) => styleTags.push(node) },
  createElement: (name) => makeElement(name),
  activeElement: null,
  addEventListener() {},
  removeEventListener() {},
  documentElement: { clientWidth: 1280, clientHeight: 800 },
};
globalThis.window = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
  __ModuleLoader__: { load: (definition) => { globalThis.__definition = definition; } },
};
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true });
// The Host's `inspect` answer; the dialog tests below change it to exercise the
// recorded-file and lost-snapshot branches.
let inspectResult = { files: [], incomplete: false, unfinished: false };
const knownSessions = {};
const ctx = {
  effect: (fn) => { fn(); return () => {}; },
  locale: {
    register: (ns, locale, dict) => { calls.push(['locale.register', ns, locale, dict]); return () => {}; },
    bind: (ns) => (key) => `${ns}:${key}`,
  },
  connection: {
    rpc: {
      call: (channel, endpoint, payload) => {
        calls.push(['rpc.call', channel, endpoint, payload]);
        const value = endpoint === 'execute'
          ? { sessionId: 'child-1', restored: 0, sourceSessionId: payload.sessionId }
          : endpoint === 'purge'
            ? { removed: true, archivedOnly: false }
            : inspectResult;
        return Promise.resolve({ ok: true, value });
      },
    },
  },
  uiWorkspace: {
    // 0.2.2 refuses a Session the Client catalog does not know.
    openSession: (id) => {
      if (knownSessions[id] === undefined) throw new Error(`sessions.retain: unknown session ${id}`);
      calls.push(['openSession', id]);
    },
  },
  sessions: {
    list: { getSnapshot: () => ({ byId: knownSessions }) },
    refresh: () => { calls.push(['sessions.refresh']); knownSessions['child-1'] = { sessionId: 'child-1' }; return Promise.resolve(); },
  },
  slots: {
    inject: (name, callback) => { callback(); return () => {}; },
    // 0.2.2 rejects a second keyed entry at the same priority; a lower one shadows.
    register: (options, component) => {
      const clash = registrations.some((entry) => entry.options.name === options.name
        && entry.options.key !== undefined
        && entry.options.key === options.key
        && (entry.options.priority ?? 0) === (options.priority ?? 0));
      if (clash) throw new Error(`keyed slot "${options.name}" already has an entry for key "${options.key}" at priority ${options.priority ?? 0}`);
      registrations.push({ options, component });
      return () => {};
    },
  },
};

const originalError = globalThis.console.error;
globalThis.console.error = (...args) => { throw args[0]; };
// The shipped Chat plugin owns the same keyed seat at the default priority; a
// same-priority second registration is what 0.2.2 refuses.
registrations.push({ options: { name: 'conversation.chat.node', key: 'user', locale: '@deepseek-ai/dsh-client-ui-chat' }, component: () => null });
new Function('window', source)(globalThis.window);
const definition = globalThis.__definition;
assert.equal(definition.id, 'dsh-message-rewind');
const plugin = definition.factory((id) => {
  if (id === 'react') return react;
  throw new Error(`unexpected require: ${id}`);
});
assert.equal(plugin.name, 'dsh-message-rewind');
assert.deepEqual(plugin.inject, ['slots', 'uiWorkspace', 'locale', 'connection', 'sessions']);
plugin.apply(ctx);
globalThis.console.error = originalError;

assert.equal(styleTags.length, 1, 'one stylesheet is inserted');
assert.deepEqual(calls.filter((call) => call[0] === 'locale.register').map((call) => call[2]), ['zh', 'en']);
const nodeRegistration = registrations.find((entry) => entry.options.key === 'user' && entry.options.priority === -1);
const overlayRegistration = registrations.find((entry) => entry.options.id === 'message-rewind.dialog');
assert.ok(nodeRegistration, 'the user chat node renderer is registered');
assert.equal(nodeRegistration.options.priority, -1, 'a lower priority shadows the shipped user row instead of colliding with it');
assert.ok(overlayRegistration, 'the overlay dialog is registered');

// --- both dictionaries stay in step, and unused entries stay gone -----------
const dictionaries = calls.filter((call) => call[0] === 'locale.register').map((call) => call[3]);
assert.deepEqual(Object.keys(dictionaries[0]).sort(), Object.keys(dictionaries[1]).sort(), 'zh and en expose the same keys');
for (const key of ['empty', 'dialog']) {
  assert.equal(key in dictionaries[0], false, `the unused "${key}" translation is gone`);
}
assert.ok('error.oversized-file' in dictionaries[0] && 'error.oversized-file' in dictionaries[1], 'the oversized comparison code is localized');
assert.ok(!Object.values(dictionaries[0]).some((text) => text.includes('只能只')), 'the duplicated 只 in the rollback hint is gone');

// --- render the user message row -------------------------------------------
const rendered = [];
const renderUser = (data, running = false) => {
  react.__enter('user');
  return nodeRegistration.component({
    node: { data },
    sessionId: 'session-1',
    renderFactorySlot: (name, props) => { rendered.push([name, props]); return { type: 'bubble' }; },
    loadImage: () => {},
    useSession: (selector) => selector({ running }),
  });
};
const data = { seq: 7, time: Date.now(), content: [{ type: 'text', text: 'hello' }] };
const tree = renderUser(data);
assert.equal(tree.type, 'div');
assert.equal(tree.props.className, 'dmr-row');
assert.equal(rendered[0][0], 'conversation.chat.user.content');
assert.deepEqual(rendered[0][1].content, { text: 'hello', attachments: [], extraBlocks: [] });
assert.equal(rendered[0][1].interactive, true);
const actions = tree.children[1];
assert.equal(actions.props.className, 'dmr-actions');
const buttons = actions.children.filter(Boolean);
assert.equal(buttons.length, 4, 'clock plus edit, rollback and copy');
const inner = buttons.slice(1);
const [editButton, rollbackButton] = inner;
assert.equal(inner.length, 3, 'edit, rollback and copy');
assert.equal(editButton.props.className, 'dmr-action');
assert.equal(rollbackButton.props.className, 'dmr-action', 'rollback is a regular action, not a destructive one');
const rollbackGlyph = rollbackButton.children[0].type({});
assert.match(rollbackGlyph.children[0].props.d, /^M5\.7 3 3 5\.7/, 'the rollback action uses the undo arrow glyph');
assert.match(actions.children[0].children[0], /^\d{2}:\d{2}$/, 'today shows a 24h clock only');

// an older message carries the localized date prefix, like the shipped row
const oldTree = renderUser({ seq: 9, time: Date.now() - 400 * 24 * 60 * 60 * 1000, content: [{ type: 'text', text: 'old' }] });
assert.match(oldTree.children[1].children[0].children[0], /^message-rewind:clock\.ymd \d{2}:\d{2}$/);
assert.ok(renderUser(data, true).children[1].children[1].props.disabled, 'a running turn disables edit');

// --- an attachment message disables edit just like the host does -----------
const imageTicket = { attachmentId: 'img-1', mediaType: 'image/png', bytes: 1, width: 1, height: 1 };
const imageTree = renderUser({ seq: 8, time: Date.now(), content: [{ type: 'image', attachment: imageTicket }] });
const imageButtons = imageTree.children[1].children.filter(Boolean).slice(1);
assert.equal(imageButtons[0].props.disabled, true, 'attachment messages disable edit');
assert.equal(imageButtons[1].props.disabled, undefined, 'attachment messages stay available for rollback');

// --- the dialog is a popover anchored to the clicked button -----------------
const renderDialog = () => { react.__enter('dialog'); return overlayRegistration.component({}); };
const popoverOf = (element) => {
  if (element?.type?.name === 'Popover') return element;
  return queryAll(element, (candidate) => candidate.type?.name === 'Popover').at(-1) ?? null;
};
// The overlay component returns the popover element; expand it the way React
// would so the rendered tree (head, body, footer) can be inspected.
const expand = (element) => {
  const popover = popoverOf(element);
  if (!popover) return null;
  const children = popover.children.length === 1 ? popover.children[0] : popover.children;
  react.__enter('popover');
  return popover.type({ ...popover.props, children });
};
const treeOf = () => expand(renderDialog());
const clickAction = (element, anchor) => element.props.onClick(anchor === undefined ? undefined : { currentTarget: anchor });
const tick = () => new Promise((resolve) => setImmediate(resolve));

// --- edit flow --------------------------------------------------------------
const editAnchor = { tagName: 'BUTTON', id: 'edit-trigger' };
clickAction(editButton, editAnchor);
const popover = popoverOf(renderDialog());
assert.ok(popover, 'edit opens the popover');
assert.equal(popover.props.kind, 'edit');
assert.equal(popover.props.anchor, editAnchor, 'the popover points at the button that opened it');
assert.equal(popover.props.title, 'message-rewind:editTitle');
assert.equal(popover.props.note, 'message-rewind:editNote', 'one short note instead of a paragraph');
let dialog = treeOf();
let pop = dialog.children[0];
assert.equal(dialog.props.className, 'dmr-layer', 'the popover is not a full-screen dialog');
assert.equal(pop.props.className, 'dmr-pop dmr-pop-edit');
assert.equal(pop.props.role, 'dialog');
assert.equal(pop.props['aria-label'], 'message-rewind:editTitle');
assert.equal(pop.props['data-side'], 'bottom', 'first paint assumes it hangs below the button');
assert.equal(pop.props.style, undefined, 'no coordinates until the browser measures');
assert.equal(pop.children[0].props.className, 'dmr-arrow');
assert.equal(pop.children[1].props.className, 'dmr-head');
assert.equal(pop.children[2].props.className, 'dmr-body');
assert.equal(pop.children[3].props.className, 'dmr-footer');
const textarea = () => queryAll(treeOf(), (element) => element.type === 'textarea').at(0);
assert.equal(textarea().props.value, 'hello', 'the message text is prefilled on the first paint');
textarea().props.onChange({ target: { value: 'hello there' } });
assert.equal(textarea().props.value, 'hello there', 'typing stays local until save');
textarea().props.onChange({ target: { value: 'hello' } });
await tick();
assert.equal(calls.filter((call) => call[0] === 'rpc.call').at(0)[2], 'inspect', 'opening edit inspects file changes');
assert.deepEqual(calls.filter((call) => call[0] === 'rpc.call').at(0)[3], { sessionId: 'session-1', seq: 7 });
const footer = () => queryAll(treeOf(), (element) => element.props?.className === 'dmr-footer').at(-1);
assert.deepEqual(footer().children.filter(Boolean).map((button) => button.children.join('')), [
  'message-rewind:cancel',
  'message-rewind:save',
], 'cancel plus the primary action');
footer().children.filter(Boolean).at(-1).props.onClick();
await tick();
assert.ok(!renderDialog(), 'a clean edit closes the popover after forking');
assert.deepEqual(calls.filter((call) => call[0] === 'openSession'), [['openSession', 'child-1']], 'the branch is opened');
const openedAt = calls.findIndex((call) => call[0] === 'openSession');
const refreshedAt = calls.findIndex((call) => call[0] === 'sessions.refresh');
assert.ok(refreshedAt !== -1 && refreshedAt < openedAt, 'the fresh child is pulled into the client catalog before it is opened');
await new Promise((resolve) => setTimeout(resolve, 400));
const purged = calls.filter((call) => call[0] === 'rpc.call' && call[2] === 'purge').at(-1);
assert.deepEqual(purged[3], { sessionId: 'session-1' }, 'the untouched source is retired');

// --- an edit that recorded file changes offers both rollback scopes ---------
inspectResult = { files: ['test.txt', 'src/app.js'], incomplete: false, unfinished: false };
clickAction(editButton, editAnchor);
await tick();
dialog = treeOf();
const disclosure = queryAll(dialog, (element) => element.type === 'details').at(0);
assert.equal(disclosure.props.className, 'dmr-files-block', 'the recorded files start collapsed');
assert.equal(queryAll(disclosure, (element) => element.type === 'summary').at(0).children[1], 'message-rewind:filesCount');
assert.deepEqual(
  queryAll(disclosure, (element) => element.type === 'li').map((item) => item.children.join('')),
  ['test.txt', 'src/app.js'],
  'the recorded files are listed');
const scope = queryAll(dialog, (element) => element.props?.role === 'radio');
assert.equal(scope.length, 2, 'edit offers the shared scope control');
assert.equal(scope[0].props['aria-checked'], true, 'messages-only is the default');
assert.deepEqual(scope.map((option) => option.children.join('')), [
  'message-rewind:messagesOnly',
  'message-rewind:withFiles',
], 'a compact either/or, not two radio lines');
scope[1].props.onClick();
dialog = treeOf();
const scopeAfter = queryAll(dialog, (element) => element.props?.role === 'radio');
assert.equal(scopeAfter[1].props['aria-checked'], true, 'the choice sticks');
assert.equal(queryAll(dialog, (element) => element.props?.className === 'dmr-hint').at(0).children[0], 'message-rewind:fileWarning',
  'the consequence is only spelled out once files are chosen');
const scopeButtons = footer().children.filter(Boolean);
scopeButtons.at(-1).props.onClick();
await tick();
assert.deepEqual(
  calls.filter((call) => call[0] === 'rpc.call' && call[2] === 'execute').at(-1)[3],
  { sessionId: 'session-1', seq: 7, action: 'edit', text: 'hello', rewindFiles: true },
  'the edited text is resent after the files roll back');
assert.ok(!renderDialog(), 'the popover closes after rolling back and resending');
await new Promise((resolve) => setTimeout(resolve, 400));

// --- a lost snapshot leaves exactly one choice, so no control is shown ------
inspectResult = { files: [], incomplete: true, unfinished: false };
clickAction(editButton, editAnchor);
await tick();
dialog = treeOf();
assert.equal(queryAll(dialog, (element) => element.props?.className === 'dmr-warning').at(0).children[0], 'message-rewind:incomplete');
assert.equal(queryAll(dialog, (element) => element.props?.role === 'radio').length, 0, 'there is nothing to choose');
const staleButtons = footer().children.filter(Boolean);
assert.equal(staleButtons.length, 2, 'cancel plus the messages-only action');
staleButtons[0].props.onClick();
assert.ok(!renderDialog(), 'cancel closes the stale-snapshot popover');
inspectResult = { files: [], incomplete: false, unfinished: false };

// --- rollback flow ----------------------------------------------------------
const rollbackAnchor = { tagName: 'BUTTON', id: 'rollback-trigger' };
clickAction(rollbackButton, rollbackAnchor);
dialog = treeOf();
pop = dialog.children[0];
assert.equal(pop.props.className, 'dmr-pop dmr-pop-delete', 'the confirm bubble is narrower');
assert.equal(popoverOf(renderDialog()).props.anchor, rollbackAnchor, 'the rollback bubble points at its action button');
assert.equal(popoverOf(renderDialog()).props.note, 'message-rewind:deleteNote');
assert.equal(queryAll(dialog, (element) => element.props?.className === 'dmr-hint').at(0).children[1], 'message-rewind:loading');
const loadingFooter = queryAll(dialog, (element) => element.props?.className === 'dmr-footer').at(0);
const loadingButtons = loadingFooter.children.filter(Boolean);
assert.deepEqual(loadingButtons.map((button) => button.children.join('')), [
  'message-rewind:cancel',
  'message-rewind:deleteConfirm',
], 'the confirm stays put while the files are read');
assert.ok(!loadingButtons[0].props.disabled, 'loading stays cancellable');
assert.equal(loadingButtons[1].props.disabled, true, 'rollback waits for the inspection');
await tick();
dialog = treeOf();
const rollbackFooter = queryAll(dialog, (element) => element.props?.className === 'dmr-footer').at(-1);
const rollbackButtons = rollbackFooter.children.filter(Boolean);
assert.equal(rollbackButtons.length, 2, 'cancel plus rollback');
rollbackButtons.at(-1).props.onClick();
await tick();
const execute = calls.filter((call) => call[0] === 'rpc.call' && call[2] === 'execute').at(-1);
assert.deepEqual(execute[3], { sessionId: 'session-1', seq: 7, action: 'delete', text: '', rewindFiles: false });
await tick();
assert.deepEqual(calls.filter((call) => call[0] === 'openSession').at(-1), ['openSession', 'child-1']);

// --- rollback asks the same question, so it renders the same control --------
inspectResult = { files: ['test.txt'], incomplete: false, unfinished: false };
clickAction(rollbackButton, rollbackAnchor);
await tick();
dialog = treeOf();
const rollbackScope = queryAll(dialog, (element) => element.props?.role === 'radio');
assert.equal(rollbackScope.length, 2, 'rollback offers the same scope control');
assert.equal(rollbackScope[0].props['aria-checked'], true, 'messages-only is the default');
rollbackScope[1].props.onClick();
const rollbackActions = queryAll(treeOf(), (element) => element.props?.className === 'dmr-footer').at(-1).children.filter(Boolean);
assert.deepEqual(rollbackActions.map((button) => button.children.join('')), [
  'message-rewind:cancel',
  'message-rewind:deleteConfirm',
], 'the rollback action follows the chosen scope');
assert.match(rollbackActions.at(-1).props.className, /dmr-primary/, 'rollback uses the primary action style');
rollbackActions.at(-1).props.onClick();
await tick();
assert.deepEqual(
  calls.filter((call) => call[0] === 'rpc.call' && call[2] === 'execute').at(-1)[3],
  { sessionId: 'session-1', seq: 7, action: 'delete', text: '', rewindFiles: true },
  'the chosen file scope reaches the Host');
inspectResult = { files: [], incomplete: false, unfinished: false };

// let the delayed purge settle before the failure-path test swaps the RPC stub
await new Promise((resolve) => setTimeout(resolve, 400));

// --- clicking the open action again toggles the popover ---------------------
clickAction(editButton, editAnchor);
assert.ok(renderDialog(), 'edit opens');
textarea().props.onChange({ target: { value: 'unsent draft' } });
assert.equal(textarea().props.value, 'unsent draft');
clickAction(editButton, editAnchor);
assert.ok(!renderDialog(), 'a second click on the same action closes it');
clickAction(editButton, editAnchor);
assert.equal(textarea().props.value, 'hello', 'a reopened popover starts from the message, not the old draft');
clickAction(editButton, editAnchor);
assert.ok(!renderDialog(), 'and closes again');

// --- host failure codes are localized --------------------------------------
ctx.connection.rpc.call = () => Promise.resolve({
  ok: false,
  error: { message: '请先停止当前运行', details: { rewindCode: 'open-turn' } },
});
clickAction(rollbackButton, rollbackAnchor);
await tick();
const failed = queryAll(treeOf(), (element) => element.props?.className === 'dmr-error').at(0);
assert.equal(failed.children[0], 'message-rewind:error.open-turn');
queryAll(treeOf(), (element) => element.props?.className === 'dmr-footer').at(0).children[0].props.onClick();
assert.ok(!renderDialog(), 'cancel closes the failed popover');

// --- a late response cannot resurrect a closed popover ----------------------
ctx.connection.rpc.call = (channel, endpoint, payload) => {
  calls.push(['rpc.call', channel, endpoint, payload]);
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve({ ok: true, value: { files: [], incomplete: false, unfinished: false } }), 20);
  });
};
clickAction(rollbackButton, rollbackAnchor);
const loadingDialog = treeOf();
assert.ok(loadingDialog, 'rollback opens in the loading phase');
const lateFooter = queryAll(loadingDialog, (element) => element.props?.className === 'dmr-footer').at(0);
lateFooter.children[0].props.onClick();
assert.ok(!renderDialog(), 'the loading phase can be cancelled');
await new Promise((resolve) => setTimeout(resolve, 60));
assert.ok(!renderDialog(), 'the late inspect response does not reopen the popover');

// --- a write in flight keeps its dialog --------------------------------------
let finishExecute;
ctx.connection.rpc.call = (channel, endpoint, payload) => {
  calls.push(['rpc.call', channel, endpoint, payload]);
  if (endpoint === 'execute') {
    return new Promise((resolve) => {
      finishExecute = () => resolve({ ok: true, value: { sessionId: 'child-1', restored: 0, sourceSessionId: payload.sessionId } });
    });
  }
  if (endpoint === 'purge') return Promise.resolve({ ok: true, value: { removed: true, archivedOnly: false } });
  return Promise.resolve({ ok: true, value: { files: [], incomplete: false, unfinished: false } });
};
const executeCalls = () => calls.filter((call) => call[0] === 'rpc.call' && call[2] === 'execute').length;
clickAction(editButton, editAnchor);
await tick();
assert.ok(renderDialog(), 'the edit dialog opens');
const beforeWrite = executeCalls();
footer().children.filter(Boolean).at(-1).props.onClick();
await tick();
assert.ok(renderDialog(), 'the dialog stays up while the write is in flight');
clickAction(rollbackButton, rollbackAnchor);
assert.equal(popoverOf(renderDialog())?.props.kind, 'edit', 'another action cannot replace the busy dialog');
assert.equal(executeCalls(), beforeWrite + 1, 'and starts no second write');
popoverOf(renderDialog()).props.onClose();
assert.ok(renderDialog(), 'a write in flight is not dismissed by Escape or a click outside');
finishExecute();
await tick();
assert.ok(!renderDialog(), 'the finished write closes its dialog');
await new Promise((resolve) => setTimeout(resolve, 400));

// --- placement: below the button, flipped when needed, always on screen -----
const geometry = source.match(/#region popover-geometry([\s\S]*?)#endregion/);
assert.ok(geometry, 'the placement block is marked for extraction');
const { placePopover } = new Function(`${geometry[1]}\nreturn { placePopover };`)();
const wide = { width: 1280, height: 800 };

assert.deepEqual(
  placePopover({ left: 1100, top: 100, width: 28, bottom: 128 }, { width: 320, height: 180 }, wide),
  { left: 952, top: 136, arrow: 157, below: true },
  'hangs 8px below the button, centred on it, clamped to the right edge');
assert.deepEqual(
  placePopover({ left: 600, top: 300, width: 28, bottom: 328 }, { width: 320, height: 180 }, { width: 1280, height: 400 }),
  { left: 454, top: 112, arrow: 155, below: false },
  'flips above the button when the space below is too small');
const edge = placePopover({ left: 8, top: 40, width: 28, bottom: 68 }, { width: 320, height: 180 }, wide);
assert.deepEqual(edge, { left: 8, top: 76, arrow: 14, below: true }, 'the arrow stays clear of the rounded corner');
assert.equal(
  placePopover({ left: 1252, top: 40, width: 28, bottom: 68 }, { width: 320, height: 180 }, wide).arrow,
  295,
  'and clear of the far corner too');
assert.equal(
  placePopover({ left: 600, top: 40, width: 28, bottom: 68 }, { width: 320, height: 900 }, { width: 1280, height: 500 }).top,
  8,
  'an oversized popover pins to the top edge instead of running off screen');

console.log('client self-check passed');
