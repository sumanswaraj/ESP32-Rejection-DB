# ESP32 Rejection Logger — Apps Script v3.2.1

Google Sheets and Apps Script backend with a built-in shop-floor dashboard, individual accounts, logger/machine/part registration, job controls, quantity reports and ESP32 schema-v2 ingestion. This repository contains the active Apps Script source; firmware and the flashing tool are maintained separately.

## Included in this version

- Dashboard with day, Monday-based week, month and custom-date filters; charts by defect, machine, part and logger.
- Registered-entity search, QR photo decoding, a separate HTTPS live-camera window, and a copy/paste fallback.
- Active-job and registry refresh, stable report/history pages, CSV export, company branding and an optional machine operator field.
- Authenticated device ingestion, immutable job snapshots, event ID/hash checks, duplicate receipts and safe retry handling.

## Install or update

| Your installation | Instructions |
| --- | --- |
| New Google Sheet | [INSTALL.md](INSTALL.md) |
| Existing v3.1 backend | [UPGRADE_DASHBOARD.md](UPGRADE_DASHBOARD.md) |
| Existing v3.2 backend; camera repair only | [CAMERA_FIX.md](CAMERA_FIX.md) |

All **15 `.gs` files, nine HTML files and `appsscript.json`** are required for a complete installation. Add Script and HTML files under the same names in the sheet-bound Apps Script editor. Files in `tests/` and `licenses/`, and Markdown documents, are not Apps Script editor modules.

For an existing installation, back up its source and workbook before applying changes. Update its current deployment through **Deploy → Manage deployments → Edit → New version**, preserving its execution/access settings and `/exec` URL. Committing to GitHub stores the source; it does not deploy a Google web app automatically.

API keys, accounts, password hashes, session tokens and Script Properties are generated or maintained in the private Google installation. They are not included in this source repository.

## Current limits

Reports are limited to **50,000 event rows in the active workbook**, including when a date filter selects fewer rows. The initial report reads that workbook's event ledger before applying filters; displaying 5 or 10 rows is pagination, not a large-dataset storage solution. Firmware ingestion may continue beyond this reporting limit while Google storage and service quotas permit it.

Automatic archive rotation and a database backend for millions of events are **not implemented in v3.2.1**. See [CAPACITY.md](CAPACITY.md) for the planned changes. Increasing the report constant alone does not solve those limitations.

The live-camera companion is currently private to its owner's ChatGPT account. Operator access without ChatGPT sign-in requires a separate audience change. Photo/image scanning and paste/manual entry remain available. See [CAMERA_FIX.md](CAMERA_FIX.md).

## Local checks

With Node.js and npm available, run from this repository's root:

```bash
npm ci --prefix tests --ignore-scripts --no-audit --no-fund
node tests/test_backend.cjs
node tests/test_client.cjs
```

The tests use mocked Apps Script services and a DOM implementation. A physical ESP32/mobile-camera test must still be performed on the actual hardware. See [VALIDATION.md](VALIDATION.md).

jsQR 1.4.0 is bundled unchanged; its Apache 2.0 license is included in `QRDecoder.html` and `licenses/jsQR-LICENSE.txt`. The QR encoder's MIT notice is retained in `QR.html`.
