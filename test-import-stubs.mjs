// Minimal browser-ish globals so src/data-import.js can load under Node.
// Only the Model class (which we need to test) is exposed.

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] || null,
  get length() { return store.size; }
};

globalThis.React = { createElement: () => ({}), Component: class {} };
globalThis.initButton = () => {};
globalThis.initTooltips = () => {};
globalThis.ReactDOM = { render: () => {} };
// data-import.js calls bare addEventListener('pagehide', ...) at module top
// level; expose it as a global (window.addEventListener is not enough).
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};

globalThis.window = {
  location: { href: "https://acme.my.salesforce.com/", origin: "https://acme.my.salesforce.com", search: "" },
  addEventListener: () => {},
  removeEventListener: () => {},
  __sfarcSetPanelIndicator: () => {}
};
globalThis.location = globalThis.window.location;
globalThis.document = {
  body: { classList: { add: () => {}, remove: () => {}, contains: () => false } },
  createElement: () => ({
    style: {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    addEventListener: () => {},
    setAttribute: () => {},
    appendChild: () => {},
    removeChild: () => {}
  }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  documentElement: { style: {} }
};
Object.defineProperty(globalThis, "navigator", { value: { userAgent: "node" }, configurable: true });
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
globalThis.chrome = {
  storage: { local: { get: (_k, cb) => cb && cb({}), set: () => {} }, sync: { get: (_k, cb) => cb && cb({}), set: () => {} } },
  runtime: { sendMessage: (_m, cb) => cb && cb(null), getURL: (p) => p },
  tabs: { query: () => {} }
};
globalThis.browser = globalThis.chrome;

// The Model's constructor fires async org lookups (getSobjectsList / user
// info) that hit sfConn against our stub host; keep those from crashing Node.
process.on("unhandledRejection", () => {});

// data-import.js has no exports; grab Model by appending an export via a
// temp copy is messy — instead we re-read the module text and eval it with
// an appended export line. Simpler: use import() then patch from the module's
// class via a trick: the file declares `class Model` at top level of the
// module scope, not reachable. So build a temp copy with an export appended.
import fs from "fs";
import { fileURLToPath } from "url";
const src = fs.readFileSync(new URL("./src/data-import.js", import.meta.url), "utf8");
// Temp copy must live next to src/ so its relative imports resolve.
const tmp = fileURLToPath(new URL("./src/__import_test_tmp.mjs", import.meta.url));
fs.writeFileSync(tmp, src + "\nexport { Model };\n");
const loaded = await import(tmp);
fs.unlinkSync(tmp);
globalThis.__DataImportModel = loaded.Model;
