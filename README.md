# Office Ops Workbench

Office Ops Workbench is a browser-based toolkit for recurring office document, Excel data processing and dashboard-style reporting tasks. It currently packages four existing standalone HTML utilities into one consistent interface.

Open `index.html` directly in a browser. No server or install step is required.

## Tools

| Tool | Purpose | Output |
| --- | --- | --- |
| Dashboard Analyzer | Counts pasted Excel cases across one or two pasted tables, calculates total / largest Sum Assured, summarizes extra value columns, and charts group distribution. | On-screen summary, pie chart, copy text and CSV |
| Comment Converter | Replaces lines containing only `Reply` with underline separators. | Copy-ready text |
| NiceActimize Report | Builds Part A daily summary and Part B policy ageing list from Ready / Investigation rows. Policy number is extracted with `MID(text,10,8)`. | Copy-ready report and CSV |
| High Risk Client Extractor | Filters pasted AML policy data by issue date, risk level and Everest broker rules. Large results render a limited preview while CSV export keeps all rows. | Highlighted table preview and full CSV |
| EDD Checking | Filters Table 1 by `DD/MM/YYYY` date range, joins policy details from Table 2, and checks Table 3 membership. | On-screen result and CSV |

## For Users

1. Choose a tool from the left navigation.
2. Paste Excel data directly from Excel into the relevant text areas.
3. Process the data.
4. Copy or export the result as CSV when available.

All processing happens locally in the browser. The app does not upload pasted data.

## For AI Agents

This project is intentionally static:

- `index.html` defines the app shell and tool panels.
- `styles.css` contains the unified visual system and responsive layout.
- `app.js` contains all tool logic and export functions.
- `VERSION` stores the current app version.
- `CHANGELOG.md` records user-facing changes.
- `scripts/version.mjs` determines whether the next update is major or minor from change labels.

When updating:

1. Keep existing tool logic compatible with the source HTML behavior unless the user asks for a rule change.
2. Update `CHANGELOG.md` for every user-visible change.
3. Run `node scripts/version.mjs "<change summary>"` before release documentation is finalized.
4. Copy the generated version into `VERSION`, `package.json`, `app.js` and the newest changelog heading.
5. Use a major bump for breaking workflow/data contract changes. Use a minor bump for additive tools, UI improvements, or non-breaking behavior changes.

## Versioning

The project uses simple semantic versioning:

- Major: incompatible input/output behavior, renamed tools, removed features, or changed CSV schemas.
- Minor: new tools, new export options, substantial UI additions, or non-breaking processing enhancements.
- Patch: reserved for future bug-fix-only releases.

The helper script automatically classifies the requested update as major or minor by scanning the update summary for breaking-change keywords.

## Current Version

`1.1.0`
