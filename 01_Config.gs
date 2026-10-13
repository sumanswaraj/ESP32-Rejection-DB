/**
 * ESP32 Rejection Logger — portable Google Sheets / Apps Script app, v3.2.1.
 *
 * INSTALL ON ANY BLANK GOOGLE SHEET:
 * 1. Open that sheet > Extensions > Apps Script.
 * 2. Add every supplied .gs module and HTML file. See INSTALL.md.
 * 3. Save and run setupRejectionLogger. Authorize Google access when asked.
 *    Setup discovers its attached spreadsheet; no spreadsheet ID or email is entered.
 *    Save the owner login ID and temporary password shown in the sheet dialog.
 * 4. Deploy > New deployment > Web app > Execute as Me > Who has access: Anyone.
 *    Copy its /exec URL to Config!Apps_Script_URL and to the ESP32 setup page.
 *    Copy Config!API_Key to the ESP32 only. The portal never returns that key.
 * 5. Open /exec, sign in, change the temporary password, create accounts/entities,
 *    and start a logger + molding machine + part job. Verify the applied job on ESP32.
 *
 * Reload the sheet for the "QC Logger" menu. Setup is safe to run again: it keeps
 * existing records, keys, passwords and custom tabs. A conflicting reserved header
 * stops setup rather than clearing the sheet. Do not combine this full app with
 * another doGet/doPost or an older copy of this app.
 *
 * Portable setup uses getActiveSpreadsheet only in the bound editor/menu context.
 * Web requests use the spreadsheet ID automatically stored in Script Properties.
 * Sheet editors are trusted maintainers; portal roles control users without sheet
 * access. There is no public sign-up or email-based owner detection.
 *
 * Authentication/session patterns and the optimized PBKDF2 implementation are
 * adapted from your Saransh Workx v2.0.2 source. QR generation is bundled locally
 * from qrcode-generator 2.0.4 (MIT, Kazuhiko Arase; license below).
 */
// The appended, optional job field remains compatible with schema 3 and the
// deployed schema-2 firmware. Setup adds it without replacing existing records.
const QC_APP = Object.freeze({VERSION:'3.2.1', SCHEMA:'3', PASSWORD_ITERATIONS:600000,
  SESSION_SECONDS:21600, LOGIN_FAILURE_LIMIT:5, LOGIN_LOCK_MINUTES:15,
  LOGIN_GLOBAL_PER_MINUTE:30, MAX_REPORT_ROWS:50000, REPORT_CACHE_SECONDS:60});
const QC_FW_HEADERS = ['Server_Timestamp','Device_ID','Rejection_Code','Defect_Name','Client_ms','New_Total_Count','Raw_Payload','Part_ID','Molding_Machine_ID','Job_ID','Event_ID','Assignment_Method'];
const QC_FW_EXTRA = ['Quantity','Payload_Hash','Occurred_At','Time_Quality','Input_Source','Device_Name'];
const QC_SCHEMAS = Object.freeze({
  ESP32_Log:QC_FW_HEADERS.concat(QC_FW_EXTRA),
  Defect_Master:['Rejection_Code','Key','Defect_Name'],
  Report_Data:['Event_Timestamp','Event_Date','Week_Start','Month_Start','Year','Logger_ID','Rejection_Code','Defect_Name','Rejection_Count','Data_Type','Day_Name','Month_Label','Part_ID','Molding_Machine_ID'],
  QR_Master:['Entity_Type','Entity_ID','Display_Name','Enabled','QR_Text','Created_At','Created_By','Revision','Request_ID','Request_Fingerprint','Last_Request_ID','Last_Request_Fingerprint'],
  Job_Assignments:['Job_ID','Started_At','Ended_At','Logger_ID','Molding_Machine_ID','Part_ID','Changed_By','Request_ID','Change_Reason','Closed_By','Close_Reason','Request_Fingerprint','Revision','Close_Request_ID','Close_Request_Fingerprint','Machine_Operator'],
  Config:['Setting','Value'], Setup:['Step','Instructions'],
  Legends:['Category','Code','Label','Meaning'],
  Users:['User_ID','Display_Name','Role','Password_Hash','Password_Salt','Password_Version','Iterations','Enabled','Created_At','Created_By','Token_Version','Must_Change_Password','Failed_Attempts','Locked_Until','Last_Login','Revision','Request_ID','Request_Fingerprint','Last_Request_ID','Last_Request_Fingerprint'],
  Sessions:['Token_Hash','User_ID','Token_Version','Expires_At','Created_At'],
  Audit_Log:['Audit_ID','Timestamp','Actor_ID','Action','Entity_Type','Entity_ID','Changed_Fields','Request_ID']
});
const QC_ROLES = ['OWNER','ADMIN','OPERATOR','VIEWER'];
const QC_KEYS = ['1','2','3','4','5','6','7','8','9','0','A','B','C','D','*','#'];
const QC_DEFECTS = ['Short Shot','Flash','Sink Mark','Warpage / Burn','Silver Streaks','Weld Lines','Jetting','Air Trap','Color Streaks','Ejector Pin Marks','Dimensional (Oversized)','Dimensional (Undersized)','Oil / Contamination','Cracks / Brittleness','Black Specs','Gate Blush'];

