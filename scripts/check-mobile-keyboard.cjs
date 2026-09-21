const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../components/desktop-shell.tsx'), 'utf8');
const hook = source.slice(source.indexOf('function useAndroidCaretKeyboardLift()'), source.indexOf('type MusicOverlayController'));
const listeners = new Map();
const styles = new Map();
const attributes = new Set();
const root = {
  style: { setProperty: (k, v) => styles.set(k, v), removeProperty: k => styles.delete(k) },
  toggleAttribute: (k, v) => v ? attributes.add(k) : attributes.delete(k),
  removeAttribute: k => attributes.delete(k),
};
const events = prefix => ({
  addEventListener: (name, fn) => listeners.set(prefix + name, fn),
  removeEventListener: name => listeners.delete(prefix + name),
});
const viewport = { height: 850, offsetTop: 0, scale: 1, ...events('viewport:') };
let queued;
let cleanup;
const document = { documentElement: root, activeElement: null, ...events('document:') };
const window = {
  innerHeight: 850, visualViewport: viewport, matchMedia: () => ({ matches: true }),
  requestAnimationFrame: fn => { queued = fn; return 1; }, cancelAnimationFrame: () => {},
  ...events('window:'),
};
const context = vm.createContext({ window, document, navigator: { userAgent: 'Android Chrome' },
  useEffect: fn => { cleanup = fn(); }, isKeyboardEditableElement: Boolean,
  getKeyboardTargetRect: () => ({ bottom: viewport.height - 8 }) });
vm.runInContext(ts.transpile(hook) + '\nuseAndroidCaretKeyboardLift();', context);
const flush = () => { const fn = queued; queued = null; fn?.(); };
const resize = height => {
  viewport.height = height;
  window.innerHeight = height; // Chrome resizes-content: both viewports shrink.
  listeners.get('viewport:resize')(); flush();
};
const input = {};
document.activeElement = input;
listeners.get('document:focusin')({ target: input }); flush();
resize(560);
assert(attributes.has('data-mobile-keyboard-open'));
assert.equal(styles.get('--mobile-keyboard-height'), '560px');
assert(!styles.has('--mobile-keyboard-lift'));
document.activeElement = null;
listeners.get('document:focusout')(); flush();
assert(attributes.has('data-mobile-keyboard-open'), 'keep fitted during keyboard closing animation');
resize(850);
assert(!attributes.has('data-mobile-keyboard-open'));
assert(!styles.has('--mobile-keyboard-height'));
cleanup();
assert.equal(listeners.size, 0);
const keyboardSource = fs.readFileSync(require('node:path').join(__dirname, '../lib/chat-input-keyboard.ts'), 'utf8');
const keyboardContext = { exports: {} };
vm.runInNewContext(ts.transpile(keyboardSource, { module: ts.ModuleKind.CommonJS }), keyboardContext);
const send = keyboardContext.exports.shouldSendChatInputOnEnter;
assert.equal(send({ key: 'Enter' }, true), true);
assert.equal(send({ key: 'Enter', shiftKey: true }, true), false);
assert.equal(send({ key: 'Enter', nativeEvent: { isComposing: true } }, true), false);
assert.equal(send({ key: 'Enter' }, false), false);
console.log('PASS: Android keyboard fit/close/cleanup and Enter/Shift+Enter/IME handling');
