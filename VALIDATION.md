# Validation — v3.2.1

Backend modules were executed against mocked Apps Script services. The client scripts and bundled decoder were executed against a DOM implementation and a mocked google.script.run bridge. These tests check logic and security boundaries; they do not measure Google service latency or replace a physical ESP32/mobile-camera test.

## Passed local checks

- Piece totals by part, logger, defect, machine, Monday-based week and month; combined historical filters and valid date ranges.
- Unusual entity IDs, safe text rendering, CSV formula escaping, authenticated refresh and absence of private credential values in responses.
- Additive migration creates Report_Data and retains legacy Looker tabs, custom Dashboard formulas, accounts, API key, authentication secret and complete event/job ledgers.
- Fresh setup creates all twelve required tabs on two arbitrary workbooks without a fixed email or spreadsheet ID. Reruns retain data and credentials.
- Checkbox-only rows do not become accounts/entities; actual disabled accounts and incomplete credential records remain visible to setup safeguards.
- Real QR raster and inverted-raster decoding using jsQR, strict type/registered-ID checks, searchable reselection, and scanning without job writes.
- External-camera URLs contain no credentials; exact popup source/origin/nonce checks, stale messages, unregistered/disabled IDs, popup cleanup and copy/paste fallback.
- Dashboard date presets, latest-ten-event limit, stale-response rejection and stable report pages during background refresh.
- 5/10-row rejection/history pagination, bounded history reads, stable snapshots, correct final page, explicit complete CSV export and cache fallback.
- Owner/Admin/Operator/Viewer server permissions; forced password changes, session revocation, role changes and login throttling.
- PBKDF2 results match native crypto at 1, 2, 1,000 and 600,000 iterations. Subsequent account test fixtures use the equivalent native KDF to reduce test time.
- Idempotent entity/user/job requests, job conflicts, changeover history, optional machine operator and separate login actor.
- Schema-v2 assignment polling, quantities, payload hashes, duplicate receipts, conflicting replay refusal, historical snapshots and response-loss recovery.
- Company branding roles, revision/retry safety, original SVG/image/URL validation, safe boot metadata and preservation during setup.

## Live verification

On 11 October 2026, the existing deployment was updated from version 17 to version 18 using the same /exec URL and unchanged execution/access settings. All 25 persisted project files were read back in a fresh editor view and matched the tested source. The additive upgrade completed and reported preserved credential fingerprints and event/job row counts.

The v3.2 bound-server check returned success, code/installed version 3.2, no missing required sheets, firmware schema 2, 49 event rows, 2 job rows, 4 accounts and endpointConfigured true. Config Apps_Script_URL and Endpoint_Status were saved and read back through the sheet UI. The live portal rendered its sign-in screen.

The camera repair then updated the same deployment to version 19 / app v3.2.1. All three changed files were read back in a fresh editor view and matched the tested source. Config App_Version was saved and read back as 3.2.1. The read-only server check returned code/installed version 3.2.1 with the same row/account counts and no missing sheets. Native Sites hosting reported the private camera companion successfully deployed. Its own local checks passed for typed results, exact return destinations and camera-track release after scan/hide/cancellation. See CAMERA_FIX.md for the current private audience, on-device checks and preview limitations.

Signed-in dashboard visual checks remain pending: secure credential entry could not validate the nested Apps Script login frame. A browser takeover is required for that check. The public health page was not verified because this browser reported ERR_BLOCKED_BY_CLIENT on its navigation. No test job or synthetic rejection event was written to the production workbook.

## On-device checks

Confirm the updated dashboard on a real desktop and phone, photo QR scanning, a real assignment ID on the ESP32, one rejection quantity, offline queue replay without duplicates, and a real part changeover. Compare filtered quantities with ESP32_Log. Existing firmware uses schema 2; no firmware reflash is required solely for this dashboard upgrade.

## Reproduce local checks

From the project folder:

```bash
npm ci --prefix tests --ignore-scripts --no-audit --no-fund
node tests/test_backend.cjs
node tests/test_client.cjs
```

Node dependencies are for local tests only. The deployed app requires no npm installation or decoder CDN. jsQR 1.4.0 is bundled unchanged with its Apache 2.0 license in QRDecoder.html and licenses/jsQR-LICENSE.txt.
