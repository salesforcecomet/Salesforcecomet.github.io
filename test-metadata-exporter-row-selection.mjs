import fs from 'node:fs';

const source = fs.readFileSync('src/metadata-exporter.js', 'utf8');
const css = fs.readFileSync('src/metadata-exporter.css', 'utf8');

const checks = [
    ['metadata type table has a selected-count column', source.includes('>SELECTED</th>')],
    ['metadata type count comes from selected members', /selectedMembers\[type\.xmlName\]\?\.size \|\| 0/.test(source)],
    ['wildcard type selection is labelled All', /isSelected \? 'All' : ''/.test(source)],
    ['member rows expose checkbox semantics', /setAttribute\('role', 'checkbox'\)/.test(source)],
    ['member rows toggle from row clicks', /tr\.addEventListener\('click'/.test(source) && /toggleFromRow\(\)/.test(source)],
    ['member rows support keyboard selection', /e\.key !== 'Enter' && e\.key !== ' '/.test(source)],
    ['interactive controls are excluded from row toggles', source.includes("closest('input, button, a, select, textarea')")],
    ['selected member rows receive visible styling', css.includes('.metadata-member-row.is-selected')],
    ['selected-count badge is styled', css.includes('.metadata-selected-count')]
];

let failed = 0;
for (const [name, passed] of checks) {
    if (!passed) {
        failed += 1;
        console.error(`FAIL ${name}`);
    }
}

console.log(`${checks.length - failed}/${checks.length} checks passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
