# Chrome Web Store — Featured Badge Compatibility Checklist

Goal: make **Salesforce Comet** eligible for the CWS **Featured** badge. The badge is manually
evaluated by Chrome team members against the CWS **best practices**: an enjoyable/intuitive
experience, up-to-date platform APIs (MV3), and respect for user privacy — plus a clear, helpful
store listing. The checklist below maps the current state of the code to the official policies.

> Source of truth (as of Aug 2026):
> - Discovery / Featured badge: https://developer.chrome.com/docs/webstore/discovery
> - Program policies: https://developer.chrome.com/docs/webstore/program-policies
> - Quality guidelines (single purpose): https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines
> - Code readability: https://developer.chrome.com/docs/webstore/program-policies/code-readability

---

## ✅ Done in code (this pass)

| Requirement | Where |
| :-- | :-- |
| **Single purpose / no unrelated bundles** — removed the "Recommended Video" card, its remote `videos.json` fetch, and GitHub phone-home. The extension now stays in its lane as a Salesforce dev tool. | `src/main.js` |
| **No remote code / external logic** — verified: no `eval`, no remote `<script>`, no interpreter of remote data. The only `script.src` uses point at files inside the extension package. | `src/` (audited) |
| **Secure handling of authentication data** — saved passwords are now encrypted at rest (AES-256-GCM, PBKDF2-310k), the key lives only in memory (cleared on browser restart), and plaintext passwords are migrated on first run. | `src/vault-crypto.js`, `src/popup.js`, `src/popup.html` |
| **Transient credential lifetime** — one-click-login credentials are wiped by a watchdog alarm after 40s even if the login page never opens. | `src/background.js`, `src/popup.js` |
| **Session tokens out of URLs** — session-based logins set the `sid` cookie instead of putting `?sid=` in the address bar (history/server-log leakage). | `src/popup.js` |
| **Metadata accuracy** — unified title ("Salesforce Comet" everywhere — manifest `action.default_title`, popup `<title>`, header), README version aligned with `manifest.json` (3.1.0). | `manifest.json`, `src/popup.html`, `README.md` |
| **Privacy policy draft** — comprehensive policy covering the vault, session handling, and the uninstall survey. | `PRIVACY.md` |
| **Least-privilege audit** — permissions are limited to what the features require (see table below). | `manifest.json` |
| **Code readability** — `build.js` minifies with Terser (whitespace/name-shortening), which the CWS **explicitly allows**; vendored bundles (Monaco, flow scanner) ship unmodified. | `build.js` |
| **CSP clean** — the only inline script (welcome.html onboarding) was externalized to `welcome-onboarding.js`; no inline handlers, no `eval`, no remote script anywhere. CSP tightened: unused `cdnjs` allowance removed from `style-src`/`font-src`. | `src/welcome.html`, `src/welcome-onboarding.js`, `manifest.json` |
| **Session tokens remain memory-only** — timestamped standalone-tool handoff caches use `chrome.storage.session`; timestamp-less entries are rejected and legacy disk-backed keys are deleted by the service worker. | `src/api.js`, `src/main.js`, `src/background.js`, standalone tools |
| **No third-party font requests** — Inter, Outfit, developer monospace fonts, and Material Symbols are bundled in the extension. Google Fonts is absent from extension CSP. | `src/local-fonts.css`, `src/fonts/`, `manifest.json` |
| **No artificial service-worker keepalive** — removed the repeating no-op alarm; alarms remain only for the bounded 40-second quick-login cleanup. | `src/background.js` |
| **Store artwork prepared** — three 1280×800 product screenshots, a 440×280 promo tile, and a 1400×560 marquee are stored locally for dashboard upload. | `website/store-assets/` |
| **No broken references** — fixed the missing Monaco AMD `require.config` in the Diff Checker (was pointing at a nonexistent `code-editor/monaco-config.js`, so Monaco never loaded) and a dead favicon path in `completion_list.html`. | `src/diff-checker.js`, `src/diff-checker.html`, `src/completion_list.html` |
| **Metadata accuracy** — removed the trailing space from the manifest `name` ("Salesforce Comet"); current release version is maintained in `manifest.json`. | `manifest.json` |

## 🧩 Permission justification (paste into your dashboard notes)

| Permission | Why it's required |
| :-- | :-- |
| `host_permissions` (`*.salesforce.com` etc.) | The tool must talk to **any** Salesforce org the user opens; there is no fixed domain list. |
| `cookies` | Session-based auth: reads the org's existing `sid` cookie and sets it for session-switching (never accessed for other sites). |
| `storage` | The local account vault (encrypted), settings, and caches. |
| `scripting` | Injects the dev-tools UI (`main.js`) into authorized Salesforce hosts on demand; injects the console suppressor in the MAIN world. |
| `alarms` | Runs the one-shot 40-second watchdog that deletes transient quick-login credentials. |
| `contextMenus` | Adds an optional Salesforce-only right-click menu that opens selected extension tools such as Data Export, Comet Launcher, Code Editor, and user-configured shortcuts. It is restricted to Salesforce page patterns and does not read, store, or transmit the clicked page, link, selection, or field contents. |

## 📋 Dashboard actions (you must do — not code)

1. **Category:** select **Developer Tools**.
2. **Single purpose statement** (draft): *"A suite of developer tools for Salesforce admins and developers: record inspection, SOQL/data export & import, metadata browsing, debug logs, and flow scanning — running against the org you're logged into."*
3. **Privacy fields:** the dashboard asks for data-collection certifications. Be accurate: the extension reads the user's Salesforce session and stores org credentials locally (encrypted). Choose the certifications that match `PRIVACY.md` and set the **Privacy Policy URL** to a hosted copy of `PRIVACY.md` (GitHub Pages, your site, etc.).
4. **Screenshots & promo:** upload the prepared assets from `website/store-assets/` and review them once more for store-listing accuracy and any org-identifying information.
5. **Verified identity:** complete **publisher verification** (trader verification for the EU) and enable **2-Step Verification** on the developer Google account — both are mandatory for publishing.
6. **Nominate for Featured** after publishing via **One Stop Support** (requires: published & public item, English support, no active policy violations, core features free/no login wall).
7. **Support URL:** use `https://github.com/salesforcecomet/Salesforcecomet.github.io/issues`. It is public and was verified to return HTTP 200. Do not use the old Google Form; it returns HTTP 401 to unauthenticated availability checks.

## ⚠️ Residual risks to decide on

- **Single purpose, continued:** the popup is a mini password manager ("vault") attached to a dev-tools
  extension. Password managers + dev tools are arguably two products under the Quality Guidelines. If a
  reviewer objects, the safest move is to ship the vault as a **separate extension**. Keep the decision
  documented.
- **`fetchBlob` in the service worker** uses `FileReader`; if Chrome ever drops it there, replace with
  `blob.arrayBuffer()` + base64.
- **English language support:** the UI is English — keep it that way in the listing (required for nomination).
- **Do not re-add remote content** (video feeds, changelogs from your GitHub, etc.) — remote fetches were
  the #1 review risk and are now gone.

## Re-check before every submission

```
node --check src/background.js src/content.js src/api.js src/main.js src/popup.js
node --check src/vault-crypto.js src/flow-scanner-content/interceptor.js src/flow-scanner-content/content-script.js
node build.js        # produces dist/ + salesforce-comet-v<manifest-version>-production.zip
grep -rn "raw.githubusercontent" src/   # must return nothing
grep -rn "eval(" src/ -l --include="*.js" | grep -v -E "lib/|react"  # must return nothing
grep -rn "<script>" src/*.html          # must return nothing (inline scripts are CSP-blocked)
# Optional: verify every local src=/href= in src/*.html resolves to an existing file
```

## ✅ Full re-audit — Aug 16, 2026 (all green)

Ran the complete featured-badge audit again; every item below passed:

| Check | Result |
| :-- | :-- |
| All 65+ JS source files parse as ESM (`node --input-type=module --check`) | ✅ |
| No `raw.githubusercontent` / GitHub remote content | ✅ |
| No `eval(`, `new Function`, or string `setTimeout`/`setInterval` outside vendored `lib/`/`react` | ✅ |
| No inline `<script>` or inline event handlers in any HTML | ✅ |
| CSP `script-src 'self'` (no `unsafe-eval`), `frame-src`/`style-src` scoped to Salesforce + fonts | ✅ |
| Every `fetch`/`XMLHttpRequest` targets Salesforce hosts only (`*.salesforce.com` API/oauth endpoints, or local extension URLs) | ✅ |
| No telemetry / analytics SDKs; extension collects nothing (only suppresses Salesforce's own o11y logs) | ✅ |
| No hardcoded `chrome-extension://` IDs | ✅ |
| All local `src=`/`href=` in `src/*.html` resolve to real files — **fixed** the dangling `panel.js` script in the orphaned `src/panel.html` | ✅ |
| Icons 16/48/128 are valid PNGs; popup title, manifest name, README version (3.1.1) all consistent | ✅ |
| Vault uses AES-256-GCM + PBKDF2-310k, key in memory only; one-click-login creds wiped after 40s | ✅ |
| `dist/` + `salesforce-comet-production.zip` rebuilt and parse cleanly | ✅ |

### Remaining reviewer-facing notes (unchanged)

- The popup vault is a mini password manager inside a dev-tools extension — the single-purpose
  judgment call documented above. Keep the dashboard's single-purpose statement focused on the
  dev tools; the vault is just credential storage for one-click Salesforce login.
- Dashboard actions (category, privacy certifications, screenshots, publisher verification,
  nomination) are listing-side and still required — see the section above.
