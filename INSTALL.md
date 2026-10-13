# ESP32 Rejection Logger — modular Apps Script v3.2.1

This package initializes any blank Google Sheet and supplies the shop-floor portal, accounts, IDs, job controls and ESP32 schema-v2 backend. It uses Google Sheets and Apps Script. No email address or spreadsheet ID is predefined in source.

For an existing working installation, follow **UPGRADE_DASHBOARD.md**.

## Install

1. Create or open your blank Google Sheet, then choose **Extensions → Apps Script**. Create the script from the sheet, rather than a standalone project at script.google.com.
2. Delete the unused default `myFunction` stub. Add each of the **15 `.gs` files** in this folder using **+ → Script**. Give each the same filename without the `.gs` suffix and paste its contents. All modules are required. Apps Script shares one global namespace across these files; there are no imports to configure.
3. Add **nine HTML files** using **+ → HTML**: `Index`, `Styles`, `Client`, `QR`, `Branding`, `Dashboard`, `EntityPicker`, `Scanner`, and `QRDecoder`. Paste the matching file contents. Keep these names exactly; `11_Api.gs` includes them by name. QR generation is bundled, so no CDN or third-party QR service is required.
4. In Project Settings, enable **Show appsscript.json manifest file in editor**. Replace the manifest with the supplied `appsscript.json`. It requests spreadsheet and container UI access, uses V8, and sets the script timezone to Asia/Kolkata.
5. Save. Select **setupRejectionLogger** and click **Run**. Approve the normal Google authorization prompt. Setup finds the attached sheet automatically, creates the required structure, generates its API key, and stores the detected sheet ID in Script Properties for future web requests. **Do not manually enter a spreadsheet ID or an email.**
6. Switch back to the sheet. Copy the **owner login ID and temporary password** shown in its dialog. The password is shown once and stored as a salted, peppered PBKDF2 password hash. Setup returns no plaintext credentials in its execution result. Reload the sheet to see the **QC Logger** menu.
7. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Deploy and copy the **`/exec` URL**. The custom user portal requires its own ID/password sign-in; device requests use their API key. Keep the underlying spreadsheet private to trusted maintainers.
8. In `Config`, paste that URL into the Value cell beside `Apps_Script_URL`, and set `Endpoint_Status` to `DEPLOYED`. Enter the same `/exec` URL and the generated `API_Key` in the ESP32 local setup page.
9. Open `/exec`, sign in with the generated owner credentials, and change the temporary password. Sign in again, create the needed user accounts, register your logger/machine/part, and start a job.

Google authorization and web-app deployment are one-time owner actions; pasting source alone cannot perform them. The web-app ID changes when you create a new deployment. For subsequent code updates, use **Deploy → Manage deployments → Edit → New version** to retain an existing `/exec` URL.

## Modules

| File | Responsibility |
| --- | --- |
| 01_Config.gs | Version, limits, schemas, role and defect/key definitions |
| 02_Storage.gs | Input validation, locks, per-request read cache, header-mapped reads/writes and request fingerprints |
| 03_Setup.gs | Attached-sheet discovery, all tabs/headers/labels/legends/formulas, owner bootstrap and recovery |
| 04_Crypto.gs | Optimized PBKDF2-HMAC-SHA-256 engine adapted from Saransh Workx |
| 05_Auth.gs | Password rules, throttled login, forced password change and revocable sessions |
| 06_Users.gs | User ID creation, account updates, role checks and password reset |
| 07_Entities.gs | Logger, molding-machine and part IDs, registration and enable/disable controls |
| 08_Jobs.gs | Start, stop, changeover, conflict checks and immutable assignment history |
| 09_Firmware.gs | ESP32 assignment polling, immutable events, quantity, hash checks and duplicate receipts |
| 10_Reports.gs | Event-time filters, quantity totals, pagination, fixed snapshots and short-lived report caching |
| 11_Api.gs | `doGet`, `doPost`, authenticated portal router and initial metadata |
| 12_Diagnostics.gs | Safe setup checks without returning any credentials |
| 13_Branding.gs | Company name/logo validation, role-controlled settings and atomic revision/retry handling |
| 14_History.gs | Bounded 5/10-row job history reads and stable paging |
| 15_Dashboard.gs | Authenticated registry/job refresh and additive upgrade checks |
| Dashboard.html | Built-in quantity charts, period presets and latest events |
| EntityPicker.html | Registered-entity search and keyboard selection |
| Scanner.html | Local photo QR decoding and optional live camera |
| QRDecoder.html | Bundled jsQR 1.4.0 decoder with Apache 2.0 license |
| Index.html | Portal layout and forms |
| Styles.html | Responsive styles and print layouts |
| Client.html | Asynchronous calls, on-demand reports, account/job forms, CSV export and QR labels |
| QR.html | Local QR encoder and its MIT license |
| Branding.html | Original-logo file/SVG/URL input, safe preview and company settings |

## Generated sheets

| Tab | Purpose |
| --- | --- |
| ESP32_Log | Accepted event ledger, quantity and immutable job/device snapshot |
| Defect_Master | 16 defect codes and original keypad keys |
| Report_Data | Formula-driven report fields, dates, quantities, logger, molding machine and part |
| QR_Master | Registered entities, stable IDs and QR text |
| Job_Assignments | Job start/end, logger, machine, part, optional machine operator, actor and changeover metadata |
| Config | Generated device API key, endpoint settings, timezone and app settings |
| Setup | Installation and operating instructions |
| Legends | Defect/key/touch mappings, roles, statuses, units, time and receipt meanings |
| Dashboard | Whole-sheet piece totals, defect summary, machine/date summary formulas and defect chart |
| Users | User IDs, roles, hashed credentials and revocation versions |
| Sessions | Hashed session tokens and expiry |
| Audit_Log | User/admin/entity/job actions and actor IDs |

Setup adds all 12 required tabs. It keeps `Sheet1` and unrelated tabs. It creates no test events, sample equipment, fake assignments or extra user accounts. The generated first owner is the only initial login.

Rerunning setup preserves API keys, owner credentials, logs, jobs and users. It initializes missing tabs/blank formula cells and keeps a customized Dashboard. A reserved tab with incompatible headers stops setup without clearing its records. Deleting historical tabs cannot be undone by running setup.

### Fix for OWNER_SETUP_REQUIRED on a blank sheet

The updated `02_Storage.gs` ignores rows containing only checkbox values in Users and QR_Master. Google Sheets may populate unused Enabled checkboxes with FALSE; these are not accounts. It also writes new accounts/entities after the last meaningful record, so the first owner uses row 2 rather than being appended after the checkbox range.

If you installed the previous package and setup failed with `OWNER_SETUP_REQUIRED`, replace **only the complete contents of `02_Storage.gs`** with the supplied updated file, save, and run `setupRejectionLogger` again. Do not add a second copy of that module. Switch to the attached sheet to copy the generated owner login ID and temporary password. No tabs, API key or Script Properties need to be deleted. Existing actual accounts and their credentials remain preserved. If this error still occurs, there is non-checkbox account data without an OWNER and it needs review; the fix does not automatically promote an existing account.

## User control

| Role | Permissions |
| --- | --- |
| OWNER | All app controls; company branding; creates/manages Admin rights and Operator/Viewer accounts |
| ADMIN | Company branding; registers/updates equipment and parts; operates jobs; creates, resets and disables Operator/Viewer accounts |
| OPERATOR | Starts, stops and changes jobs; views reports and prints QR labels |
| VIEWER | Reads reports, registry and legends; has no write actions |

Owner cannot be disabled or demoted through the portal. Owner recovery requires the attached sheet editor or **QC Logger → Recover owner login**; it shows a new temporary password and revokes earlier owner sessions. No email matching is used. Trusted sheet editors can maintain the underlying code and data; application roles are for people using the portal without sheet access.

Create a custom user ID or leave it blank to generate one. User IDs use 3–64 lowercase letters, numbers, dots, dashes or underscores. Passwords use 12–128 characters. New and reset passwords must be changed at first sign-in. Role/account changes and password resets revoke old sessions immediately, including access to cached reports. Sessions expire after six hours and are limited to five per user.

## Logger, machine, part and QR controls

Register `LOGGER`, `MACHINE`, and `PART` in the portal. Custom IDs use letters, numbers, dashes or underscores and are case-sensitive. A blank ID generates one. For a logger, the registry ID **must exactly match the device ID configured on the ESP32**. Register the device's actual ID, or commission the ESP32 with the generated ID before the first recorded event. Existing firmware locks identity after capture to preserve queued records.

QR payloads are `QC:LOGGER:<ID>`, `QC:MACHINE:<ID>`, or `QC:PART:<ID>`. The portal generates printable QR labels locally. The three job fields accept a selected ID or a QR payload from a keyboard scanner; phone camera scanning is not included in this package.

Only one active job per logger and per molding machine is allowed. Start saves its actor ID and optional machine operator name/employee ID separately. The machine operator does not need a portal account. Stop requires a reason and saves the separate closing actor ID. Changeover retains the previous job and creates a new immutable job ID at the same changeover timestamp. Its closure and new row use one contiguous range write under a script lock; same-request retries find the recorded new job rather than repeating the operation. Keep Job_Assignments as a system ledger; changeover refuses a span containing formulas.

**Verify the applied job ID on the ESP32 status page after start/changeover and before using the new part.** The firmware polls assignments; this package does not add a two-phase handshake with the physical logger.

## Firmware compatibility

Works with the Google Sheets schema-v2 ESP32 firmware already provided. Both device actions are POST JSON:

- `qc_get_assignment_v2`: API key and device ID; returns the active immutable assignment.
- `qc_ingest_v2`: API key, device ID, unchanged `record_json` and its SHA-256 `payload_hash`.

The service authenticates registered/enabled loggers, verifies schema/code/quantity/hash/job snapshot, and appends one event row. `committed` and `duplicate` receipts contain the matching Event_ID and hash. Only a valid receipt lets the firmware remove its queued event. Duplicate event IDs with a different hash are refused. Replay of a known historical assignment keeps its original logger/machine/part; synchronized event times must fall within that job's recorded start/end tolerance.

Codes 1–16 map to keypad keys `1 2 3 4 5 6 7 8 9 0 A B C D * #`; touch pad 1–16 maps directly to the same codes. Quantity 1–9999 counts rejected pieces. `New_Total_Count` retains the cumulative accepted-piece count. The counter optimization is a rebuildable cache tied to the ledger row count and workbook; the event row is authoritative.

## Reports and responsiveness

- Dashboard totals use quantity sums; they do not count presses as pieces.
- Report_Data formulas and the portal use Occurred_At when device time is known, otherwise Server_Timestamp. A custom existing reporting formula is preserved.
- Filter the portal by dates, logger, physical machine, part, defect and real/sample records. `Report_Data.Logger_ID` is the logger; `Molding_Machine_ID` is the physical machine. No Looker connection is required.
- Reports load when opened; rejection details show 10 rows by default with a 5/10-row choice. Job history also defaults to 10 rows and reads only the selected history page. Previous/Next replaces the current list; there is no automatic append. Exports read the same fixed log-row snapshot in 500-row pages.
- Export all matching events as CSV. **Print summary / PDF** prints the summary, charts and currently displayed details page; the displayed-page limit appears in the printout.
- Reports cache filtered rows in bounded chunks for 60 seconds. Each request checks the current user/session before reading the cache. Cache loss simply rebuilds from the ledger. Appending a new event produces a different snapshot key.
- Per-request book, headers and table reads are reused. Mutations clear table caches inside their lock. Password hashing happens outside the write lock; its 600,000-iteration work factor is intentionally retained from Workx.
- The header and sidebar remain outside the scrolling main panel. On small screens the navigation is a fixed horizontal menu strip. Company settings accepts the company name and original logo image, HTTPS URL or SVG code.
- Authenticated live refresh checks active jobs and registry revisions every 30 seconds while the tab is active and no request is running. The built-in Dashboard refreshes when new events arrive; existing report pages retain their snapshot until Refresh. Dashboard live refresh can be paused.

Apps Script has network latency, cold starts and service quotas. These optimizations reduce repeated sheet transfers; real response times depend on your deployed account, log size and usage. The report reader limits each workbook to 50,000 log rows to keep responses bounded. Detail export includes every matching event within that limit. Reports show the top 10 defects/machines and latest 30 dates. Dashboard charts show the top 8 defects/machines/parts/loggers and latest 30 day/week/month periods; server summaries retain up to 100 entity groups, 366 days, 104 weeks and 120 months. For larger archives, split reporting into another workbook. Firmware ingest does not impose this report limit.

## Built-in Dashboard and QR selection

The default signed-in view is Dashboard. Select Today, This week (Monday start), This month, All dates, or a custom date range. Filter by registered logger, molding machine, part and defect. Totals sum rejection quantities; they are not a rejection rate. Open filtered report carries the dashboard filters to the detailed report.

Choose opens the registered list even when a current ID is present. Scan accepts a camera photo or image file and decodes it locally using the bundled jsQR decoder. A QR must match the field type and a registered ID. Disabled entities cannot be selected for a new job. Scanning fills a field; it never starts or changes a job automatically. A live camera is offered only when the browser and Apps Script iframe permit it. Camera/photo and manual ID entry remain available when live camera access is blocked. Photos are not uploaded to the backend.

Existing Looker_Data and Looker_Setup tabs are retained as legacy data during an upgrade; only recognized default Dashboard formulas move to Report_Data. Custom formulas remain unchanged. Fresh installs create no Looker tabs.

## Debug and validation

Run **checkRejectionLoggerSetup** from the editor, or **QC Logger → Check setup**. It checks tabs, headers, settings and the authentication secret without returning the API key, password hashes or session tokens. Visit `/exec?action=health` for an online/readiness response.

For failures, inspect the **Executions** panel and the module containing the relevant function. The portal displays an error code such as `AUTH`, `FORBIDDEN`, `BUSY_RETRY`, `REVISION_CONFLICT`, `HASH_MISMATCH`, `JOB_SNAPSHOT_MISMATCH`, or `SETUP_REQUIRED`. Job/entity/user writes carry request IDs and fingerprints so retries cannot silently duplicate them. Refresh after a revision conflict; enter corrected inputs after a validation error.

See VALIDATION.md for the included local verification and the on-device smoke test to perform after deploying. Deployment verification is recorded in VALIDATION.md. A physical ESP32 test must be completed on your hardware.

## Official references

- [Container-bound scripts and web-app context](https://developers.google.com/apps-script/guides/bound)
- [Script Properties](https://developers.google.com/apps-script/guides/properties)
- [Web-app deployment](https://developers.google.com/apps-script/guides/web)
- [HTML client/server calls and private functions](https://developers.google.com/apps-script/guides/html/communication)
- [Apps Script cache limits](https://developers.google.com/apps-script/reference/cache/cache)
- [Bundled QR encoder source](https://github.com/kazuhikoarase/qrcode-generator)
