// cdp-driver.mjs — SHARED real-browser CDP harness for the extension's
// browser-level tests (test-drag-click-browser.mjs, test-shell-tooltip-browser.mjs).
//
// Synthetic PointerEvents cannot capture, so pointer-capture behavior,
// tooltip hover flows, and tab-switch DOM updates can only be verified with
// TRUSTED browser input. This driver launches a throwaway headless Chrome
// (Node ≥22 native WebSocket + fetch, zero npm dependencies) and wraps a CDP
// page session with helpers for navigating, evaluating, and driving input.
//
// Chrome must be installed: CHROME_PATH env var, or the usual macOS/Linux
// locations (see findChrome). Tests that use this driver print SKIP and exit
// 0 when no binary is available.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const c of candidates) {
    try { fs.accessSync(c); return c; } catch { /* keep looking */ }
  }
  return null;
}

// ── Minimal CDP client over the browser WebSocket ─────────────────────────
function cdpConnect(wsUrl) {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(wsUrl); } catch (e) { reject(e); return; }
    const pending = new Map();
    let nextId = 1;
    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}, sessionId) {
          const id = nextId++;
          return new Promise((res, rej) => {
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
          });
        },
        close() { try { ws.close(); } catch { /* already closed */ } }
      });
    });
    ws.addEventListener('error', () => reject(new Error('WebSocket error connecting to ' + wsUrl)));
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); }
      catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    });
  });
}

async function waitForDevToolsPort(profileDir, timeoutMs = 15000) {
  const file = path.join(profileDir, 'DevToolsActivePort');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const txt = fs.readFileSync(file, 'utf8');
      const port = parseInt(txt.split('\n')[0], 10);
      if (port) return port;
    } catch { /* not written yet */ }
    await sleep(100);
  }
  throw new Error('DevToolsActivePort never appeared in ' + profileDir);
}

// Launch a throwaway headless Chrome. Returns null when no binary exists.
export async function launchChrome({ windowSize = '1400,900' } = {}) {
  const chromePath = findChrome();
  if (!chromePath) return null;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sfir-cdp-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--no-sandbox',
    // Wide window: tests that drag wide surfaces need room to actually move
    // (a 760px drawer in a narrow viewport clamps to the edge within px).
    `--window-size=${windowSize}`,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const port = await waitForDevToolsPort(profile);
  return { chrome, profile, port };
}

// Connect to a fresh about:blank page target and return the page session.
export async function connect(port) {
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
  const cdp = await cdpConnect(version.webSocketDebuggerUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  return {
    cdp,
    sessionId,
    close() {
      cdp.send('Browser.close').catch(() => {});
      cdp.close();
    }
  };
}

// Page helpers bound to one session. Input helpers use trusted
// Input.dispatchMouseEvent, which produces real pointer events with real
// pointerIds — so setPointerCapture genuinely engages (synthetic events
// can't), and hover/mouseover flows behave like a real user.
export function makePage(cdp, sessionId) {
  return {
    async navigate(url) {
      await cdp.send('Page.navigate', { url }, sessionId);
      for (let i = 0; i < 150; i++) {
        const rs = await this.evaluate('document.readyState');
        if (rs === 'complete') return;
        await sleep(100);
      }
      throw new Error('page never finished loading: ' + url);
    },

    async evaluate(expression) {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails));
      return r.result ? r.result.value : undefined;
    },

    async waitFor(fnExpr, { timeout = 10000, interval = 100, label = 'condition' } = {}) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await this.evaluate(fnExpr)) return;
        await sleep(interval);
      }
      throw new Error('timed out waiting for ' + label);
    },

    async elementCenter(selector) {
      const c = await this.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      })()`);
      if (!c) throw new Error('element not found: ' + selector);
      return c;
    },

    async mouseMove(x, y) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 }, sessionId);
    },

    async mouseClick(x, y) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
    },

    async mouseDrag(x, y, dx, dy) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + dx / 2, y: y + dy / 2, buttons: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + dx, y: y + dy, buttons: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + dx, y: y + dy, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
    }
  };
}
