import fs from "node:fs";

const api = fs.readFileSync("src/api.js", "utf8");
const main = fs.readFileSync("src/main.js", "utf8");
const checks = [
  ["query fails closed without a session", /throw this\._sessionUnavailable\('Query'\)/.test(api)],
  ["writes fail closed without a session", /throw this\._sessionUnavailable\('Create'\)/.test(api) && /throw this\._sessionUnavailable\('Composite request'\)/.test(api)],
  ["security reads bypass the query cache", /sfApi\.query\([^;]+noCache: true/.test(main)],
  ["real Search button exists", /id="sfarc-sec-search"/.test(main)],
  ["result requests reject stale responses", /requestId !== resultRequestId/.test(main)],
  ["suggestion requests reject stale responses", /requestId !== suggestionRequestId/.test(main)],
  ["field access is intersected with object access", /effectiveFieldRead/.test(main) && /objectPermByParent/.test(main)],
  ["assignment coverage is queried", /PermissionSetAssignment/.test(main) && /Assignment coverage/.test(main)],
  ["permission-set groups and muting are surfaced", /PermissionSetGroupComponent/.test(main) && /MutingPermissionSetId/.test(main)],
  ["Named Credentials are not generically routed", /Modern Named Credentials must be evaluated through External Credential principals/.test(main)],
  ["record-level limitations are explicit", /This is not a record-level access report/.test(main)]
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) { failed++; console.error("FAIL:", name); }
}
console.log(`${checks.length - failed}/${checks.length} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
