/** Run from the bound sheet editor/menu; never returns credentials. */
function checkRejectionLoggerSetup(){
  qcFwStartRequest_();const book=qcFwBoundBook_(),props=PropertiesService.getScriptProperties(),issues=[];
  if(props.getProperty('QC_BOOK_ID')!==book.getId())issues.push('Run setupRejectionLogger to bind this sheet.');
  Object.keys(QC_SCHEMAS).forEach(name=>{
    const sheet=book.getSheetByName(name);if(!sheet){issues.push('Missing tab: '+name);return;}
    const headers=QC_SCHEMAS[name],count=Math.min(headers.length,sheet.getMaxColumns());
    if(JSON.stringify(sheet.getRange(1,1,1,count).getValues()[0])!==JSON.stringify(headers.slice(0,count)))issues.push('Header mismatch: '+name);
    if(count<headers.length)issues.push('Missing columns: '+name);
  });
  const config=book.getSheetByName('Config')?qcFwConfig_(book):{};
  if(String(config.API_Key||'').length<16)issues.push('Config API_Key is missing or too short.');
  if(!props.getProperty('QC_AUTH_SECRET'))issues.push('Authentication secret missing.');
  if(!config.Apps_Script_URL)issues.push('Paste your deployed /exec URL in Config Apps_Script_URL.');
  const result={success:issues.length===0,version:QC_APP.VERSION,issues};
  SpreadsheetApp.getUi().alert(issues.length?issues.join('\n'):'QC Logger setup checks passed.');return result;
}
