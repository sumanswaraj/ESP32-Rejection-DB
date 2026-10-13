/** Bound-sheet installer, schema creation, labels, legends and owner recovery. */
function onOpen(){SpreadsheetApp.getUi().createMenu('QC Logger')
  .addItem('Setup / repair required tabs','setupRejectionLogger')
  .addItem('Open portal','openRejectionLoggerPortal')
  .addItem('Check setup','checkRejectionLoggerSetup')
  .addItem('Recover owner login','recoverRejectionLoggerOwner').addToUi();}

function setupRejectionLogger(){
  qcFwStartRequest_();
  const book=qcFwBoundBook_(); // No email checks; this requires trusted sheet-editor access.
  const result=qcFwLocked_(()=>qcFwSetup_(book));
  if(result.owner)qcFwShowOwner_(result.owner);
  else SpreadsheetApp.getUi().alert('QC Logger setup complete. Existing data, API key and owner login were kept. Deploy or redeploy the web app, then use /exec.');
  return {success:true,message:'Setup complete. Required tabs, labels, legends, formulas and account tables are ready.',version:QC_APP.VERSION};
}

function installQcFirmwareBridge(){return setupRejectionLogger();}

function qcFwPreflight_(book){
  Object.keys(QC_SCHEMAS).forEach(name=>{
    const s=book.getSheetByName(name);if(!s)return;
    const headers=QC_SCHEMAS[name],count=Math.min(s.getMaxColumns(),headers.length);
    const existing=s.getRange(1,1,1,count).getValues()[0];
    qcFwAssert_(existing.every((v,i)=>v===''||v===headers[i]),name+' has incompatible reserved headers; nothing was cleared. Rename the conflicting custom tab or review its schema.');
  });
}

function qcFwEnsureSheet_(book,name,headers){
  let s=book.getSheetByName(name);if(!s)s=book.insertSheet(name);
  if(s.getMaxColumns()<headers.length)s.insertColumnsAfter(s.getMaxColumns(),headers.length-s.getMaxColumns());
  s.getRange(1,1,1,headers.length).setValues([headers]);s.setFrozenRows(1);
  s.getRange(1,1,1,headers.length).setBackground('#183b4e').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  s.setTabColor(['Users','Sessions','Audit_Log'].includes(name)?'#8765ad':['Config','Setup','Legends','Looker_Setup'].includes(name)?'#c7962b':'#178a85');
  s.setColumnWidths(1,headers.length,160);s.setRowHeight(1,36);
  s.getRange(1,1,1,headers.length).setNotes([headers.map(h=>'QC Logger field: '+h+'. See Setup and Legends for meaning. System records are maintained by Apps Script.')]);
  return s;
}

function qcFwSeedRows_(sheet,rows){if(sheet.getLastRow()===1&&rows.length)sheet.getRange(2,1,rows.length,rows[0].length).setValues(rows);}

function qcFwLookerFormulas_(book){
  const s=book.getSheetByName('Looker_Data'),log=book.getSheetByName('ESP32_Log');qcFwEnsureRows_(s,Math.max(2000,log.getMaxRows()));
  const f=[
    '=ARRAYFORMULA(IF(ESP32_Log!A2:A="","",IF(ESP32_Log!O2:O="",ESP32_Log!A2:A,ESP32_Log!O2:O)))',
    '=ARRAYFORMULA(IF(A2:A="","",INT(A2:A)))',
    '=ARRAYFORMULA(IF(A2:A="","",INT(A2:A)-WEEKDAY(INT(A2:A),2)+1))',
    '=ARRAYFORMULA(IF(A2:A="","",EOMONTH(INT(A2:A),-1)+1))',
    '=ARRAYFORMULA(IF(A2:A="","",YEAR(A2:A)))',
    '=ARRAYFORMULA(IF(ESP32_Log!B2:B="","",ESP32_Log!B2:B))',
    '=ARRAYFORMULA(IF(ESP32_Log!C2:C="","",ESP32_Log!C2:C))',
    '=ARRAYFORMULA(IF(ESP32_Log!D2:D="","",ESP32_Log!D2:D))',
    '=ARRAYFORMULA(IF(ESP32_Log!A2:A="","",IF(ESP32_Log!M2:M="",1,ESP32_Log!M2:M)))',
    '=ARRAYFORMULA(IF(ESP32_Log!B2:B="","",IF(LEFT(ESP32_Log!B2:B,7)="SAMPLE_","SAMPLE","REAL")))',
    '=ARRAYFORMULA(IF(A2:A="","",TEXT(A2:A,"ddd")))',
    '=ARRAYFORMULA(IF(A2:A="","",TEXT(A2:A,"mmm-yyyy")))',
    '=ARRAYFORMULA(IF(ESP32_Log!A2:A="","",IF(ESP32_Log!H2:H="","Not specified",ESP32_Log!H2:H)))',
    '=ARRAYFORMULA(IF(ESP32_Log!A2:A="","",IF(ESP32_Log!I2:I="","Not specified",ESP32_Log!I2:I)))'];
  f.forEach((formula,i)=>{
    const cell=s.getRange(2,i+1),current=cell.getFormula();
    if(!current&&cell.getValue()===''){
      qcFwAssert_(s.getLastRow()<3||s.getRange(3,i+1,s.getLastRow()-2,1).getValues().every(r=>r[0]===''),'Looker_Data column '+(i+1)+' contains data below its formula cell; review before setup');
      cell.setFormula(formula);
    }else if(i===8&&current==='=ARRAYFORMULA(IF(ESP32_Log!A2:A="","",1))')cell.setFormula(formula);
    else if(i===8)qcFwAssert_(current===formula,'Looker_Data I2 has a custom quantity formula; review before setup');
  });
  s.getRange('A:A').setNumberFormat('dd-mmm-yyyy hh:mm:ss');s.getRange('B:D').setNumberFormat('dd-mmm-yyyy');
  s.getRange('I:I').setNumberFormat('0');
}

function qcFwDashboard_(book){
  let s=book.getSheetByName('Dashboard');if(s&&s.getLastRow()>0)return; // Keep an existing customized dashboard.
  if(!s)s=book.insertSheet('Dashboard');
  s.getRange('A1').setValue('QC Rejection Dashboard').setFontSize(20).setFontWeight('bold');
  s.getRange('A3:A6').setValues([['Rejected pieces'],['Event submissions'],['Rejected pieces today'],['Active jobs']]);
  s.getRange('B3:B6').setFormulas([
    ['=SUM(Looker_Data!I2:I)'],['=COUNT(ESP32_Log!A2:A)'],['=SUMIF(Looker_Data!B2:B,TODAY(),Looker_Data!I2:I)'],
    ['=COUNTIFS(Job_Assignments!A2:A,"<>",Job_Assignments!C2:C,"")']]);
  s.getRange('A8:C8').setValues([['Defect code','Defect','Rejected pieces']]);
  s.getRange(9,1,16,2).setValues(QC_DEFECTS.map((name,i)=>[i+1,name]));
  s.getRange(9,3,16,1).setFormulas(QC_DEFECTS.map((_,i)=>['=SUMIF(Looker_Data!G2:G,A'+(i+9)+',Looker_Data!I2:I)']));
  s.getRange('E8').setFormula('=IFERROR(QUERY(Looker_Data!A1:N,"select N,sum(I) where A is not null group by N label N \'Molding machine\',sum(I) \'Rejected pieces\'",1),"No records yet")');
  s.getRange('E29').setFormula('=IFERROR(QUERY(Looker_Data!A1:N,"select B,sum(I) where A is not null group by B order by B label B \'Date\',sum(I) \'Rejected pieces\'",1),"No records yet")');
  s.getRange('A27').setValue('Use the portal for date, logger, machine, part and defect filters; CSV export and printable PDF summaries.');
  s.getRange('A28').setValue('Quantity counts rejected pieces. One press can submit multiple pieces. Known device time is used; otherwise server receipt time.');
  s.getRange('A27:C28').setWrap(true);s.setColumnWidths(1,6,175);s.setFrozenRows(1);s.setTabColor('#178a85');
  s.getRange('A8:C8').setBackground('#183b4e').setFontColor('#ffffff').setFontWeight('bold');
  s.insertChart(s.newChart().setChartType(Charts.ChartType.BAR).addRange(s.getRange('B8:C24')).setPosition(2,8,0,0)
    .setOption('title','Rejected pieces by defect').setOption('legend',{position:'none'}).setOption('colors',['#178a85']).build());
}

function qcFwSetup_(book){
  QC_RUNTIME.book=book;
  qcFwPreflight_(book);
  const props=PropertiesService.getScriptProperties();props.setProperty('QC_BOOK_ID',book.getId());
  Object.keys(QC_SCHEMAS).forEach(name=>qcFwEnsureSheet_(book,name,QC_SCHEMAS[name]));
  const cfg=book.getSheetByName('Config'),rows=qcFwRows_(cfg),has=key=>rows.some(r=>r.Setting===key);
  const defaults=[['Sheet_Name','ESP32_Log'],['API_Key',qcFwNewId_('')+qcFwNewId_('')],['Timezone','Asia/Kolkata'],
    ['Apps_Script_URL',''],['Endpoint_Status','NOT_DEPLOYED'],['Firmware_Schema_Version','2'],['App_Version',QC_APP.VERSION],
    ['Request_Method','POST'],['Request_Fields','action, api_key, device_id, record_json, payload_hash'],['Response_Field','new_total_count'],
    ['Report_Date_Basis','Occurred_At when known; otherwise Server_Timestamp'],['Session_Hours',6],['Quantity_Min',1],['Quantity_Max',9999],
    ['Company_Branding_JSON',JSON.stringify(qcFwDefaultBranding_())]];
  defaults.forEach(row=>{if(!has(row[0]))cfg.appendRow(row);});
  const versionRow=qcFwRows_(cfg).find(r=>r.Setting==='App_Version');
  if(versionRow&&versionRow.Value!==QC_APP.VERSION)cfg.getRange(versionRow._row,2).setValue(QC_APP.VERSION);
  const config=qcFwConfig_(book);qcFwAssert_(String(config.API_Key||'').length>=16,'CONFIG_API_KEY_INVALID: preserved existing value; supply at least 16 characters');
  cfg.getRange('B:B').setWrap(true);book.setSpreadsheetTimeZone(String(config.Timezone||'Asia/Kolkata'));
  qcFwSeedRows_(book.getSheetByName('Defect_Master'),QC_DEFECTS.map((n,i)=>[i+1,QC_KEYS[i],n]));
  qcFwSeedRows_(book.getSheetByName('Setup'),[
    ['1','This sheet was initialized automatically. No spreadsheet ID or email was required. Keep the spreadsheet private to trusted maintainers.'],
    ['2','The first owner login is shown once during setup. Change its temporary password when first signing in. Recovery is in the QC Logger sheet menu.'],
    ['3','Deploy as a Web app: Execute as Me; access Anyone. The custom ID/password portal still requires its own sign-in.'],
    ['4','Paste the deployed /exec URL into Config Apps_Script_URL. Set Endpoint_Status to DEPLOYED. Copy URL and API_Key to ESP32 local setup.'],
    ['5','Owner manages Admin rights. Owner/Admin create Operator and Viewer IDs, reset credentials and enable/disable access.'],
    ['6','Register LOGGER, MACHINE and PART in the portal. A logger ID must match the commissioned ESP32 device ID exactly.'],
    ['7','An Operator can start, stop or change a job after selecting/scanning logger, machine and part IDs. Historical assignment IDs are retained.'],
    ['8','Wait for the new assignment to appear on the ESP32 local status page before using a new part. Stop/changeover is not a two-phase device handshake.'],
    ['9','Codes 1–16 map to Defect_Master; touch pad number equals defect code. Quantity 1–9999 counts pieces, not button presses.'],
    ['10','Looker_Data is formula-driven. Do not paste manual rows into it. Dashboard shows whole-sheet totals; portal has filters.'],
    ['11','Offline queue replay keeps each original job snapshot. Events are deduplicated by Event_ID and Payload_Hash.'],
    ['12','Use the portal to export filtered CSV or print/save a PDF summary. Users, Sessions and Audit_Log are backend tables.'],
    ['13','Setup can be rerun. Existing logs, API key, user passwords, jobs, custom tabs and custom dashboard are preserved.'],
    ['14','Existing custom frontend/login code is not automatically migrated. This full app is intended for a new blank sheet/project.'],
    ['15','The portal reads up to 50,000 log records per report. Split large archives into a new workbook; firmware ingestion itself continues.']]);
  // Append upgrade guidance without replacing an existing customized Setup tab.
  const setup=book.getSheetByName('Setup'),steps=qcFwRows_(setup);
  [['16','Company settings: Owner/Admin can set the company name and upload a logo, use a direct HTTPS image URL or paste original SVG code.'],
    ['17','Rejection details and job history show 10 rows by default. Choose 5 or 10 and use Previous/Next to browse; lists never append automatically.'],
    ['18','Machine operator is optional when starting/changing a job. Enter a name or employee ID; Changed_By remains the signed-in user.']]
    .forEach(row=>{if(!steps.some(r=>String(r.Step)===row[0]))setup.appendRow(row);});
  qcFwSeedRows_(book.getSheetByName('Legends'),[
    ...QC_DEFECTS.map((n,i)=>['DEFECT',i+1,n,'Keypad '+QC_KEYS[i]+' | Touch pad '+(i+1)]),
    ['ROLE','OWNER','Owner','All controls; grants/revokes Admin access; created during bound setup.'],
    ['ROLE','ADMIN','Admin','Registers equipment/parts, operates jobs and manages Operator/Viewer accounts.'],
    ['ROLE','OPERATOR','Operator','Starts/stops/changes jobs, views reports and prints QR labels.'],
    ['ROLE','VIEWER','Viewer','Views reports and QR/entity details; no write permissions.'],
    ['ENTITY','LOGGER','ESP32 logger','Device_ID; examples in instructions are not inserted as records.'],
    ['ENTITY','MACHINE','Molding machine','Physical machine assigned to one active logger job.'],
    ['ENTITY','PART','Running part','Part/model being inspected; one part per active logger job.'],
    ['STATUS','TRUE','Enabled','May sign in or be used in a new job.'],['STATUS','FALSE','Disabled','Access/new assignments refused. Historical records remain.'],
    ['JOB','Active','Running job','Ended_At is blank. One active job per logger and per molding machine.'],
    ['JOB','Closed','Past job','Ended_At is populated; its device snapshot remains valid for historical queue replay.'],
    ['RECEIPT','committed','Saved','Hash and Event_ID were reread from the appended event row.'],
    ['RECEIPT','duplicate','Already saved','Same immutable payload; counted only once.'],
    ['TIME','sntp','Known time','Occurred_At is the device event time.'],['TIME','unsynchronized','Unknown time','Reports use server receipt time.'],
    ['SOURCE','keypad','4×4 keypad','Original keypad remains supported.'],['SOURCE','touch','16-key serial touch pad','Pad 1–16 uses the same defect code 1–16.'],
    ['UNIT','Quantity','Rejected pieces','Use quantity sum for rejection totals; event row count means submissions.'],
    ['REPORT','Machine_ID','Logger ID','Legacy reporting column F retains Device_ID; Molding_Machine_ID holds the physical machine.'],
    ['QR','QC:TYPE:ID','QR payload','Generated locally in the portal; supported types LOGGER, MACHINE, PART.']]);
  const legends=book.getSheetByName('Legends');
  if(!qcFwRows_(legends).some(r=>r.Category==='JOB'&&r.Code==='Machine_Operator'))legends.appendRow(['JOB','Machine_Operator','Machine operator (optional)','Name or employee ID entered for this job. Changed_By records the separate portal login actor. Older jobs stay blank.']);
  qcFwSeedRows_(book.getSheetByName('Looker_Setup'),[
    ['Data source','Use Looker_Data in this spreadsheet. Headers are on row 1; data/formulas start on row 2.'],
    ['Metric','SUM(Rejection_Count) = rejected pieces. COUNT rows = event submissions.'],
    ['Dates','Event_Date for days, Week_Start for Monday weeks, Month_Start for months.'],
    ['Dimensions','Machine_ID is logger ID; Molding_Machine_ID is the physical machine. Part_ID and Defect_Name are separate filters.'],
    ['Data_Type','REAL normally; SAMPLE only for logger IDs beginning SAMPLE_. No sample data is created.'],
    ['Sharing','Connect Looker Studio from your own account. This script does not share the sheet or provision an external Looker report.']]);
  const boolRule=SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build();
  book.getSheetByName('QR_Master').getRange('A2:A1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['LOGGER','MACHINE','PART'],true).setAllowInvalid(false).build());
  book.getSheetByName('QR_Master').getRange('D2:D1000').setDataValidation(boolRule);
  book.getSheetByName('Users').getRange('H2:H1000').setDataValidation(boolRule);
  ['ESP32_Log','Job_Assignments','Sessions','Audit_Log'].forEach(name=>book.getSheetByName(name).getRange('A:A').setNumberFormat('@'));
  book.getSheetByName('ESP32_Log').getRange('A:A').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  book.getSheetByName('ESP32_Log').getRange('O:O').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  book.getSheetByName('Job_Assignments').getRange('B:C').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  book.getSheetByName('Users').getRange('I:I').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  qcFwLookerFormulas_(book);qcFwDashboard_(book);
  const users=qcFwRead_('Users');
  qcFwAssert_(!users.some(u=>u.Password_Hash)||props.getProperty('QC_AUTH_SECRET'),'AUTH_SECRET_MISSING: existing passwords were preserved; restore this project\'s original authentication secret');
  if(!props.getProperty('QC_AUTH_SECRET'))props.setProperty('QC_AUTH_SECRET',qcFwNewId_('')+qcFwNewId_(''));
  let owner=null;
  if(!users.some(u=>u.Role==='OWNER')){
    qcFwAssert_(users.length===0,'OWNER_SETUP_REQUIRED: existing accounts found without an owner; review before creating owner access');
    const id=qcFwNewId_('owner_').slice(0,20),password=qcFwNewId_('QC-');
    qcFwAppend_('Users',Object.assign({User_ID:id,Display_Name:'Project Owner',Role:'OWNER',Enabled:true,Created_At:new Date(),Created_By:'BOUND_SETUP',
      Token_Version:1,Must_Change_Password:true,Failed_Attempts:0,Revision:1},qcFwPasswordFields_(password)));
    props.setProperty('QC_OWNER_ID',id);owner={userId:id,password};
  }
  props.setProperty('QC_SCHEMA',QC_APP.SCHEMA);SpreadsheetApp.flush();return {owner};
}

function qcFwHtmlEscape_(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function qcFwShowOwner_(credentials){
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<div style="font:16px Arial;padding:18px"><h2>Save your owner login</h2><p>Login ID</p><pre>'+qcFwHtmlEscape_(credentials.userId)+'</pre><p>Temporary password</p><pre>'+qcFwHtmlEscape_(credentials.password)+'</pre><p>Copy both now. The password is displayed once and stored only as a password hash. Change it after signing in to /exec.</p></div>').setWidth(520).setHeight(340),'QC Logger owner login');
}

function recoverRejectionLoggerOwner(){
  qcFwStartRequest_();
  const book=qcFwBoundBook_();qcFwAssert_(book.getId()===PropertiesService.getScriptProperties().getProperty('QC_BOOK_ID'),'RUN_SETUP_FIRST');qcFwReady_();
  const password=qcFwNewId_('QC-'),fields=qcFwPasswordFields_(password);
  const id=qcFwLocked_(()=>{
    const owners=qcFwRead_('Users').filter(u=>u.Role==='OWNER');qcFwAssert_(owners.length===1,'OWNER_RECORD_MISSING_OR_AMBIGUOUS');
    const u=owners[0];qcFwUpdate_('Users',u,Object.assign(fields,{Enabled:true,Token_Version:Number(u.Token_Version||1)+1,Must_Change_Password:true,Failed_Attempts:0,Locked_Until:'',Revision:Number(u.Revision||1)+1}));
    qcFwAudit_({userId:'BOUND_RECOVERY'},'OWNER_RECOVERY','USER',u.User_ID,['Password','Token_Version'],'');return u.User_ID;
  });qcFwShowOwner_({userId:id,password});return {success:true,message:'Recovery password shown in the sheet; previous owner sessions revoked.'};
}

function openRejectionLoggerPortal(){
  qcFwStartRequest_();
  const book=qcFwBoundBook_(),url=String(qcFwConfig_(book).Apps_Script_URL||'');
  qcFwAssert_(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url),'Paste your deployed /exec URL into Config Apps_Script_URL first');
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput('<p style="font:16px Arial"><a target="_blank" rel="noopener" href="'+qcFwHtmlEscape_(url)+'">Open QC Logger portal</a></p>'),'Open portal');
}

