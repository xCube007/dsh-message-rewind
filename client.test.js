/**
 * Headless smoke test for the client half: it installs against a stubbed Cordis
 * context, then renders the message actions and the confirmation dialog with a
 * minimal React stand-in. No browser and no real React are involved.
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
const primitives = {
  Tooltip: (props) => props.children,
  writeClipboard: () => Promise.resolve(true),
  IconEditOutlineRegular: 'IconEdit',
  IconTrashOutlineRegular: 'IconTrash',
  IconCopyOutlineRegular: 'IconCopy',
  IconCheckOutlineRegular: 'IconCheck',
};

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
};
globalThis.window = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
  __ModuleLoader__: { load: (definition) => { globalThis.__definition = definition; } },
};
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: () => Promise.resolve() } }, configurable: true });
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
          : { files: [], incomplete: false, unfinished: false };
        return Promise.resolve({ ok: true, value });
      },
    },
  },
  uiWorkspace: {
    openSession: (id) => calls.push(['openSession', id]),
  },
  slots: {
    inject: (name, callback) => { callback(); return () => {}; },
    register: (options, component) => { registrations.push({ options, component }); return () => {}; },
  },
};

const originalError = globalThis.console.error;
globalThis.console.error = (...args) => { throw args[0]; };
new Function('window', source)(globalThis.window);
const definition = globalThis.__definition;
assert.equal(definition.id, '@cube007/dsh-message-rollback');
const plugin = definition.factory((id) => {
  if (id === 'react') return react;
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
  throw new Error(`unexpected require: ${id}`);
});
assert.equal(plugin.name, '@cube007/dsh-message-rollback');
assert.deepEqual(plugin.inject, ['slots', 'uiWorkspace', 'locale', 'connection']);
plugin.apply(ctx);
globalThis.console.error = originalError;

assert.equal(styleTags.length, 1, 'one stylesheet is inserted');
assert.deepEqual(calls.filter((call) => call[0] === 'locale.register').map((call) => call[2]), ['zh', 'en']);
const nodeRegistration = registrations.find((entry) => entry.options.key === 'user');
const overlayRegistration = registrations.find((entry) => entry.options.id === 'message-rollback.dialog');
assert.ok(nodeRegistration, 'the user chat node renderer is registered');
assert.ok(overlayRegistration, 'the overlay dialog is registered');

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
assert.equal(buttons.length, 4, 'clock plus edit, delete and copy');
const inner = buttons.slice(1).map((tooltip) => tooltip.children[0]);
assert.deepEqual(inner.map((button) => button.children[0].type), ['IconEdit', 'IconTrash', 'IconCopy']);
const [editButton, deleteButton] = inner;
assert.equal(editButton.props.className, 'dmr-action');
assert.match(deleteButton.props.className, /dmr-danger/);
assert.ok(renderUser(data, true).children[1].children[1].children[0].props.disabled, 'a running turn disables edit');

// --- edit flow --------------------------------------------------------------
const renderDialog = () => { react.__enter('dialog'); return overlayRegistration.component({}); };
editButton.props.onClick();
renderDialog();
let dialog = renderDialog();
assert.ok(dialog, 'edit opens the dialog');
assert.equal(queryAll(dialog, (element) => element.type === 'textarea').at(0).props.value, 'hello');
const footer = () => queryAll(renderDialog(), (element) => element.props?.className === 'dmr-footer').at(-1);
footer().children.at(-1).props.onClick();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(calls.filter((call) => call[0] === 'rpc.call').at(0)[2], 'inspect');
assert.deepEqual(calls.filter((call) => call[0] === 'rpc.call').at(0)[3], { sessionId: 'session-1', seq: 7 });
await new Promise((resolve) => setImmediate(resolve));
assert.ok(!renderDialog(), 'a clean edit closes the dialog after forking');
assert.deepEqual(calls.filter((call) => call[0] === 'openSession'), [['openSession', 'child-1']], 'the branch is opened');
await new Promise((resolve) => setTimeout(resolve, 400));
const purged = calls.filter((call) => call[0] === 'rpc.call' && call[2] === 'purge').at(-1);
assert.deepEqual(purged[3], { sessionId: 'session-1' }, 'the untouched source is retired');

// --- delete flow ------------------------------------------------------------
deleteButton.props.onClick();
await new Promise((resolve) => setImmediate(resolve));
dialog = renderDialog();
assert.ok(dialog, 'delete opens the dialog');
const deleteFooter = queryAll(dialog, (element) => element.props?.className === 'dmr-footer').at(-1);
const deleteButtons = deleteFooter.children.filter(Boolean);
assert.equal(deleteButtons.length, 2, 'cancel plus messages-only');
deleteButtons.at(-1).props.onClick();
await new Promise((resolve) => setImmediate(resolve));
const execute = calls.filter((call) => call[0] === 'rpc.call' && call[2] === 'execute').at(-1);
assert.deepEqual(execute[3], { sessionId: 'session-1', seq: 7, action: 'delete', text: '', rollbackFiles: false });
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(calls.filter((call) => call[0] === 'openSession').at(-1), ['openSession', 'child-1']);

console.log('client self-check passed');


