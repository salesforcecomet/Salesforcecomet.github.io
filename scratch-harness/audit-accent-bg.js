const fs = require('fs');
const path = require('path');
const glob = require('child_process').execSync('ls -1 src/**/*.css src/*.html 2>/dev/null', { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const files = glob.filter(f => !f.includes('scratch') && !f.includes('preview-') && !f.includes('unused') && !f.endsWith('slds.css'));

const hits = [];
for (const f of files) {
  let css;
  try { css = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const sel = m[1].trim();
    const body = m[2];
    if (!/var\(--(sfarc-accent|primary)/.test(body)) continue;
    if (/background[^;]*var\(--(sfarc-accent|primary)/.test(body) &&
        /color\s*:\s*(#fff\b|#ffffff\b|white\b)/i.test(body)) {
      hits.push({ f, sel: sel.replace(/\s+/g, ' ').slice(0, 70), body: body.replace(/\s+/g, ' ').trim().slice(0, 130) });
    }
  }
}
console.log(hits.length + ' accent-bg + white-text rule blocks:');
for (const h of hits.slice(0, 120)) {
  console.log(`\n[${h.f}]\n  ${h.sel}\n  ${h.body}`);
}
