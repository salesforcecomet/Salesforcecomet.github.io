const fs = require('fs');
const zlib = require('zlib');
function decodePNG(buf) {
    let pos = 8; let width = 0, height = 0, colorType = 0; const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        if (type === 'IHDR') { width = buf.readUInt32BE(pos + 8); height = buf.readUInt32BE(pos + 12); colorType = buf[pos + 17]; }
        else if (type === 'IDAT') idat.push(buf.slice(pos + 8, pos + 8 + len));
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const bpp = colorType === 6 ? 4 : 3;
    const stride = width * bpp;
    const out = Buffer.alloc(height * stride);
    let prev = Buffer.alloc(stride); let o = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[o++];
        const line = raw.slice(o, o + stride); o += stride;
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? line[x - bpp] : 0;
            const b = prev[x];
            const c = x >= bpp ? prev[x - bpp] : 0;
            let v = line[x];
            if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1; else if (filter === 4) v += a + b - c;
            out[y * stride + x] = v & 0xff;
        }
        prev = line;
    }
    return { width, height, bpp, data: out };
}
const buf = fs.readFileSync('/var/folders/c_/35mlntyd6nj8vt32wytvlftc0000gn/T/freebuff-desktop-pastes/paste-1786801608921-60105.png');
const { width, height, bpp, data } = decodePNG(buf);
console.log('size:', width, 'x', height);

// Find yellow-ish pixels: high R and G, low B
let ymin = 1e9, ymax = -1, ycount = 0;
const yellowCols = {};
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * bpp;
        const r = data[i], g = data[i+1], b = data[i+2];
        if (r > 180 && g > 140 && b < 120 && r - b > 90) {
            ycount++;
            if (y < ymin) ymin = y; if (y > ymax) ymax = y;
            const col = Math.floor(x / 30) * 30;
            yellowCols[col] = (yellowCols[col] || 0) + 1;
        }
    }
}
console.log('yellow px:', ycount, 'y range:', ymin, '-', ymax);
console.log('yellow by x-band:', JSON.stringify(Object.entries(yellowCols).sort((a,b) => b[1]-a[1]).slice(0, 12)));

// Green row background: find greenish pixels
let gcount = 0;
for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
        const i = (y * width + x) * bpp;
        const r = data[i], g = data[i+1], b = data[i+2];
        if (g > r + 15 && g > b + 10 && g > 180) gcount++;
    }
}
console.log('green-ish px (sampled):', gcount);
