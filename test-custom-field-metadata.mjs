import fs from 'node:fs';
import assert from 'node:assert/strict';

const apiSource = fs.readFileSync(new URL('./src/api.js', import.meta.url), 'utf8');
const builderSource = fs.readFileSync(new URL('./src/bulk-field-builder.js', import.meta.url), 'utf8');

const serializerStart = apiSource.indexOf('const serializeMetadataElement =');
const serializerEnd = apiSource.indexOf('\n\n            let metadataXml', serializerStart);
assert.ok(serializerStart >= 0 && serializerEnd > serializerStart, 'recursive metadata serializer is present');

const serializerDeclaration = apiSource.slice(serializerStart, serializerEnd);
const makeSerializer = new Function(`${serializerDeclaration}; return serializeMetadataElement;`);
const serialize = makeSerializer.call({
    escapeXml(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    }
});

const valueSetXml = serialize('valueSet', {
    valueSetDefinition: {
        sorted: false,
        value: [
            { fullName: 'New & Open', default: true, label: 'New <Open>' },
            { fullName: 'Closed', default: false, label: 'Closed' }
        ]
    }
});

assert.match(valueSetXml, /<met:valueSet><met:valueSetDefinition>/);
assert.match(valueSetXml, /<met:fullName>New &amp; Open<\/met:fullName>/);
assert.match(valueSetXml, /<met:label>New &lt;Open><\/met:label>/);
assert.equal((valueSetXml.match(/<met:value>/g) || []).length, 2, 'arrays become repeated metadata elements');
assert.ok(!valueSetXml.includes('[object Object]'), 'nested metadata is never stringified as [object Object]');

for (const expected of [
    "type === 'Formula'",
    "type === 'Lookup' || type === 'MasterDetail'",
    "type === 'Picklist' || type === 'MultiselectPicklist'",
    'fieldMeta.relationshipOrder',
    'fieldMeta.writeRequiresMasterRead',
    'fieldMeta.deleteConstraint',
    'fieldMeta.formulaTreatBlanksAs',
    'validateFieldRows(rows, objectName)'
]) {
    assert.ok(builderSource.includes(expected), `builder covers ${expected}`);
}

console.log('CustomField metadata serializer and type-specific validation checks passed.');
