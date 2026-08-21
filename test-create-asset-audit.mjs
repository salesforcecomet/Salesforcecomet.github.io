import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('src/code-editor.html', 'utf8');
const js = fs.readFileSync('src/code-editor.js', 'utf8');
const checks = [
  ['all seven asset types remain available', ['lwc','lms','agentforce','apex','trigger','vfpage','vfcomp'].every(type => html.includes(`value="${type}"`))],
  ['LWC uses current Experience Builder target', js.includes('lightningCommunity__Page') && !js.includes("targetsXml += '        <target>siteforce__CommunityPage")],
  ['quick action emits required targetConfig and actionType', js.includes('<targetConfig targets="lightning__RecordAction">') && js.includes('<actionType>${quickActionType}</actionType>')],
  ['exposed LWC requires at least one target', js.includes('An exposed LWC requires at least one target surface')],
  ['LWC API version and description are emitted', js.includes('<apiVersion>${apiVersion}</apiVersion>') && js.includes('<description>${esc(description)}</description>')],
  ['trigger requires an explicit valid sObject', js.includes('The creator will not silently default to Account') && js.includes('Enter a valid Salesforce sObject API name')],
  ['trigger sends selected API version', js.includes('ApiVersion: triggerApiVersion')],
  ['LMS fields are validated and failures are fatal', js.includes('Add at least one unique message field') && js.includes('Lightning Message Channel creation failed')],
  ['Agentforce handler is required and API failure is fatal', html.includes('create-field-label create-required" for="agent-handler"') && js.includes('GenAI Function creation failed or is unsupported')],
  ['Visualforce page supports extensions and chrome flags', ['vfpage-extensions','vfpage-show-header','vfpage-sidebar'].every(id => html.includes(`id="${id}"`))],
  ['Visualforce component supports controller and access', html.includes('id="vfcomp-controller"') && html.includes('id="vfcomp-access"')],
  ['generated asset preview is present', html.includes('id="create-asset-preview-files"') && js.includes('function updateCreateAssetPreview()')],
  ['fake success IDs were removed', !js.includes("lms_' + Date.now()") && !js.includes("agent_' + Date.now()")]
];
let failed = 0;
for (const [name, pass] of checks) { console.log(`${pass ? '✓' : '✗'} ${name}`); if (!pass) failed++; }
new vm.Script(js);
if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} checks passed`);
