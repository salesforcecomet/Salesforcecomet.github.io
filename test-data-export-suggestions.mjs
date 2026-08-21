// Dev test: already-selected fields must not be re-suggested by the
// data-export SOQL field suggestions panel.
import { readFileSync } from "fs";

const src = readFileSync("src/data-export.js", "utf8");

let checks = 0;
let failed = 0;
function check(name, cond) {
  checks++;
  if (!cond) {
    failed++;
    console.log("  FAIL:", name);
  }
}

// Extract the selectedFieldNamesSet method and expose a test harness.
const m = src.match(/  selectedFieldNamesSet\(\) \{[\s\S]*?\n  \}/);
check("selectedFieldNamesSet method exists", !!m);
if (!m) process.exit(1);

const methodSrc = m[0].trim().replace(/^selectedFieldNamesSet\(\)/, "function selectedFieldNamesSet()");
let selectedSet;
eval(`(function () { ${methodSrc} globalThis.__testSelected = function (q) { const fake = { queryInput: { value: q } }; return selectedFieldNamesSet.call(fake); }; })()`);
selectedSet = globalThis.__testSelected;

// 1. Screenshot-style query — all selected fields must be in the set.
const shotQuery = [
  "SELECT AccountNumber, AccountSource, Active__c, AnnualRevenue, BillingAddress,",
  "BillingCountry, BillingGeocodeAccuracy, BillingLatitude, BillingLongitude,",
  "BillingPostalCode, BillingState, BillingStreet, CreatedBy.AccountId,",
  "LastReferencedDate, MasterRecord.Active__c, ShippingCountry, ShippingCity,",
  "ShippingAddress FROM \nAccount"
].join(" ");
const set1 = selectedSet(shotQuery);
check("AccountNumber marked selected", set1.has("accountnumber"));
check("BillingAddress marked selected", set1.has("billingaddress"));
check("ShippingAddress marked selected", set1.has("shippingaddress"));
check("relationship field CreatedBy.AccountId marked selected", set1.has("createdby.accountid"));
check("unselected field Id NOT in set", !set1.has("id"));
check("unselected field Name NOT in set", !set1.has("name"));

// 2. Simple query.
const set2 = selectedSet("SELECT Id, Name FROM Account");
check("Id in set", set2.has("id"));
check("Name in set", set2.has("name"));

// 3. Subquery must NOT leak its fields into the outer SELECT set.
const set3 = selectedSet("SELECT Id, (SELECT Name FROM Contacts) FROM Account");
check("outer Id in set", set3.has("id"));
check("subquery Name NOT leaked", !set3.has("name"));

// 4. Empty / FROM-less queries produce an empty set.
check("empty query -> empty set", selectedSet("").size === 0);
check("no FROM yet -> empty set", selectedSet("SELECT AccountNumber").size === 0);

// 5. Aliased function is not mistaken for a selected field.
const set5 = selectedSet("SELECT COUNT(Id) AS c, AccountNumber FROM Account");
check("AccountNumber in set", set5.has("accountnumber"));
check("alias 'c' NOT in set", !set5.has("c"));
check("COUNT not treated as field", !set5.has("count"));

// 6. Case-insensitivity.
check("lowercase query handled", selectedSet("select id, name from account").has("id"));

// 7. Source ships the filter wired into the field suggestions builder.
check(
  "suggestions filtered by selected set",
  /\.filter\(r => !vm\.selectedFieldNamesSet\(\)\.has\(/.test(src)
);
check("filter sits before sort", src.indexOf("selectedFieldNamesSet().has") < src.indexOf("removeTypo(query)"));

console.log(`\n${checks - failed}/${checks} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
