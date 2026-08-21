// Regression tests for SOAP fault handling:
//  1. api.js parseSoapFault() turns a raw fault envelope into { code, message }
//     and soapRequest throws the clean message instead of dumping XML.
//  2. metadata-exporter.js startRetrieveFlow names the selected types and
//     explains INVALID_TYPE instead of showing the raw fault.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const api = fs.readFileSync('src/api.js', 'utf8');
const me = fs.readFileSync('src/metadata-exporter.js', 'utf8');

// --- 1. parseSoapFault ---
const m = api.match(/parseSoapFault\(text\) \{[\s\S]*?\n    \}/);
check('parseSoapFault defined in api.js', !!m);
if (!m) process.exit(1);
const parseSoapFault = new Function('return ' + m[0].replace('parseSoapFault(text)', 'function parseSoapFault(text)'))();

const faultXml = '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sf="http://soap.sforce.com/2006/04/metadata"><soapenv:Body><soapenv:Fault><faultcode>sf:INVALID_TYPE</faultcode><faultstring>INVALID_TYPE: This type of metadata is not available for this organization</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>';

console.log('== 1. Fault parsing (api.js) ==');
{
  const f = parseSoapFault(faultXml);
  check('fault code extracted', !!f && f.code === 'sf:INVALID_TYPE');
  check('fault string extracted', !!f && f.message === 'This type of metadata is not available for this organization');
  check('duplicate code prefix stripped', !!f && !f.message.startsWith('INVALID_TYPE'));
}
check('non-fault text returns null', parseSoapFault('random body text') === null);
check('empty text returns null', parseSoapFault('') === null);
{
  const f = parseSoapFault('<faultstring>Bad &lt;input&gt; &amp; worse</faultstring>');
  check('entities decoded', !!f && f.message === 'Bad <input> & worse');
}
{
  const f = parseSoapFault('<faultcode>sf:REQUIRE_FEATURE_ENABLED</faultcode><faultstring>Feature not enabled</faultstring>');
  check('code without message prefix ok', !!f && f.message === 'Feature not enabled');
}

console.log('== 2. soapRequest throw site (api.js) ==');
check('soapRequest checks for fault before generic error', /if \(!response\.ok\) \{[\s\S]*?parseSoapFault\(response\.text\)/.test(api));
check('clean throw uses fault code + message', /new Error\(`SOAP API Error: \$\{fault\.code[^`]*\$\{fault\.message\}`\)/.test(api));
check('raw text preserved on error for debugging', /err\.rawText = response\.text;/.test(api));
check('generic fallback still present', /SOAP API Error: \$\{response\.status\} \$\{response\.statusText\}/.test(api));

console.log('== 3. INVALID_TYPE hint (metadata-exporter.js) ==');
check('catch checks faultCode for INVALID_TYPE', /e\.faultCode && e\.faultCode\.indexOf\('INVALID_TYPE'\) > -1/.test(me));
check('selected types named in the hint', /Array\.from\(selectedTypes\)\.sort\(\)/.test(me));
check('explains why the type is unavailable', /newer than your org's API version/.test(me));
check('suggests unchecking the type', /Uncheck \$\{selectedTypes\.size > 1 \? 'the unsupported ones' : 'it'\} and retry/.test(me));
check('generic error path still escapes html', /window\.escapeHtml \? window\.escapeHtml\(msg\) : msg/.test(me));

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
