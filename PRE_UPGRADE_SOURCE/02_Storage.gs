/** Shared validation, per-request read cache and header-mapped sheet storage. */
function qcFwAssert_(ok,message){if(!ok)throw new Error(message);}

function qcFwObject_(value){qcFwAssert_(value&&typeof value==='object'&&!Array.isArray(value),'INVALID_REQUEST');return value;}

function qcFwText_(value,label,max,required){
  const s=typeof value==='string'?value.trim():'';
  qcFwAssert_(s.length<=max&&(!required||s.length>0),label+'_INVALID');return s;
}

function qcFwId_(value,label){const s=qcFwText_(value,label,80,true);qcFwAssert_(/^[A-Za-z0-9_-]{1,80}$/.test(s),label+'_INVALID');return s;}

function qcFwUserId_(value){const s=qcFwText_(value,'USER_ID',64,true).toLowerCase();qcFwAssert_(/^[a-z0-9][a-z0-9._-]{2,63}$/.test(s),'USER_ID_INVALID: use 3–64 letters, numbers, dots, dashes or underscores');return s;}

function qcFwEnabled_(v){return v===true||String(v).toUpperCase()==='TRUE';}

function qcFwNewId_(prefix){return prefix+Utilities.getUuid().replace(/-/g,'');}

function qcFwSafe_(value){const s=String(value==null?'':value);return /^[=+\-@]/.test(s)?"'"+s:s;}

function qcFwHash_(text){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}

function qcFwConstantEqual_(a,b){a=String(a||'');b=String(b||'');let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0;}

function qcFwJson_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}

function qcFwSerializable_(value){return JSON.parse(JSON.stringify(value));}

function qcFwBoundBook_(){
  const b=SpreadsheetApp.getActiveSpreadsheet();
  qcFwAssert_(b,'BOUND_EDITOR_REQUIRED: open your sheet > Extensions > Apps Script, then run setupRejectionLogger from its editor or QC Logger menu');
  return b;
}

function qcFwBook_(){
  if(QC_RUNTIME.book)return QC_RUNTIME.book;
  const id=PropertiesService.getScriptProperties().getProperty('QC_BOOK_ID');
  qcFwAssert_(id,'SETUP_REQUIRED: run setupRejectionLogger in the attached sheet');
  return QC_RUNTIME.book=SpreadsheetApp.openById(id);
}

function qcFwReady_(){qcFwAssert_(PropertiesService.getScriptProperties().getProperty('QC_SCHEMA')===QC_APP.SCHEMA,'SETUP_REQUIRED: run setupRejectionLogger');}
var QC_RUNTIME={book:null,rows:{},headers:{}};

function qcFwStartRequest_(){QC_RUNTIME={book:null,rows:{},headers:{}};}

function qcFwLocked_(fn){const lock=LockService.getScriptLock();qcFwAssert_(lock.tryLock(20000),'BUSY_RETRY');QC_RUNTIME.rows={};try{return fn();}finally{QC_RUNTIME.rows={};lock.releaseLock();}}

function qcFwEnsureRows_(sheet,required){if(sheet.getMaxRows()<required)sheet.insertRowsAfter(sheet.getMaxRows(),Math.max(500,required-sheet.getMaxRows()));}

function qcFwRows_(sheet){
  qcFwAssert_(sheet,'SETUP_REQUIRED: required tab missing');
  const values=sheet.getDataRange().getValues(),headers=values.shift()||[];
  // Sheets can populate unchecked checkbox cells with FALSE. Checkbox-only
  // rows are unused form rows, not accounts or registered entities. Preserve
  // any row containing other data, including incomplete records for review.
  const checkboxFields=sheet.getName()==='Users'?['Enabled','Must_Change_Password']:
    sheet.getName()==='QR_Master'?['Enabled']:[];
  return values.map((r,i)=>Object.assign({_row:i+2},Object.fromEntries(headers.filter(Boolean).map(h=>[h,r[headers.indexOf(h)]]))))
    .filter(r=>Object.keys(r).some(k=>k!=='_row'&&!checkboxFields.includes(k)&&r[k]!==''&&r[k]!=null));
}

function qcFwTable_(name){return qcFwBook_().getSheetByName(name);}

function qcFwRead_(name){return QC_RUNTIME.rows[name]||(QC_RUNTIME.rows[name]=qcFwRows_(qcFwTable_(name)));}

function qcFwTailRows_(name,limit){
  const s=qcFwTable_(name),last=s.getLastRow();if(last<=1)return [];
  const start=Math.max(2,last-limit+1),headers=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
  return s.getRange(start,1,last-start+1,headers.length).getValues().map((r,i)=>Object.assign({_row:start+i},Object.fromEntries(headers.map((h,j)=>[h,r[j]]))));
}

function qcFwHeaders_(sheet){const name=sheet.getName();return QC_RUNTIME.headers[name]||(QC_RUNTIME.headers[name]=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]);}

function qcFwAppend_(name,record){
  const s=qcFwTable_(name),headers=qcFwHeaders_(s);
  // Append behind the last real account/entity, reusing trailing checkbox-only
  // rows. Ledger tables retain their physical append-only row order.
  const row=['Users','QR_Master'].includes(name)?
    qcFwRead_(name).reduce((last,r)=>Math.max(last,r._row),1)+1:s.getLastRow()+1;
  qcFwEnsureRows_(s,row);s.getRange(row,1,1,headers.length).setValues([headers.map(h=>record[h]===undefined?'':record[h])]);
  delete QC_RUNTIME.rows[name];return Object.assign({_row:row},record);
}

function qcFwUpdate_(name,row,patch){
  const s=qcFwTable_(name),headers=qcFwHeaders_(s);
  const range=s.getRange(row._row,1,1,headers.length),values=range.getValues()[0];
  headers.forEach((h,i)=>{if(Object.prototype.hasOwnProperty.call(patch,h))values[i]=patch[h];});
  range.setValues([values]);delete QC_RUNTIME.rows[name];return Object.assign({},row,patch);
}

function qcFwFind_(name,field,id){const r=qcFwRead_(name).filter(x=>String(x[field])===id);qcFwAssert_(r.length===1,'NOT_FOUND_OR_AMBIGUOUS: '+name);return r[0];}

function qcFwConfig_(book){return Object.fromEntries(qcFwRows_(book.getSheetByName('Config')).map(r=>[String(r.Setting),r.Value]));}

function qcFwAudit_(actor,action,type,id,fields,requestId){
  // Audit failure never tells the client that an already committed primary write failed.
  // The primary record also retains actor + request metadata.
  try{qcFwAppend_('Audit_Log',{Audit_ID:qcFwNewId_('AUD_'),Timestamp:new Date(),Actor_ID:actor.userId,
    Action:action,Entity_Type:type,Entity_ID:id,Changed_Fields:fields.join(', '),Request_ID:requestId||''});}
  catch(err){console.warn('Audit_Log write failed; inspect primary record request metadata.');}
}

function qcFwCanonical_(v){if(Array.isArray(v))return '['+v.map(qcFwCanonical_).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+qcFwCanonical_(v[k])).join(',')+'}';return JSON.stringify(v);}

function qcFwRequestMeta_(request,actor,action,payload){return {id:qcFwId_(request.request_id,'REQUEST_ID'),hash:qcFwHash_(qcFwCanonical_({actor:actor.userId,action,payload}))};}

function qcFwReplayCreate_(name,meta){
  const rows=qcFwRead_(name).filter(r=>r.Request_ID===meta.id);qcFwAssert_(rows.length<=1,'REQUEST_LEDGER_CONFLICT');
  if(rows[0])qcFwAssert_(rows[0].Request_Fingerprint===meta.hash,'REQUEST_ID_PAYLOAD_CONFLICT');return rows[0]||null;
}

function qcFwReplayUpdate_(row,meta){if(row.Last_Request_ID!==meta.id)return false;qcFwAssert_(row.Last_Request_Fingerprint===meta.hash,'REQUEST_ID_PAYLOAD_CONFLICT');return true;}

function qcFwRevision_(row,revision){qcFwAssert_(Number.isSafeInteger(revision)&&revision===Number(row.Revision||1),'REVISION_CONFLICT: refresh and try again');}


