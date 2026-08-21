import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const sourceFiles = [
  'src/api.js', 'src/main.js', 'src/background.js', 'src/event-monitor.js',
  'src/anonymous-apex.js', 'src/settings.js', 'src/bulk-field-builder.js'
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const extensionText = fs.readdirSync(path.join(root, 'src'), { recursive: true })
  .filter(file => /\.(?:html|css|js)$/.test(file))
  .map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8'))
  .join('\n');

assert(!manifest.permissions.includes('activeTab'), 'activeTab must not be requested');
assert(!manifest.host_permissions.some(host => /clients2\.google|chromewebstore\.google/.test(host)), 'non-Salesforce hosts must not be requested');
assert(!manifest.content_security_policy.extension_pages.includes('fonts.googleapis.com'), 'Google Fonts must not be in CSP');
assert(!manifest.content_security_policy.extension_pages.includes('fonts.gstatic.com'), 'Google font files must not be in CSP');
assert(!/fonts\.(?:googleapis|gstatic)\.com/.test(extensionText), 'extension source must not contact Google Fonts');
assert(!/sfarc-keepalive/.test(sourceFiles), 'service worker keepalive must not return');
assert(!/<[^>]+\bon(?:click|error)\s*=/.test(fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8')), 'Settings must not generate inline handlers');
assert(!/<[^>]+\bonclick\s*=/.test(fs.readFileSync(path.join(root, 'src/bulk-field-builder.js'), 'utf8')), 'Bulk Field Builder must not generate inline handlers');

for (const file of ['src/api.js', 'src/main.js', 'src/background.js', 'src/event-monitor.js', 'src/anonymous-apex.js']) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  assert(!/chrome\.storage\.local\.(?:get|set)\([^\n]*(?:sfarc_cached_session|sessionInfo)/.test(text), `${file} must not persist session tokens`);
}

for (const [file, width, height] of [
  ['website/store-assets/promo-tile-440x280.png', 440, 280],
  ['website/store-assets/marquee-1400x560.png', 1400, 560],
  ['website/store-assets/screenshot-command-palette-1280x800.png', 1280, 800],
  ['website/store-assets/screenshot-data-export-1280x800.png', 1280, 800],
  ['website/store-assets/screenshot-code-editor-1280x800.png', 1280, 800]
]) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.readUInt32BE(16), width, `${file} width`);
  assert.equal(data.readUInt32BE(20), height, `${file} height`);
}

console.log('Featured-readiness regression checks passed.');
