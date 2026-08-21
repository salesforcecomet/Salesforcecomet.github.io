const fs = require('fs');
let code = fs.readFileSync('src/data-import.css', 'utf8');

const oldDataDrop = `.sfarc-data-drop {
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
  border-style: solid !important;
  border-width: 1px !important;
}`;
code = code.replace(oldDataDrop, newDataDrop);

fs.writeFileSync('src/data-import.css', code);
console.log("Patched data-import.css again");
