# Changelog

All notable changes to Office Ops Workbench are recorded here. Version type is determined before each release using `scripts/version.mjs`.

## [2.1.0] - 2026-05-28

### Minor

- Limited Dashboard Daily and Monthly pasted rows to the required report columns even when pasted data has extra columns.
- Added range filter operators for Dashboard filters.
- Added multi-field pie chart grouping based on the currently filtered Dashboard records.

## [2.0.0] - 2026-05-27

### Major

- Changed Dashboard into a Daily report plus Monthly report policy lookup dashboard.
- Added policy-number key matching between Daily and Monthly report data.
- Added add/delete multi-filter rows for dashboard result filtering.
- Added highlighted red cells for missing values and failed monthly lookups.
- Changed Dashboard table and CSV export to policy-level joined records.
- Updated pie chart to use filtered dashboard records.

## [1.1.0] - 2026-05-27

### Minor

- Updated Dashboard copy links for Monthly PolicyExt and Daily Policy List report folders.
- Added secondary table paste support for Dashboard analysis.
- Added extra value column summaries for flexible checks such as plan code, premium, plan name and submission values.
- Added Dashboard pie chart grouped by case count or Sum Assured.

## [1.0.0] - 2026-05-27

### Major

- Renamed Actimize Report to NiceActimize Report.
- Renamed HRC Extractor to High Risk Client Extractor.
- Changed NiceActimize default Status column to F and Policy column to G.
- Changed NiceActimize policy number extraction to use Excel-style `MID(text,10,8)`.
- Optimized High Risk Client Extractor for large pasted data by rendering a limited on-screen preview while preserving full CSV export.

## [0.3.0] - 2026-05-27

### Minor

- Changed Dashboard into a functional analyzer for pasted Excel data.
- Added configurable case, Sum Assured and optional group columns.
- Added case count, unique case count, total Sum Assured, largest Sum Assured, copy summary and CSV export.
- Added a dashboard copy-link area for report paths and future hyperlinks.
- Reduced the dashboard's visual scale so the first screen is more work-focused.

## [0.2.0] - 2026-05-27

### Minor

- Reordered tool navigation and dashboard cards to: Comment Converter, Actimize Report, HRC Extractor, EDD Checking.

## [0.1.0] - 2026-05-27

### Minor

- Created the first unified Office Ops Workbench web app.
- Repackaged Comment Converter, EDD Checking, HRC Extractor and Actimize Report into one consistent interface.
- Added CSV export, copy actions, dashboard overview, responsive styling and local-only browser processing.
- Preserved leading empty Excel columns when parsing pasted tab-delimited data.
- Added README guidance for users and future AI agents.
- Added versioning helper for automatic major/minor classification.
