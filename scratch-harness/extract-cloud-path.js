#!/usr/bin/env node
// Parses the official Salesforce cloud mark path, computes its real bounding
// box (sampling the beziers), and emits:
//   1. the path normalized into a 0..100 x 0..~70 viewBox (aspect-preserved)
//   2. a coarse ASCII silhouette so we can pick where the comet sparkle sits
const CLOUD = "M416.224 76.763c32.219-33.57 77.074-54.391 126.682-54.391 65.946 0 123.48 36.772 154.12 91.361 26.626-11.896 56.098-18.514 87.106-18.514 118.94 0 215.368 97.268 215.368 217.247 0 119.993-96.428 217.261-215.368 217.261a213.735 213.735 0 0 1-42.422-4.227c-26.981 48.128-78.397 80.646-137.412 80.646-24.705 0-48.072-5.706-68.877-15.853-27.352 64.337-91.077 109.448-165.348 109.448-77.344 0-143.261-48.939-168.563-117.574-11.057 2.348-22.513 3.572-34.268 3.572C75.155 585.74.5 510.317.5 417.262c0-62.359 33.542-116.807 83.378-145.937-10.26-23.608-15.967-49.665-15.967-77.06C67.911 87.25 154.79.5 261.948.5c62.914 0 118.827 29.913 154.276 76.263";

// Minimal path parser: tokenizes numbers (handling signs attached like
// `1-42.422` in arc flags) and letters as commands.
function tokenize(d) {
  const toks = [];
  let i = 0;
  while (i < d.length) {
    const ch = d[i];
    if (ch === ' ' || ch === ',' || ch === '\n' || ch === '\t' || ch === '\r') { i++; continue; }
    if (/[a-zA-Z]/.test(ch)) { toks.push(ch); i++; continue; }
    // number: optional sign, digits, optional dot-digits
    let num = '';
    while (i < d.length && /[-+.\d]/.test(d[i])) {
      // stop at a second sign or a second dot (handles `1-42.422` and `585.74.5`)
      if (num && (/[+-]/.test(d[i]) || (d[i] === '.' && num.includes('.')))) break;
      num += d[i];
      i++;
    }
    toks.push(parseFloat(num));
  }
  return toks;
}

function parsePath(d) {
  const toks = tokenize(d);
  const cmds = [];
  let i = 0;
  let lastT = null;
  while (i < toks.length) {
    const t = toks[i++];
    if (typeof t === 'string') {
      lastT = t;
      const maxArgs = { M: 2, m: 2, c: 6, C: 6, a: 7, A: 7, z: 0, Z: 0 }[t] || 0;
      const args = [];
      for (let k = 0; k < maxArgs && i < toks.length && typeof toks[i] === 'number'; k++) {
        args.push(toks[i++]);
      }
      cmds.push({ t, args });
    } else {
      // implicit repeat of the previous command (no letter between numbers)
      const t2 = lastT;
      const maxArgs = { c: 6, C: 6, a: 7, A: 7, l: 2, L: 2, m: 2, M: 2, s: 4, S: 4, q: 4, Q: 4, t: 2, T: 2 }[t2] || 2;
      const args = [t];
      for (let k = 1; k < maxArgs && i < toks.length && typeof toks[i] === 'number'; k++) {
        args.push(toks[i++]);
      }
      cmds.push({ t: t2, args });
    }
  }
  return cmds;
}

function samplePath(d, steps = 200) {
  const cmds = parsePath(d);
  let x = 0, y = 0, sx = 0, sy = 0;
  const pts = [[0, 0]];
  const add = (px, py) => pts.push([px, py]);
  for (const { t, args } of cmds) {
    if (t === 'M') { x = args[0]; y = args[1]; sx = x; sy = y; }
    else if (t === 'm') { x += args[0]; y += args[1]; sx = x; sy = y; }
    else if (t === 'c') {
      const x1 = x + args[0], y1 = y + args[1], x2 = x + args[2], y2 = y + args[3], x3 = x + args[4], y3 = y + args[5];
      for (let s = 1; s <= steps; s++) {
        const u = s / steps, v = 1 - u;
        add(v*v*v*x + 3*v*v*u*x1 + 3*v*u*u*x2 + u*u*u*x3, v*v*v*y + 3*v*v*u*y1 + 3*v*u*u*y2 + u*u*u*y3);
      }
      x = x3; y = y3;
    }
    else if (t === 'C') {
      const [x1, y1, x2, y2, x3, y3] = args;
      for (let s = 1; s <= steps; s++) {
        const u = s / steps, v = 1 - u;
        add(v*v*v*x + 3*v*v*u*x1 + 3*v*u*u*x2 + u*u*u*x3, v*v*v*y + 3*v*v*u*y1 + 3*v*u*u*y2 + u*u*u*y3);
      }
      x = x3; y = y3;
    }
    else if (t === 'a') {
      // arc — approximate as line segments on the ellipse
      const [rx, ry, rot, laf, sf, dx, dy] = args;
      const endX = x + dx, endY = y + dy;
      const segs = 24;
      for (let s = 1; s <= segs; s++) {
        add(x + dx * s / segs, y + dy * s / segs);
      }
      x = endX; y = endY;
    }
    else if (t === 'A') {
      const [rx, ry, rot, laf, sf, dx, dy] = args;
      const segs = 24;
      for (let s = 1; s <= segs; s++) {
        add(x + (dx - x) * s / segs, y + (dy - y) * s / segs);
      }
      x = dx; y = dy;
    }
  }
  return pts;
}

const pts = samplePath(CLOUD);
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const [px, py] of pts) {
  minX = Math.min(minX, px); maxX = Math.max(maxX, px);
  minY = Math.min(minY, py); maxY = Math.max(maxY, py);
}
console.log('bbox:', { minX: minX.toFixed(2), maxX: maxX.toFixed(2), minY: minY.toFixed(2), maxY: maxY.toFixed(2) });
console.log('size:', (maxX - minX).toFixed(2), 'x', (maxY - minY).toFixed(2), 'aspect:', ((maxX - minX) / (maxY - minY)).toFixed(3));

// Emit normalized path (scale to width 100)
const scale = 100 / (maxX - minX);
function norm(coords) {
  return coords.map(v => v === null ? null : ((v - minX) * scale).toFixed(2)).join(' ');
}
// Normalize by re-parsing and emitting with relative commands untouched is
// complex; simplest robust approach: keep original path + set viewBox to the
// bbox with aspect: viewBox="minX minY (maxX-minX) (maxY-minY)".
console.log('viewBox: "' + minX.toFixed(2) + ' ' + minY.toFixed(2) + ' ' + (maxX - minX).toFixed(2) + ' ' + (maxY - minY).toFixed(2) + '"');

// ASCII silhouette (coarse) to locate the top-right shoulder
const W = 60, H = 30;
const grid = Array.from({ length: H }, () => Array(W).fill(' '));
for (const [px, py] of pts) {
  const gx = Math.round((px - minX) / (maxX - minX) * (W - 1));
  const gy = Math.round((py - minY) / (maxY - minY) * (H - 1));
  if (gx >= 0 && gx < W && gy >= 0 && gy < H) grid[gy][gx] = '#';
}
console.log(grid.map(r => r.join('')).join('\n'));

// Top-right shoulder scan: find the highest cloud pixel in the right third
for (let gy = 0; gy < H; gy++) {
  const row = grid[gy];
  const rightmost = row.lastIndexOf('#');
  if (rightmost >= W * 0.7) {
    console.log('top-right shoulder row', gy, 'rightmost col', rightmost, '-> x', (minX + rightmost / (W - 1) * (maxX - minX)).toFixed(1), 'y', (minY + gy / (H - 1) * (maxY - minY)).toFixed(1));
    break;
  }
}
