/* global chrome */
// sfir-shell — persistent top bar for the Export / Import / Limits / Metadata
// tabs. The chrome (tabs, org badge, user chip) is rendered once here; each
// tab is an iframe below the header, lazily created on first visit and kept
// mounted, so switching tabs never reloads the top bar AND never reloads a
// tab body you've already visited (its state is preserved).
//
// ONE bar, not two: each tab's own controls (Tooling/QueryAll toggles + Help
// on Export, Help on Import, Refresh + host pill on Limits/Metadata) are
// rendered INTO this bar's #sfir-shell-utils slot and
// swap when the tab changes. The embedded pages render body-only — no second
// header row. State flows up from the iframes via sfirUtilsState messages;
// user actions flow down via sfirUtilsAction.
import { sfConn } from "./inspector.js";
import { getUserInfo } from "./utils.js";

const TABS = [
  { key: "export", label: "Export", file: "data-export.html" },
  { key: "import", label: "Import", file: "data-import.html" },
  { key: "limits", label: "Limits", file: "org-limits.html" },
  { key: "metadata", label: "Metadata", file: "metadata-exporter.html" }
];

const params = new URLSearchParams(window.location.search);
const host = params.get("host") || params.get("sfHost") || "";
const hostArg = host ? "host=" + encodeURIComponent(host) : "";
const embedArg = "sfirEmbed=1";

const navEl = document.getElementById("sfir-shell-nav");
const hostEl = document.getElementById("sfir-tab-host");
const utilsSlot = document.getElementById("sfir-shell-utils");

let activeTab = TABS.some(t => t.key === params.get("tab")) ? params.get("tab") : "export";

// Latest utilities state reported by each embedded page.
const utilsState = {};
for (const t of TABS) utilsState[t.key] = {};

// ── Logo ───────────────────────────────────────────────────────────────────
const logo = document.getElementById("sfarc-comet-logo");
if (logo) {
  logo.src = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL("icons/icon-48.png")
    : "icons/icon-48.png";
}

// ── Tabs ──────────────────────────────────────────────────────────────────
function tabLink(key) {
  return navEl ? navEl.querySelector('a[data-page="' + key + '"]') : null;
}

function createFrame(tab) {
  const frame = document.createElement("iframe");
  frame.className = "sfir-tab-frame";
  frame.dataset.tab = tab.key;
  // No title on iframe — prevents tooltip popup
  frame.src = tab.file + "?" + [hostArg, embedArg].filter(Boolean).join("&");
  hostEl.appendChild(frame);
  return frame;
}

function positionPill() {
  if (window.__sfarcNavSlide && window.__sfarcNavSlide.position) {
    window.__sfarcNavSlide.position(navEl, -1);
  }
}

function activateTab(key, opts) {
  opts = opts || {};
  if (!key || key === activeTab && !opts.initial) return;
  const fromIndex = TABS.findIndex(t => t.key === activeTab);
  const toIndex = TABS.findIndex(t => t.key === key);
  if (toIndex < 0) return;
  activeTab = key;

  TABS.forEach(t => {
    const a = tabLink(t.key);
    if (a) a.classList.toggle("sfir-nav-active", t.key === key);
  });

  let frame = hostEl.querySelector('iframe[data-tab="' + key + '"]');
  const isNew = !frame;
  if (isNew) frame = createFrame(TABS[toIndex]);
  if (opts.initial) frame.classList.add("sfir-tab-initial");

  // Direction-aware entrance: forward tabs enter from the right, backward
  // from the left (only on user switches, not the initial paint).
  const dir = fromIndex >= 0 && toIndex > fromIndex ? 1 : -1;
  frame.style.setProperty("--sfir-tab-dir", dir);

  hostEl.querySelectorAll("iframe.sfir-tab-frame").forEach(f => {
    if (f === frame) {
      f.classList.remove("outgoing");
      f.classList.add("active");
    } else if (f.classList.contains("active")) {
      f.style.setProperty("--sfir-tab-dir", dir);
      f.classList.remove("active");
      f.classList.remove("sfir-tab-initial");
      f.classList.add("outgoing");
      // Remove outgoing class after animation completes (match CSS duration + buffer)
      setTimeout(() => f.classList.remove("outgoing"), 450);
    }
  });

  positionPill();

  // Swap this tab's controls into the shared bar and ask the page to report
  // its current utilities state (it also pushes on its own when things change).
  renderUtils(key);
  requestUtilsState(key);

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url.toString());
  } catch (e) { /* keep current URL */ }
}

if (navEl) {
  navEl.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest ? e.target.closest('a[data-page]') : null;
    if (!a) return;
    e.preventDefault();
    activateTab(a.dataset.page);
  });
}

// ── Page utilities in the ONE bar ─────────────────────────────────────────
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function wrap(node) {
  const d = el("div", "sfir-shell-utils-item");
  d.appendChild(node);
  return d;
}

function postAction(tabKey, action, value) {
  const frame = hostEl.querySelector('iframe[data-tab="' + tabKey + '"]');
  if (!frame || !frame.contentWindow) return;
  frame.contentWindow.postMessage({ source: "sfir-shell", type: "sfirUtilsAction", action, value }, "*");
}

function requestUtilsState(tabKey) {
  const frame = hostEl.querySelector('iframe[data-tab="' + tabKey + '"]');
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ source: "sfir-shell", type: "sfirUtilsRequest" }, "*");
  }
}

function buildToggle(tabKey, labelText, field, checked, disabled) {
  const label = el("label", "sfir-header-toggle-container");
  label.title = labelText;
  label.appendChild(el("span", null, labelText));
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!checked;
  cb.disabled = !!disabled;
  cb.addEventListener("change", () => postAction(tabKey, field, cb.checked));
  label.appendChild(cb);
  label.appendChild(el("span", "sfir-header-toggle-switch"));
  return wrap(label);
}

function buildHelpButton(tabKey) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "slds-button slds-button_icon slds-button_icon-border-filled sfir-header-icon-btn";
  btn.setAttribute("data-tooltip-side", "bottom");
  btn.title = tabKey === "export" ? "Export Help" : "Data Import Help";
  btn.setAttribute("aria-label", "Help");
  btn.innerHTML = '<svg class="slds-button__icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"></circle><path d="M9.2 9.2a2.8 2.8 0 0 1 5.4.8c0 1.8-2.6 2.5-2.6 3.8"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
  btn.addEventListener("click", () => postAction(tabKey, "help"));
  return wrap(btn);
}

function buildRefreshButton(tabKey, st) {
  const btn = el("button", "sfir-shell-refresh-btn");
  btn.type = "button";
  btn.setAttribute("data-tooltip-side", "bottom");
  btn.title = "Refresh";
  btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Refresh';
  const icon = btn.querySelector("svg");
  if (icon && st.refreshing) icon.classList.add("sfir-shell-refresh-spin");
  btn.addEventListener("click", () => postAction(tabKey, "refresh"));
  return wrap(btn);
}

function renderUtils(tabKey) {
  if (!utilsSlot) return;
  utilsSlot.innerHTML = "";
  const st = utilsState[tabKey] || {};
  if (tabKey === "export") {
    utilsSlot.appendChild(buildToggle("export", "Incremental", "incremental", st.incrementalEnabled, false));
    utilsSlot.appendChild(buildToggle("export", "Tooling API", "tooling", st.queryTooling, st.queryAll));
    utilsSlot.appendChild(buildToggle("export", "QueryAll", "queryAll", st.queryAll, st.queryTooling));
    utilsSlot.appendChild(buildHelpButton("export"));
  } else if (tabKey === "import") {
    utilsSlot.appendChild(buildHelpButton("import"));
  } else if (tabKey === "limits") {
    utilsSlot.appendChild(buildRefreshButton("limits", st));
  } else if (tabKey === "metadata") {
    utilsSlot.appendChild(buildRefreshButton("metadata", st));
  }
}

function syncUtilsValues(tabKey) {
  if (!utilsSlot || tabKey !== activeTab) return;
  const st = utilsState[tabKey] || {};
  if (tabKey === "export") {
    // Templates can be loaded after the iframe becomes ready. Rebuild the
    // small utility bar so the select receives the new option list.
    renderUtils(tabKey);
    return;
  }
  const boxes = utilsSlot.querySelectorAll('input[type="checkbox"]');
  if (boxes.length) {
    boxes[0].checked = !!st.queryTooling;
    boxes[0].disabled = !!st.queryAll;
    if (boxes[1]) {
      boxes[1].checked = !!st.queryAll;
      boxes[1].disabled = !!st.queryTooling;
    }
  }
  const refresh = utilsSlot.querySelector(".sfir-shell-refresh-btn");
  if (refresh) {
    const icon = refresh.querySelector("svg");
    if (icon) icon.classList.toggle("sfir-shell-refresh-spin", !!st.refreshing);
  }
}

window.addEventListener("message", (e) => {
  if (e.origin && e.origin !== window.location.origin) return;
  const msg = e.data;
  if (!msg || typeof msg !== "object" || msg.source !== "sfir-embed") return;
  if (msg.type !== "sfirUtilsState") return;
  if (!TABS.some(t => t.key === msg.tab)) return;
  utilsState[msg.tab] = msg.state || {};
  syncUtilsValues(msg.tab);
});

// ── Session + user chip ───────────────────────────────────────────────────
async function initSession() {
  try {
    await sfConn.getSession(host || null);
  } catch (e) { /* session will surface as an error state */ }

  const instanceHost = sfConn.instanceHostname || host || "";
  const orgName = (instanceHost.split(".")[0] || host || "").toUpperCase();
  const orgEl = document.getElementById("sfarc-nav-org");
  if (orgEl) orgEl.textContent = orgName || host || "Unknown";
  if (instanceHost) {
    const home = document.getElementById("sfarc-home-link");
    if (home) home.href = "https://" + instanceHost;
  }

  try {
    const info = await getUserInfo();
    if (info && info.success) {
      const initials = document.getElementById("sfir-shell-user-initials");
      if (initials) initials.textContent = info.userInitials || "?";
      const name = document.getElementById("sfir-shell-user-name");
      if (name) name.textContent = info.userFullName || "Unknown User";
      const email = document.getElementById("sfir-shell-user-email");
      if (email) email.textContent = info.userName || "";
    }
  } catch (e) { /* non-fatal */ }
}

initSession();
activateTab(activeTab, { initial: true });
