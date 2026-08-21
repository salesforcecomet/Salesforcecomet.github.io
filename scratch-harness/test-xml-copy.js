// Standalone verification of the Copy-as-XML / Copy-as-JSON serialization
// logic added to data-import.js (same escaping rules, same structure).
const header = ['Id', 'Name', 'Amount', 'Note'];
const data = [
  ['001xx', 'Acme & Sons', '100.5', 'line1\nline2'],
  ['002yy', "O'Brien <Co>", '0', 'quotes: "hi"'],
];

const escapeXml = (value) => {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const rowsXml = data
  .map(
    (cells) =>
      '  <row>\n' +
      header.map((col, i) => `    <${col}>${escapeXml(cells[i])}</${col}>`).join('\n') +
      '\n  </row>'
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n${rowsXml}\n</records>`;
console.log('=== XML ===');
console.log(xml);
console.log();

const objects = data.map((cells) => {
  const obj = {};
  header.forEach((col, i) => { obj[col] = cells[i] === undefined ? null : cells[i]; });
  return obj;
});
console.log('=== JSON ===');
console.log(JSON.stringify(objects, null, 2));

// Assertions
if (!xml.includes('&amp;')) throw new Error('XML escape of & failed');
if (!xml.includes('&lt;Co&gt;')) throw new Error('XML escape of < > failed');
if (!xml.includes('&apos;')) throw new Error('XML escape of apostrophe failed');
if (!xml.includes('&quot;')) throw new Error('XML escape of quotes failed');
if (!xml.includes('\n  <row>')) throw new Error('rows should be indented with spaces');
if (JSON.parse(JSON.stringify(objects))[0].Name !== 'Acme & Sons') throw new Error('JSON value mangled');
console.log('\nAll assertions passed.');
