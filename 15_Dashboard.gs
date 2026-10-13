/** Small authenticated refreshes; reporting always reads the immutable event ledger. */
function qcFwRegistryRevision_(rows){
  return qcFwHash_(qcFwCanonical_(rows.map(r=>({id:r.Entity_ID,type:r.Entity_Type,name:r.Display_Name,enabled:r.Enabled,revision:r.Revision}))));
}

function qcFwLiveState_(request){
  qcFwRequireUser_(request.token);
  const entities=qcFwRead_('QR_Master'),revision=qcFwRegistryRevision_(entities);
  return {success:true,registryRevision:revision,
    entities:request.registry_revision===revision?null:entities.map(qcFwPublicEntity_),
    activeJobs:qcFwRead_('Job_Assignments').filter(j=>!j.Ended_At).map(qcFwPublicJob_),
    latestLogRow:qcFwTable_('ESP32_Log').getLastRow(),serverTime:new Date().toISOString()};
}

/** Read-only check from the bound editor. Never returns keys or credentials. */
function verifyRejectionLoggerUpgrade(){
  qcFwStartRequest_();const book=qcFwBoundBook_();
  const missing=Object.keys(QC_SCHEMAS).filter(name=>!book.getSheetByName(name));
  const cfg=book.getSheetByName('Config')?qcFwConfig_(book):{};
  const result={success:missing.length===0,version:QC_APP.VERSION,
    installedVersion:String(cfg.App_Version||''),missingSheets:missing,
    backend:'Google Sheets / Apps Script',dashboard:'Built in',
    firmwareSchema:2,eventRows:book.getSheetByName('ESP32_Log')?Math.max(0,book.getSheetByName('ESP32_Log').getLastRow()-1):0,
    jobRows:book.getSheetByName('Job_Assignments')?Math.max(0,book.getSheetByName('Job_Assignments').getLastRow()-1):0,
    users:book.getSheetByName('Users')?qcFwRows_(book.getSheetByName('Users')).length:0,
    endpointConfigured:/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(cfg.Apps_Script_URL||''))};
  console.info(JSON.stringify(result));return result;
}

/** Noninteractive, additive repair for this existing initialized installation. */
function applyRejectionLoggerUpgrade(){
  qcFwStartRequest_();const book=qcFwBoundBook_();QC_RUNTIME.book=book;
  return qcFwLocked_(()=>{
    const users=qcFwRead_('Users');qcFwAssert_(users.filter(u=>u.Role==='OWNER').length===1,'EXISTING_OWNER_REQUIRED');
    const fingerprint=rows=>qcFwHash_(qcFwCanonical_(rows.map(u=>({id:u.User_ID,hash:u.Password_Hash,salt:u.Password_Salt,role:u.Role,enabled:u.Enabled,token:u.Token_Version}))));
    const before={users:fingerprint(users),key:String(qcFwConfig_(book).API_Key||''),
      secret:PropertiesService.getScriptProperties().getProperty('QC_AUTH_SECRET'),
      events:book.getSheetByName('ESP32_Log').getLastRow(),jobs:book.getSheetByName('Job_Assignments').getLastRow()};
    const result=qcFwSetup_(book);qcFwAssert_(!result.owner,'EXISTING_OWNER_REQUIRED');
    qcFwAssert_(before.users===fingerprint(qcFwRead_('Users'))&&before.key===String(qcFwConfig_(book).API_Key||'')&&before.secret===PropertiesService.getScriptProperties().getProperty('QC_AUTH_SECRET'),'EXISTING_CREDENTIALS_CHANGED');
    qcFwAssert_(before.events===book.getSheetByName('ESP32_Log').getLastRow()&&before.jobs===book.getSheetByName('Job_Assignments').getLastRow(),'LEDGER_ROWS_CHANGED');
    const verified=verifyRejectionLoggerUpgrade();verified.recordsPreserved=true;verified.credentialsPreserved=true;
    console.info(JSON.stringify(verified));return verified;
  });
}
