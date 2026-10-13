# Fix the blank-sheet OWNER_SETUP_REQUIRED error

Only **02_Storage.gs** has changed among the application source files.

1. Open your attached sheet → Extensions → Apps Script.
2. Open the existing 02_Storage script. Replace its entire contents with the supplied 02_Storage.gs. Save. Do not create a duplicate module.
3. Select setupRejectionLogger and click Run.
4. Return to the spreadsheet and copy the owner login ID and temporary password from its dialog.

Users and QR_Master can contain hundreds of unused FALSE checkbox cells. These are now ignored when reading account/entity records. New accounts/entities reuse the trailing checkbox-only range; historical ledgers keep their original append order.

No sheet, property, API key or existing account needs to be deleted. Existing passwords and records are preserved. Existing real accounts without an OWNER still trigger the review safeguard; this patch does not promote any existing account.

Local regression tests passed. The corrected code has not been run in your live Apps Script project. If the web app is already deployed, publish a new version through Deploy → Manage deployments → Edit so its existing /exec URL uses the updated storage code.
