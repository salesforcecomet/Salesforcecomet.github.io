const fs = require('fs');
let code = fs.readFileSync('src/sfir-shell.css', 'utf8');

const oldCss = `.sfir-tab-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    display: none;
    background: transparent;
}

.sfir-tab-frame.active,
.sfir-tab-frame.outgoing {
    display: block;
}

.sfir-tab-frame.active {
    z-index: 2;
    animation: sfirTabIn 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

.sfir-tab-frame.outgoing {
    z-index: 1;
    animation: sfirTabOut 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}`;

const newCss = `.sfir-tab-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    background: transparent;
    will-change: transform, opacity;
}

.sfir-tab-frame.active,
.sfir-tab-frame.outgoing {
    visibility: visible;
    pointer-events: auto;
}

.sfir-tab-frame.active {
    z-index: 2;
    animation: sfirTabIn 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}

.sfir-tab-frame.outgoing {
    z-index: 1;
    pointer-events: none;
    animation: sfirTabOut 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
}`;

code = code.replace(oldCss, newCss);
fs.writeFileSync('src/sfir-shell.css', code);
console.log("Patched sfir-shell.css");
