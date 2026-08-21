// Builds scratch-harness/import-actions-fixed.html — inlines the REAL
// data-import.css and renders the exact action-bar buttons from data-import.js.
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'data-import.css'), 'utf8');

const btn = (cls, inner) => '<button class="' + cls + '" style="border:1px solid var(--sfarc-i-btn-border)">' + inner + '</button>';
const run = btn('sfarc-btn sfarc-btn-primary',
  '<svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
  '<span class="sfarc-btn-label">Run update</span>');
const resume = btn('sfarc-btn sfarc-btn-icon sfarc-btn-icon-label',
  '<svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
  '<span class="sfarc-btn-label">Resume</span>');
const retry = btn('sfarc-btn sfarc-btn-icon sfarc-btn-icon-label',
  '<svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
  '<span class="sfarc-btn-label">Retry failed</span>');
const hide = btn('sfarc-btn sfarc-btn-icon sfarc-btn-icon-label',
  '<svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>' +
  '<span class="sfarc-btn-label">Hide config</span>');
const iconBtn = (cls) => btn(cls, '<svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>');

const pill = (name) => '<div class="status-stat-pill stat-' + name.toLowerCase() + ' stat-live stat-checked"><span class="stat-count">0</span><span>' + name + '</span></div>';

const measureJs = [
  'function measure() {',
  '  const bar = document.getElementById("bar");',
  '  const buttons = Array.from(bar.querySelectorAll("button"));',
  '  let out = [];',
  '  buttons.forEach(b => {',
  '    const r = b.getBoundingClientRect();',
  '    const lbl = b.querySelector(".sfarc-btn-label");',
  '    out.push({ cls: b.className.split(" ").slice(1).join("."), label: lbl ? lbl.textContent : "", w: Math.round(r.width), labelScroll: lbl ? lbl.scrollWidth : 0 });',
  '  });',
  '  let overlaps = [];',
  '  for (let i = 0; i < buttons.length - 1; i++) {',
  '    const a = buttons[i].getBoundingClientRect(), b = buttons[i + 1].getBoundingClientRect();',
  '    if (a.right > b.left + 0.5) overlaps.push("btn " + i + "→" + (i + 1) + ": " + Math.round(a.right - b.left) + "px overlap");',
  '  }',
  '  let overflows = [];',
  '  buttons.forEach((b, i) => {',
  '    const lbl = b.querySelector(".sfarc-btn-label");',
  '    if (lbl && lbl.scrollWidth > b.clientWidth + 1) overflows.push("btn " + i + ": label " + lbl.scrollWidth + "px > button " + b.clientWidth + "px");',
  '  });',
  '  return { buttons: out, overlaps, overflows };',
  '}',
  'document.getElementById("results").textContent = JSON.stringify(measure(), null, 1);'
].join('\n');

const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<title>Data Import action bar — overlap check</title>\n<style>\n' +
  'html, body { height: 100%; }\n' +
  'body { margin: 0; padding: 24px; background: #eef1f5; font-family: -apple-system, sans-serif; }\n' +
  '#stage { max-width: 1100px; }\n' +
  '#results { margin-top: 14px; font: 12px/1.7 ui-monospace, monospace; white-space: pre; background: #fff; border: 1px solid #d8dde6; border-radius: 8px; padding: 10px 12px; }\n' +
  '.theme-toggle { position: fixed; right: 14px; top: 14px; z-index: 9; padding: 6px 12px; border-radius: 8px; border: 1px solid #999; background: #fff; cursor: pointer; }\n' +
  '/* ---------- REAL data-import.css ---------- */\n' +
  css +
  '</style>\n</head>\n<body>\n' +
  '<button class="theme-toggle" onclick="document.body.classList.toggle(\'sfarc-dark-theme\')">Toggle dark</button>\n' +
  '<div id="stage">\n' +
  '  <div class="sfarc-import-actions" id="bar">\n' +
  '    <div class="sfarc-action-group">' + run + resume + retry + hide + '</div>\n' +
  '    <div class="sfarc-status-pills">' + pill('Queued') + pill('Processing') + pill('Succeeded') + pill('Failed') + '</div>\n' +
  '    <div class="sfarc-action-group">' + iconBtn('sfarc-btn sfarc-btn-icon') + '<button class="sfarc-btn sfarc-btn-secondary">Copy</button>' + iconBtn('sfarc-btn sfarc-btn-icon') + '</div>\n' +
  '  </div>\n' +
  '</div>\n' +
  '<div id="results"></div>\n' +
  '<script>\n' + measureJs + '\n</script>\n' +
  '</body>\n</html>\n';

fs.writeFileSync(path.join(__dirname, 'import-actions-fixed.html'), html);
console.log('wrote import-actions-fixed.html,', html.length, 'bytes');
