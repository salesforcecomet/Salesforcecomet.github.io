// Regression tests for the Export/Import/Limits/Metadata tab slide transition
// (src/nav-slide.js):
//   1. Entrance: arriving from a known previous page slides in from the right
//      (forward in tab order) or left (backward); no previous page = no motion.
//   2. Exit: clicking a tab link is intercepted (capture phase), the page
//      slides out toward the destination, and navigation is delayed.
//   3. New-tab gestures, non-tab links and prefers-reduced-motion are skipped.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// ── Minimal fake DOM ───────────────────────────────────────────────────────
function makeEnv({ path, prev, reduced = false }) {
  const classes = new Set();
  let domContentLoaded = null;
  let clickCapture = null;
  const timeouts = [];

  const fakeDoc = {
    readyState: 'loading',
    documentElement: {
      classList: {
        add: (c) => classes.add(c),
        contains: (c) => classes.has(c)
      }
    },
    addEventListener(evt, fn) {
      if (evt === 'DOMContentLoaded') domContentLoaded = fn;
      else if (evt === 'click') clickCapture = fn;
    }
  };

  const store = new Map();
  if (prev) store.set('sfir_nav_prev_page', prev);  const searchIdx = path.indexOf('?');
  const pathname = searchIdx >= 0 ? path.slice(0, searchIdx) : path;
  const search = searchIdx >= 0 ? path.slice(searchIdx) : '';
  const fakeWindow = {
    location: { pathname, search },
    sessionStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; }
  };
  fakeWindow.location.href = pathname + search;

  return { fakeDoc, fakeWindow, classes, timeouts, store, get domContentLoaded() { return domContentLoaded; }, get clickCapture() { return clickCapture; } };
}

function runModule(env) {
  const code = fs.readFileSync('src/nav-slide.js', 'utf8');
  const fn = new Function('document', 'window', code);
  fn(env.fakeDoc, env.fakeWindow);
  env.domContentLoaded(); // boot (readyState was 'loading')
}

// The entrance slide is applied on a deferred rAF (so it doesn't fight the
// first paint); the fake env has no rAF, so it falls back to setTimeout(0).
// Flush those timers to let the deferred entrance class land.
function flushTimers(env) {
  while (env.timeouts.length) {
    const t = env.timeouts.shift();
    t.fn();
  }
}

function clickEvent(target, opts = {}) {
  const evt = {
    button: opts.button === undefined ? 0 : opts.button,
    metaKey: !!opts.metaKey,
    ctrlKey: !!opts.ctrlKey,
    shiftKey: !!opts.shiftKey,
    altKey: !!opts.altKey,
    prevented: false,
    stopped: false,
    target,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; }
  };
  return evt;
}

function linkEl(href, page) {
  return {
    tagName: 'A',
    getAttribute(name) { return name === 'href' ? href : null; },
    closest(sel) { return sel === '.slds-builder-header__item-action' ? this : null; }
  };
}

console.log('== 1. Entrance direction ==');
{
  const env = makeEnv({ path: '/data-import.html', prev: 'data-export' });
  runModule(env);
  flushTimers(env);
  check('forward: enters from the right', env.classes.has('sfir-page-enter-right'));
  check('forward: no left class', !env.classes.has('sfir-page-enter-left'));
}
{
  const env = makeEnv({ path: '/data-import.html', prev: 'metadata-exporter' });
  runModule(env);
  flushTimers(env);
  check('backward: enters from the left', env.classes.has('sfir-page-enter-left'));
  check('backward: no right class', !env.classes.has('sfir-page-enter-right'));
}
{
  const env = makeEnv({ path: '/data-import.html', prev: null });
  runModule(env);
  check('direct open (no prev): no animation', env.classes.size === 0);
}
{
  const env = makeEnv({ path: '/data-import.html', prev: 'data-import' });
  runModule(env);
  check('same page reload: no animation', env.classes.size === 0);
}
{
  const env = makeEnv({ path: '/data-import.html', prev: 'data-export', reduced: true });
  runModule(env);
  check('reduced motion: no entrance animation', env.classes.size === 0);
}

console.log('== 2. Exit interception ==');
function runExit(path, href, expectClass) {
  const env = makeEnv({ path, prev: null });
  runModule(env);
  const evt = clickEvent(linkEl(href, null));
  env.clickCapture(evt);
  env.timeouts[0] && env.timeouts[0].fn(); // fire the delayed navigation
  return { env, evt };
}
{
  // Export (index 0) is LEFT of Import (index 1): moving backward slides right.
  const { env, evt } = runExit('/data-import.html', 'data-export.html?host=abc');
  check('backward click: default prevented', evt.prevented);
  check('backward click: slides out to the right', env.classes.has('sfir-page-exit-right'));
  check('backward click: records prev page', env.store.get('sfir_nav_prev_page') === 'data-import');
  check('backward click: navigation scheduled after animation', env.timeouts.length === 1 && env.timeouts[0].ms >= 210);
  check('backward click: navigates to the right page', env.fakeWindow.location.href === 'data-export.html?host=abc');
}
{
  // Metadata (index 3) is RIGHT of Import (index 1): moving forward slides left.
  const { env } = runExit('/data-import.html', 'metadata-exporter.html?host=abc');
  check('forward click: slides out to the left', env.classes.has('sfir-page-exit-left'));
}
{
  // Static-page style: data-page attribute, no href. Metadata (index 3) is
  // RIGHT of Limits (index 2): moving forward slides left.
  const env = makeEnv({ path: '/org-limits.html?host=abc', prev: null });
  runModule(env);
  const a = {
    tagName: 'A',
    getAttribute(name) { return name === 'data-page' ? 'metadata' : null; },
    closest(sel) { return sel === '.slds-builder-header__item-action' ? this : null; }
  };
  const evt = clickEvent(a);
  env.clickCapture(evt);
  check('data-page click: prevented + slides left', evt.prevented && env.classes.has('sfir-page-exit-left'));
  check('data-page click: href rebuilt from current query', (env.timeouts[0].fn(), env.fakeWindow.location.href === 'metadata-exporter.html?host=abc'));
}

console.log('== 3. Same-tab clicks (no reload) ==');
{
  // Clicking the tab you're already on must swallow the click: no reload,
  // no exit animation, no navigation.
  const env = makeEnv({ path: '/data-import.html', prev: null });
  runModule(env);
  const evt = clickEvent(linkEl('data-import.html?host=abc', null));
  env.clickCapture(evt);
  check('same-tab click: default prevented (no reload)', evt.prevented);
  check('same-tab click: propagation stopped', evt.stopped);
  check('same-tab click: no exit animation', env.classes.size === 0);
  check('same-tab click: no navigation scheduled', env.timeouts.length === 0);
  check('same-tab click: href unchanged', env.fakeWindow.location.href === '/data-import.html');
}
{
  // Static-page style (data-page on the current page) must also be swallowed.
  const env = makeEnv({ path: '/org-limits.html?host=abc', prev: null });
  runModule(env);
  const a = {
    tagName: 'A',
    getAttribute(name) { return name === 'data-page' ? 'limits' : null; },
    closest(sel) { return sel === '.slds-builder-header__item-action' ? this : null; }
  };
  const evt = clickEvent(a);
  env.clickCapture(evt);
  check('same-tab data-page click: prevented', evt.prevented);
  check('same-tab data-page click: no navigation', env.timeouts.length === 0 && env.fakeWindow.location.href === '/org-limits.html?host=abc');
}

console.log('== 4. Non-intercepted clicks ==');
{
  const env = makeEnv({ path: '/data-import.html', prev: null });
  runModule(env);
  const evt = clickEvent(linkEl('data-export.html?host=abc', null), { ctrlKey: true });
  env.clickCapture(evt);
  check('ctrl+click (new tab): not intercepted', !evt.prevented && env.classes.size === 0 && env.timeouts.length === 0);
}
{
  const env = makeEnv({ path: '/data-import.html', prev: null });
  runModule(env);
  const badge = { tagName: 'A', getAttribute: () => null, closest: () => null };
  const evt = clickEvent(badge);
  env.clickCapture(evt);
  check('non-nav link: not intercepted', !evt.prevented && env.timeouts.length === 0);
}
{
  const env = makeEnv({ path: '/data-import.html', prev: null });
  runModule(env);
  const evt = clickEvent(linkEl('https://salesforce.com/home', null));
  env.clickCapture(evt);
  check('external link: not intercepted', !evt.prevented && env.timeouts.length === 0);
}
{
  const env = makeEnv({ path: '/data-import.html', prev: null, reduced: true });
  runModule(env);
  const evt = clickEvent(linkEl('data-export.html?host=abc', null));
  env.clickCapture(evt);
  check('reduced motion: no exit class', env.classes.size === 0);
  check('reduced motion: navigates immediately', env.timeouts.length === 0);
}

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
