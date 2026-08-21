const fs = require('fs');
let code = fs.readFileSync('src/data-import.js', 'utf8');

const oldCode = `                  h("textarea", {id: "data-paste", value: model.importData ? (model.dataPreview || "Paste data here") : "Paste data here", onPaste: this.onDataPaste, onClick: this.onDataDropClick, className: "sfarc-data-drop" + (model.dataError ? " is-error" : "") + (model.importData ? " has-data" : "") + (this.state.autoPasted ? " was-autopasted" : ""), disabled: model.isWorking(), readOnly: true, rows: 1, title: "Click to auto-paste from clipboard, or Ctrl+V to paste manually"}),`;

const newCode = `                  h("label", {
                    className: "sfarc-data-drop" + (model.dataError ? " is-error" : "") + (model.importData ? " has-data" : "") + (this.state.autoPasted ? " was-autopasted" : ""),
                    htmlFor: "data-paste",
                    title: "Click to auto-paste from clipboard, or Ctrl+V to paste manually",
                    onClick: this.onDataDropClick
                  },
                    model.importData
                      ? h("svg", {viewBox: "0 0 24 24", width: 14, height: 14, fill: "none", stroke: "#22c55e", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", style: {flexShrink: 0}}, h("polyline", {points: "20 6 9 17 4 12"}))
                      : h("svg", {viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "#2196f3", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", style: {flexShrink: 0}}, h("path", {d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"}), h("rect", {x: 8, y: 2, width: 8, height: 4, rx: 1, ry: 1})),
                    h("span", {className: "sfarc-data-drop-text", style: {fontFamily: model.importData ? "var(--sfarc-i-mono)" : "inherit"}}, model.importData ? (model.dataPreview || "Paste data here") : "Paste data here"),
                    h("textarea", {id: "data-paste", value: "", onPaste: this.onDataPaste, disabled: model.isWorking(), readOnly: true, rows: 1, style: {position: "absolute", opacity: 0, width: "1px", height: "1px", padding: 0, border: 0}})
                  ),`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/data-import.js', code);
console.log("Patched data-import.js");
