#!/usr/bin/env node
// Traces the REAL logo.png alpha silhouette into SVG path data so the
// extension favicon uses OUR cloud+comet artwork, not the Salesforce
// Inspector cloud. Memory-lean: decodes straight into a flat Uint8 alpha
// buffer and traces on a coarse grid.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodeAlpha(buf) {
    let pos = 8, width = 0, height = 0, colorType = 0;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.slice(pos + 8, pos + 8 + len);
        if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
        else if (type === 'IDAT') idat.push(data);
        pos += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const bpp = colorType === 6 ? 4 : 3;
    const stride = width * bpp;
    const alpha = new Uint8Array(width * height);
    let prev = Buffer.alloc(stride), off = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[off++];
        const row = Buffer.from(raw.slice(off, off + stride)); off += stride;
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
            let v = row[i];
            if (filter === 1) v = (v + a) & 255;
            else if (filter === 2) v = (v + b) & 255;
            else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
            else if (filter === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
            row[i] = v;
        }
        prev = row;
        for (let x = 0; x < width; x++) alpha[y * width + x] = bpp === 4 ? row[x * bpp + 3] : 255;
    }
    return { width, height, alpha };
}

// Moore-neighbor boundary tracing on a coarse binary grid.
function traceBoundaries(alpha, W, H, step, threshold) {
    const gw = Math.ceil(W / step);
    const gh = Math.ceil(H / step);
    const solid = new Uint8Array(gw * gh);
    for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
            const px = Math.min(W - 1, i * step);
            const py = Math.min(H - 1, j * step);
            solid[j * gw + i] = alpha[py * W + px] >= threshold ? 1 : 0;
        }
    }
    const visited = new Uint8Array(gw * gh);
    const loops = [];
    const dirs = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
    const isSolid = (x, y) => x >= 0 && y >= 0 && x < gw && y < gh && solid[y * gw + x];
    for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
            const key = j * gw + i;
            if (!solid[key] || visited[key]) continue;
            let isBoundary = false;
            for (const [dx, dy] of dirs) if (!isSolid(i + dx, j + dy)) { isBoundary = true; break; }
            if (!isBoundary) { visited[key] = 1; continue; }
            const loop = [];
            let cx = i, cy = j;
            let dirIdx = 0;
            while (dirIdx < 8 && isSolid(cx + dirs[dirIdx][0], cy + dirs[dirIdx][1])) dirIdx++;
            const startKey = key;
            let guard = 0, prevK = -1;
            for (;;) {
                loop.push([(cx + 0.5) * step, (cy + 0.5) * step]);
                visited[cy * gw + cx] = 1;
                prevK = cy * gw + cx;
                dirIdx = (dirIdx + 7) % 8;
                let found = false;
                for (let k = 0; k < 8; k++) {
                    dirIdx = (dirIdx + 1) % 8;
                    const ni = cx + dirs[dirIdx][0], nj = cy + dirs[dirIdx][1];
                    if (isSolid(ni, nj)) { cx = ni; cy = nj; found = true; break; }
                }
                if (!found) break;
                guard++;
                const k2 = cy * gw + cx;
                if (k2 === startKey || (k2 === prevK && guard > 3)) break;
                if (guard > 50000) break;
            }
            if (loop.length >= 4) loops.push(loop);
        }
    }
    return loops;
}

function douglasPeucker(pts, eps) {
    if (pts.length <= 2) return pts;
    let dmax = 0, idx = 0;
    const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
    const denom = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2) || 1;
    for (let i = 1; i < pts.length - 1; i++) {
        const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / denom;
        if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > eps) {
        const l = douglasPeucker(pts.slice(0, idx + 1), eps);
        const r = douglasPeucker(pts.slice(idx), eps);
        return l.slice(0, -1).concat(r);
    }
    return [pts[0], pts[pts.length - 1]];
}

function loopToPath(loop) {
    const simplified = douglasPeucker(loop, 2.0);
    let d = `M${simplified[0][0].toFixed(1)} ${simplified[0][1].toFixed(1)}`;
    for (let i = 1; i < simplified.length; i++) {
        const p = simplified[i - 1], q = simplified[i];
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    const s0 = simplified[0], sl = simplified[simplified.length - 1];
    d += ` Q${sl[0].toFixed(1)} ${sl[1].toFixed(1)} ${s0[0].toFixed(1)} ${s0[1].toFixed(1)} Z`;
    return d;
}

const { width, height, alpha } = decodeAlpha(fs.readFileSync(path.join(__dirname, '..', 'logo.png')));
console.log('source:', width, 'x', height);
const loops = traceBoundaries(alpha, width, height, 5, 110);
console.log('contours found:', loops.length);
loops.sort((a, b) => b.length - a.length);
const paths = loops.slice(0, 6).map(loopToPath);
console.log('kept:', paths.length, 'pts:', paths.map(p => p.length));
const svgPaths = paths.map(d => `<path d="${d}" fill="var(--org)" />`).join('');

const out = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Traced Comet logo</title>
<style>
body { font-family: -apple-system, sans-serif; padding: 20px; background: #f4f6f8; }
.panel { margin-bottom: 20px; }
.swatch { display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; border: 1px solid #d8dde6; margin: 6px; }
.pill { width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; }
.pill svg { width: 28px; height: 28px; }
.dark { background: #1e1e1e; }
.light { background: #ffffff; }
code { font: 11px/1.5 monospace; white-space: pre-wrap; display: block; max-width: 900px; background: #0f172a; color: #cbd5e1; padding: 12px; border-radius: 8px; margin-top: 8px; }
</style></head>
<body>
<h3>Traced Salesforce Comet logo (from logo.png alpha) — org colors</h3>
<div class="panel">
  <div class="swatch"><span class="pill dark" style="--org:#3b82f6"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">${svgPaths}</svg></span> blue on dark</div>
  <div class="swatch"><span class="pill dark" style="--org:#f59e0b"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">${svgPaths}</svg></span> amber on dark</div>
  <div class="swatch"><span class="pill light" style="--org:#0176d3"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">${svgPaths}</svg></span> sf-blue on light</div>
  <div class="swatch"><span class="pill light" style="--org:#7c3aed"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">${svgPaths}</svg></span> violet on light</div>
  <div class="swatch"><span class="pill light" style="--org:#dc2626"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130">${svgPaths}</svg></span> red on light</div>
</div>
<code id="paths"></code>
<script>document.getElementById('paths').textContent = ${JSON.stringify(JSON.stringify(svgPaths, null, 1))};</script>
</body></html>`;
fs.writeFileSync(path.join(__dirname, 'logo-trace-preview.html'), out);
console.log('Wrote scratch-harness/logo-trace-preview.html');
