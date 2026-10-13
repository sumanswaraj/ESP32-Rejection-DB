# Dashboard and backend update — v3.2.1

Use the existing sheet-bound Apps Script project and its current deployment. The Google Sheets / Apps Script backend remains in place. No Looker connection is used.

## Apply to an existing v3.1 project

1. Retain a complete source backup and a spreadsheet backup before applying the files.
2. Replace the full contents of `01_Config.gs`, `03_Setup.gs`, `09_Firmware.gs`, `10_Reports.gs`, `11_Api.gs`, `Index.html`, `Styles.html`, and `Client.html`.
3. Add Script `15_Dashboard`, and HTML `Dashboard`, `EntityPicker`, `Scanner`, and `QRDecoder`, using the matching file contents. Keep one copy of each module. Existing files including authentication, accounts, QR generation and branding remain required.
4. Save the project. Run `applyRejectionLoggerUpgrade` once in the bound editor. This requires exactly one existing Owner, creates the neutral Report_Data sheet, repairs setup guidance, updates the installed version and checks that credential fingerprints and ledger row counts are unchanged. It never returns credential values.
5. Run `verifyRejectionLoggerUpgrade` for a read-only summary. Expect version and installedVersion 3.2.1, no missing sheets, and firmwareSchema 2.
6. Use Deploy → Manage deployments → select the current web app → Edit → New version → Deploy. Keep the existing execution identity and access settings. This retains that deployment's /exec URL.
7. Ensure Config Apps_Script_URL contains that same URL and Endpoint_Status is DEPLOYED. Reload the portal and sign in. The sidebar shows v3.2.1.

For a source older than v3.1, replace all the supplied modules and follow INSTALL.md; the additive setup also appends the existing optional machine operator and branding settings.

## Included changes

- Dashboard with rejected-piece totals, event count, active jobs and registered machine/logger counts.
- Quantity charts by defect, machine, part and logger, plus day/week/month trends.
- Today, Monday-based week, month, all-dates and custom ranges; combined ID/defect filters.
- Latest ten events and a link to the same filtered detailed report.
- Choose buttons with searchable registered IDs, including easy reselection of the current value.
- Scan buttons decode QC entity QR images locally. Wrong-type, unregistered and job-disabled IDs are refused. Scanning does not write a job.
- Authenticated 30-second refresh checks registry revisions and active jobs. New records update Dashboard while an open report retains its existing page/snapshot until Refresh.
- The onscreen rejection table omits Source. CSV exports retain the original record fields.
- Fresh installs create Report_Data and no Looker tabs. An upgrade preserves legacy tabs and custom formulas, migrating only recognized default Dashboard formulas.

The optional machine operator, company branding, 5/10-row history, complete CSV export and firmware schema-v2 receipts remain supported. Account permissions retain the existing Owner/Admin/Operator/Viewer rules. Proposed multi-person promotion/reset approval policies are not implemented by this version.

## Hardware and camera checks

Use Open live camera for the separate HTTPS camera window, or Camera photo / QR image for local photo decoding. Google's Apps Script iframe blocks live camera access. The standalone scanner is initially private to the owner's ChatGPT account; operator access without sign-in requires an explicit audience change. Copy/paste is available if the return connection is isolated. See CAMERA_FIX.md, and confirm behavior on the actual phone/browser.

After a real job start or changeover, confirm the immutable assignment ID on the ESP32 before collecting new-part events. This update preserves the existing polling protocol; it does not add a device acknowledgment handshake.

See VALIDATION.md for local checks and live deployment verification. The source prior to the live upgrade is supplied in PRE_UPGRADE_SOURCE for restoration; do not paste that folder alongside the active modules.
