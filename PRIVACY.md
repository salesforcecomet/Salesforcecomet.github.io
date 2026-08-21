# Salesforce Comet — Privacy Policy

*Last updated: August 2026*

This policy describes how the **Salesforce Comet** browser extension ("the extension", "we", "our") handles data. The extension is a developer tool for Salesforce administrators, developers, and architects. It runs entirely in your browser and does not operate a server of our own.

## Data the extension handles

### 1. Salesforce session (the `sid` cookie)
To call the Salesforce REST / Tooling APIs on your behalf, the extension reads your existing Salesforce session cookie (`sid`) from the org you are already logged into. This is done locally, in your browser, using the browser's cookie APIs.

- **Use:** Authentication for API calls that power the extension's features (record inspection, data export/import, metadata browsing, debug logs, flow scanning, etc.).
- **Transmission:** The session token is only ever sent to **your own Salesforce orgs** as the Authorization header of API requests you trigger. It is never sent to us or to any third party.
- **Storage:** The session token is kept in memory while features run. A timestamped copy may be cached for up to 10 minutes in Chrome's in-memory `storage.session` area so standalone tool tabs (for example, the log viewer) can initialize. It is never written to disk by the extension and is discarded when Chrome restarts.

### 2. Saved org accounts ("the vault")
The popup lets you save the login details (name, username, password, login URL, color) of Salesforce orgs for one-click login.

- **Storage:** All data is stored **locally in your browser** via `chrome.storage.local`.
- **Encryption:** Passwords are **encrypted at rest** with AES-256-GCM using a key derived (PBKDF2, 310,000 iterations) from a **master passphrase that you create**. The master passphrase itself is never stored; the derived key lives only in memory for the current browser session and is wiped when the browser restarts. If you forget the master passphrase, encrypted passwords cannot be recovered and must be re-entered.
- **Transmission:** Saved credentials are never transmitted anywhere. During one-click login, the password is written to a temporary local storage slot for at most 40 seconds so the login page can fill it in; it is then deleted.

### 3. Salesforce org data you interact with
Records, metadata, Apex code, debug logs, flow definitions, and similar data are fetched from **your Salesforce orgs** via their official APIs when you use a feature. The extension renders this data locally. Nothing is uploaded to us.

### 4. Browsing activity
The extension only runs on Salesforce domains (`*.salesforce.com`, `*.force.com`, `*.salesforce-setup.com`, `*.visualforce.com`, and related). It does not collect, store, or transmit your general browsing activity.

## What the extension does NOT do

- No advertising, analytics, or tracking.
- No sale, transfer, or sharing of user data with third parties.
- No data is sent to our servers — the extension has no backend.
- No use of the data for personalization, creditworthiness, or any other purpose beyond the extension's single purpose as a Salesforce development tool.

## External links

- On uninstall, you are offered the option to complete an anonymous feedback survey hosted on Google Forms (`docs.google.com`). Participation is optional; the survey receives only what you choose to type.
- The extension contains no remote executable code. All logic ships inside the extension package.
- Extension interface fonts are bundled locally; extension pages do not contact a font CDN.

## User controls and deletion

- **Vault:** You can delete individual accounts or whole groups from the popup. To delete everything, remove the extension — uninstalling the extension removes all data it stored in browser storage.
- **Permissions:** You can revoke the extension's permissions at any time from `chrome://extensions`.

## Limited Use disclosure

The use of information received from Salesforce APIs by this extension adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

For privacy questions or data requests, contact the publisher through the contact information listed on the extension's Chrome Web Store listing.
