import fs from "node:fs";

const source = fs.readFileSync("src/event-monitor.js", "utf8");
const checks = [
  ["host pin is read and sent to cookie lookup", /params\.get\('host'\)/.test(source) && /url: pinnedUrl/.test(source)],
  ["cached session must match pinned org", /normalizeHost\(cached\.instanceUrl\) === normalizeHost\(pinnedUrl\)/.test(source)],
  ["Ready follows REST session verification", /await makeRestFetch\(`\$\{instanceUrl\}\/services\/data\/v60\.0\/limits`\)/.test(source)],
  ["subscribe is committed only after acknowledgement", /if \(!subscribed\).*\n\s*activeSubscriptions\.set/s.test(source)],
  ["unsubscribe is removed only after acknowledgement", /if \(!acknowledged\).*\n\s*}\n\s*activeSubscriptions\.delete/s.test(source)],
  ["pause does not discard incoming events", !/function processIncomingEvent\(msg\) \{\s*if \(isPaused\) return/.test(source) && /if \(!isPaused\) renderFeedList/.test(source)],
  ["custom replay zero is preserved", /Number\.parseInt/.test(source) && /parsedReplayId < 0/.test(source)],
  ["received replay zero is preserved", /eventMeta\.replayId \?\? 'N\/A'/.test(source)],
  ["poll failures are bounded with backoff", /MAX_POLL_FAILURES = 5/.test(source) && /2 \*\* \(consecutivePollFailures - 1\)/.test(source)],
  ["auth failures attempt one session refresh", /sessionRefreshAttempted/.test(source) && /await resolveSalesforceSession\(\)/.test(source)],
  ["page exit disconnects and clears polling", /'\/meta\/disconnect'/.test(source) && /clearTimeout\(longPollTimer\)/.test(source) && /pagehide/.test(source)],
  ["failed subscribe and unsubscribe return false", /async function sendBayeuxSubscribe[\s\S]*?return false/.test(source) && /async function sendBayeuxUnsubscribe[\s\S]*?return false/.test(source)]
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) { failed++; console.error("FAIL:", name); }
}
console.log(`${checks.length - failed}/${checks.length} checks passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
