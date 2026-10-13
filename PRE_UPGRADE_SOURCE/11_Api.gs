/** Web entry points and authenticated portal RPC router. */
function doGet(e){
  qcFwStartRequest_();
  if(e&&e.parameter&&e.parameter.action==='health')return qcFwJson_({success:true,service:'QC Logger',version:QC_APP.VERSION,ready:PropertiesService.getScriptProperties().getProperty('QC_SCHEMA')===QC_APP.SCHEMA});
  const branding=qcFwPageBranding_(),template=HtmlService.createTemplateFromFile('Index');
  template.brandingJson=qcFwHtmlJson_(branding);
  return template.evaluate().setTitle(branding.name||'QC Rejection Logger').addMetaTag('viewport','width=device-width, initial-scale=1');
}

function qcInclude_(name){qcFwAssert_(['Styles','Client','QR','Branding'].includes(name),'INCLUDE_INVALID');return HtmlService.createHtmlOutputFromFile(name).getContent();}

function doPost(e){
  qcFwStartRequest_();
  const firmware=qcFirmwareDispatch(e);if(firmware!==null)return firmware;
  try{qcFwAssert_(e&&e.postData&&e.postData.contents&&e.postData.contents.length<=80000,'INVALID_REQUEST');return qcFwJson_(qcPortal(JSON.parse(e.postData.contents)));}
  catch(err){return qcFwJson_({success:false,status:'error',error:String(err.message||err)});}
}
/** The only portal RPC. Every authenticated operation enforces roles on the server. */

function qcPortal(request){
  qcFwStartRequest_();
  try{
    qcFwObject_(request);qcFwReady_();
    qcFwAssert_(JSON.stringify(request).length<=(request.action==='BRANDING_UPDATE'?80000:16000),'REQUEST_TOO_LARGE');
    const action=request.action;
    if(action==='LOGIN')return qcFwSerializable_(Object.assign({success:true},qcFwLogin_(request)));
    if(action==='LOGOUT')return qcFwLocked_(()=>{if(typeof request.token==='string'){const hash=qcFwHash_(request.token),s=qcFwRead_('Sessions').find(r=>r.Token_Hash===hash);if(s)qcFwTable_('Sessions').deleteRow(s._row);}return {success:true};});
    if(action==='WHOAMI')return {success:true,user:qcFwRequireUser_(request.token,null,true)};
    if(action==='CHANGE_PASSWORD')return qcFwChangePassword_(request);
    if(action==='GET_DATA')return qcFwSerializable_(qcFwInitialData_(request));
    if(action==='GET_ACTIVE_JOBS'){qcFwRequireUser_(request.token);return qcFwSerializable_({success:true,activeJobs:qcFwRead_('Job_Assignments').filter(j=>!j.Ended_At).map(qcFwPublicJob_)});}
    if(action==='GET_REPORT')return qcFwSerializable_(qcFwReport_(request));
    if(action==='GET_JOB_HISTORY')return qcFwSerializable_(qcFwJobHistory_(request));
    if(action==='GET_BRANDING'){qcFwRequireUser_(request.token);return {success:true,branding:qcFwPublicBranding_(qcFwBrandingRecord_().brand)};}
    if(action==='USER_CREATE'||action==='USER_RESET_PASSWORD')return qcFwUserCredentialMutation_(request);
    return qcFwLocked_(()=>{
      const actor=qcFwRequireUser_(request.token);
      const handlers={USER_UPDATE:qcFwUserUpdate_,ENTITY_CREATE:qcFwEntityCreate_,ENTITY_UPDATE:qcFwEntityUpdate_,START_JOB:qcFwStartJob_,STOP_JOB:qcFwStopJob_,PART_CHANGEOVER:qcFwChangeover_,BRANDING_UPDATE:qcFwBrandingUpdate_};
      qcFwAssert_(Object.prototype.hasOwnProperty.call(handlers,action),'UNKNOWN_ACTION');
      return qcFwSerializable_(handlers[action](request,actor));
    });
  }catch(err){return {success:false,status:'error',error:String(err.message||err)};}
}


function qcFwInitialData_(request){
  const actor=qcFwRequireUser_(request.token),entities=qcFwRead_('QR_Master'),jobs=qcFwRead_('Job_Assignments');
  const history=qcFwJobHistoryPage_({page_size:request.job_page_size});
  return {success:true,user:actor,version:QC_APP.VERSION,timezone:qcFwBook_().getSpreadsheetTimeZone(),
    branding:qcFwPublicBranding_(qcFwBrandingRecord_().brand),jobHistory:{total:history.total,page:history.page,pageSize:history.pageSize,snapshotRow:history.snapshotRow},
    defects:qcFwRead_('Defect_Master').map(d=>({code:Number(d.Rejection_Code),key:String(d.Key),name:d.Defect_Name,touch:Number(d.Rejection_Code)})),
    entities:entities.map(qcFwPublicEntity_),jobs:history.jobs,activeJobs:jobs.filter(j=>!j.Ended_At).map(qcFwPublicJob_),
    users:['OWNER','ADMIN'].includes(actor.role)?qcFwRead_('Users').map(qcFwPublicUser_):[],
    audit:['OWNER','ADMIN'].includes(actor.role)?qcFwTailRows_('Audit_Log',100).reverse().map(r=>({time:r.Timestamp,actor:r.Actor_ID,action:r.Action,type:r.Entity_Type,id:r.Entity_ID})):[]};
}

