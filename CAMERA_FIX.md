# Live camera fix — v3.2.1

Google Apps Script blocks getUserMedia camera access in its HTML Service iframe. Changing HtmlService's sandbox mode does not grant that permission. Google's troubleshooting guide recommends placing the permission-dependent feature on a separate domain and opening a new window:

https://developers.google.com/apps-script/guides/support/troubleshooting

## Installed behavior

The existing Scan dialog now offers **Open live camera**, photo/image scanning, and **Paste scanned QR → Use code**. The camera button opens this standalone HTTPS companion:

https://qc-camera-scanner.proudaphid4.chatgpt.site

Choose Start camera there and allow camera access in your browser. It requests video only, uses the rear camera when available, decodes QR images locally, and stops the camera after a successful scan, cancellation or leaving the page. It uploads no camera frames and stores no scan history.

The companion is initially private to the owner's ChatGPT account. An explicit audience change is still needed to make it usable by factory operators without ChatGPT sign-in. The companion contains no API key, password, account token, registry data or backend connection. Making only that static scanner public does not make the logger's account data public.

The return connection sends only the scanned QC label to the initiating Apps Script window. The parent checks the exact companion origin, opened-window identity, a random one-use nonce, entity type and registered ID; job fields also reject disabled entities. A scan only selects a field. The operator must still explicitly start/change a job.

If a browser isolates the windows, or private-site sign-in interrupts their connection, copy the scanned code and paste it into Paste scanned QR in the logger. Photo/image scanning and manual IDs remain available.

## Verify on the actual device

1. Reload the logger, sign in, and open Scan for the required field.
2. Choose Open live camera, then Start camera in the new window. Allow camera permission for the scanner.
3. Scan a registered QR of the matching type. Confirm the selected field fills and no job starts automatically.
4. If it stays empty, choose Copy code, return to the logger, paste the whole QC label, and choose Use code.
5. Close the scanner or stop the camera. Confirm your browser's camera indicator turns off.

If the window is blocked, allow popups for the logger or use the photo path. If camera permission is denied, allow it in the scanner site's browser settings and retry. A busy or missing camera has a specific message. No firmware reflash is needed for this camera update.

## Apply this fix to an existing v3.2 install

Replace only 01_Config.gs, Index.html and Scanner.html, save, and update the current deployment to a new version without changing its execution identity, access settings or /exec URL. Set the existing Config App_Version cell to 3.2.1. This fix does not require rerunning setup or altering account, job or rejection records.

PRE_CAMERA_FIX_SOURCE contains the exact v3.2 contents of those three files. The earlier deployment version 18 remains available for rollback. To roll back, restore those files, restore Config App_Version to 3.2, and deploy the saved version 18 or a new version of the restored source.

## Validation limits

The local client tests cover credential-free popup URLs, exact source/origin/nonce validation, stale-window rejection, registry/enabled-ID checks, camera popup cleanup and paste fallback. The companion's own source checks cover local typed QR detection, its exact return destination and releasing tracks after success, page hiding or a late permission result. Both source sets and the backend regression suite passed.

A physical camera test is still required on the user's phone/laptop. The companion could not be visually tested in the managed development browser because the supported Sites browser-preview capability was unavailable. Native hosting reported the companion deployment successful. Apps Script reported deployment version 19 successful; a fresh editor read matched all three changed files. The read-only backend check reported app/installed version 3.2.1, no missing sheets, firmware schema 2, and unchanged counts of 49 events, 2 jobs and 4 users.
