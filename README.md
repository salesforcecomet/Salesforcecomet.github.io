# Salesforce Comet 🚀

> **Version 3.1.1** | *Powerful, lightning-fast Salesforce development, inspection, and debugging extension.*

---

## 📖 Overview

**Salesforce Comet ** is an all-in-one browser extension designed for Salesforce Developers, Administrators, and Technical Architects. It transforms your Salesforce workflow with a modern **Command Palette (`Shift + Space`)**, deep record inspector, metadata tools, Apex code editor, log flag manager, and data import/export wizards.

---

## ✨ Key Features

### ⌨️ 1. Command Palette (`Shift + Space`)
- Instantly search and navigate across **Objects**, **Records**, **Apex Classes**, **Flows**, **Custom Metadata**, and **Setup Pages**.
- Direct execution of quick tools, log inspection, and schema viewing without leaving your active tab.

### 📇 2. Record Inspector ("Show All Data")
- View all fields, hidden attributes, audit fields, and formula values on any Salesforce record page.
- Export raw JSON or filter fields dynamically.
- Includes a 1-click **Record Cloner**.

### 👁️ 3. Field API Name Exposer
- Instantly overlay **Field API Names** onto Salesforce Lightning record layouts.
- Quick copy of API names for Apex, SOQL queries, and Flow building.

### ⚡ 4. LWC Component Exposer
- Inspect active **Lightning Web Components (LWC)** rendered on the DOM.
- View component hierarchy, state attributes, and shadow DOM targets.

### 🌳 5. Flow & Automation Inspector
- Inspect active Salesforce **Flows**, Subflows, Process Builders, and Workflow Rules.
- Quickly access flow definition details directly from page context.

### 🐛 6. Debug Log & Trace Flag Manager
- Create and manage **User Trace Flags** in real-time.
- **Log Level Checkbox Matrix**: Customize log levels (`NONE`, `ERROR`, `WARN`, `INFO`, `DEBUG`, `FINE`, `FINER`, `FINEST`) across categories (`Database`, `Workflow`, `Validation`, `Callout`, `Apex Code`, `Apex Profiling`, `Visualforce`, `System`) with 1-click checkbox rows.
- Filter, search, download, and analyze raw Apex log trace files.

### 📤 7. Data Export & Import Wizard
- **SOQL Query Runner**: Execute SOQL queries with automatic pagination, CSV export, and JSON export.
- **Data Import / Bulk Data Builder**: Import, update, and manage record payloads with safety checks.

### 💻 8. Integrated Code Editor & Log Viewer
- Built-in **Monaco Editor** tailored for Apex, Visualforce, and SOQL.
- Real-time test execution, code search, and debug log analyzer.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| <kbd>Shift</kbd> + <kbd>Space</kbd> | Toggle Salesforce Comet Command Palette / Inspector Panel |
| <kbd>Alt</kbd> + <kbd>E</kbd> | Open Data Export Wizard |
| <kbd>Escape</kbd> | Close Panel, Drawers, or Active Modals |

---

## 🛠️ Header Tool Bar Icons

When viewing any Salesforce Org, Salesforce Comet injects 4 quick-action tools into the top header bar:

1. 📇 **Show All Data** (`fa-address-card`): Inspect all raw record fields & JSON payload.
2. 👁️ **Field API Names** (`fa-eye`): Display API names directly on Lightning page fields.
3. ⚡ **LWC Inspector** (`fa-bolt`): Expose and debug Lightning Web Components.
4. 🌳 **Flow Inspector** (`svg`): Expose and view active Salesforce Flows.

---

## 📂 Repository Structure

```
.
├── manifest.json            # Extension Manifest V3 configuration
├── package.sh               # Packaging shell script (salesforce-arc-extension.zip)
├── src/
│   ├── main.js              # Primary Command Palette, UI, & Drawer Manager logic
│   ├── api.js               # Salesforce REST & Tooling API client
│   ├── background.js        # Extension Service Worker
│   ├── content.js           # DOM Injector & Page Bridge
│   ├── inspector.css        # Core Inspector, Drawer & Modal stylesheet
│   ├── code-editor/         # Monaco Code Editor & Terminal components
│   ├── styles/              # SLDS and SFIR themes
│   ├── data-export.js       # Data Exporter & SOQL Query Runner
│   ├── data-import.js       # Data Importer & Bulk Operations
│   ├── log-viewer.js        # Debug Log Viewer & Log Parser
│   ├── record-viewer.js     # Show All Data & Record Details UI
│   └── settings.js          # Extension Settings Manager
├── icons/                   # Extension icons (16px, 48px, 128px)
└── lib/                     # External dependencies & Monaco Editor files
```

---

## 📦 Installation & Setup

1. **Clone / Download** this repository.
2. Open **Google Chrome** and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the root directory of this extension.
5. Open any **Salesforce Org** (`*.lightning.force.com` or `*.my.salesforce.com`) and press <kbd>Shift</kbd> + <kbd>Space</kbd>.

---

## 🚀 Building & Packaging

To generate a clean zip package for Chrome Web Store distribution:

```bash
chmod +x package.sh
./package.sh
```

This creates `salesforce-arc-extension.zip` in the root folder.

---

## 🔐 Privacy & Data Handling

- Saved org credentials are stored **locally** in your browser, **encrypted at rest** (AES-256-GCM, key derived from a master passphrase you create). The passphrase is never stored and the key exists only in memory for the current browser session.
- Salesforce session tokens are used only to call your own orgs' APIs; they are never sent anywhere else.
- The extension has no backend, no analytics, and no third-party data sharing. See [`PRIVACY.md`](PRIVACY.md) and [`CHROME_WEB_STORE_COMPLIANCE.md`](CHROME_WEB_STORE_COMPLIANCE.md).

---

## 📄 License

Internal / Proprietary Extension for Salesforce Development & Administration.
