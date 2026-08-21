import fs from 'node:fs';
import vm from 'node:vm';

const js = fs.readFileSync('src/metadata-exporter.js', 'utf8');
const api = fs.readFileSync('src/api.js', 'utf8');
const html = fs.readFileSync('src/metadata-exporter.html', 'utf8');

const checks = [
  ['transfer dialog is present', html.includes('id="org-transfer-modal"')],
  ['compare/select/validate/deploy steps are visible', ['1 Compare', '2 Select', '3 Validate', '4 Deploy'].every(x => html.includes(x))],
  ['destination-only deletion is explicitly excluded', js.includes("status: 'Destination only'") && js.includes('deployable: false')],
  ['selection changes invalidate validation', js.includes('orgTransferValidatedSignature = null')],
  ['validation uses Metadata API checkOnly', /deployMetadata\([^;]+checkOnly:\s*true/.test(js)],
  ['deployment requires exact validated signature', js.includes('orgTransferValidatedSignature !== transferSignature(files)')],
  ['rollback-on-error is enabled', api.includes('<met:rollbackOnError>true</met:rollbackOnError>')],
  ['destination backup is generated before deploy', /await downloadDestinationBackup\(files, true\)[\s\S]+deployMetadata/.test(js)],
  ['bundle companion files are included', js.includes("mapping.type === 'AuraDefinitionBundle'") && js.includes("mapping.type === 'LightningComponentBundle'")],
  ['single-package ZIP is rooted correctly', js.includes("zip.file('package.xml'") && !js.includes("zip.file('unpackaged/package.xml'")],
  ['deploy status is polled with details', js.includes('api.checkDeployStatus(jobId, true)')],
  ['deploy SOAP methods exist', api.includes('async deployMetadata(') && api.includes('async checkDeployStatus(')]
];

let failures = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? '✓' : '✗'} ${name}`);
  if (!passed) failures++;
}
new vm.Script(js);
new vm.Script(api);
if (failures) process.exit(1);
console.log(`\n${checks.length}/${checks.length} checks passed`);
