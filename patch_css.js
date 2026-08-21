const fs = require('fs');
let code = fs.readFileSync('src/data-import.css', 'utf8');

// Replace the main .sfarc-data-drop rules block
const oldDataDrop = `.sfarc-data-drop {
  min-height: 52px;
  padding: 26px 10px 6px !important;
  text-align: center;
  font-family: var(--sfarc-i-font);
  font-size: 12px !important;
  line-height: 1.4 !important;
  color: var(--sfarc-i-muted);
  resize: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%232196f3' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/%3E%3Crect x='8' y='2' width='8' height='4' rx='1' ry='1'/%3E%3C/svg%3E");
  background-repeat: no-repeat !important;
  background-position: center 9px;
  background-size: 18px 18px;
}`;

const newDataDrop = `.sfarc-data-drop {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 10px 14px !important;
  font-family: var(--sfarc-i-font);
  font-size: 12px !important;
  color: var(--sfarc-i-text);
  cursor: pointer;
}`;
code = code.replace(oldDataDrop, newDataDrop);

const oldDark = `body.sfarc-dark-theme .sfarc-data-drop {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%232f81f7' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'/%3E%3Crect x='8' y='2' width='8' height='4' rx='1' ry='1'/%3E%3C/svg%3E");
}`;
code = code.replace(oldDark, `/* Dark icon replaced via React inline */`);

const oldHasData = `.sfarc-data-drop.has-data {
  padding: 8px 12px 8px 30px !important;
  text-align: center;
  display: block;
  font-family: var(--sfarc-i-mono, Monaco, Menlo, Consolas, monospace) !important;
  font-size: 11px !important;
  line-height: 1.5 !important;
  color: var(--sfarc-i-text, #334155) !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2322c55e' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: left 10px top 10px !important;
  background-size: 13px 13px !important;
  cursor: pointer !important;
}`;

const newHasData = `.sfarc-data-drop.has-data {
  font-size: 11px !important;
  color: var(--sfarc-i-text, #334155) !important;
}`;
code = code.replace(oldHasData, newHasData);

const oldDarkHasData = `body.sfarc-dark-theme .sfarc-data-drop.has-data {
  color: #cbd5e1 !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%234ade80' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
}`;
const newDarkHasData = `body.sfarc-dark-theme .sfarc-data-drop.has-data {
  color: #cbd5e1 !important;
}`;
code = code.replace(oldDarkHasData, newDarkHasData);

fs.writeFileSync('src/data-import.css', code);
console.log("Patched data-import.css");
