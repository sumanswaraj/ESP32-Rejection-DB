/** Immutable ESP32 schema-v2 ingest and assignment endpoint. */
function qcFirmwareDispatch(e){
  qcFwStartRequest_();
  let request;try{request=JSON.parse(e.postData.contents);}catch(err){return null;}
  if(!request || !['qc_ingest_v2','qc_get_assignment_v2'].includes(request.action))return null;
  const lock=LockService.getScriptLock();
  try{
    qcFwAssert_(lock.tryLock(20000),'BUSY_RETRY');
    qcFwReady_();
    const b=qcFwBook_();
    const cfg=qcFwRows_(b.getSheetByName('Config'));
    const api=cfg.find(r=>r.Setting==='API_Key');
    qcFwAssert_(api&&String(api.Value).length>=16&&qcFwConstantEqual_(request.api_key,String(api.Value)),'AUTH_FAILED');
    qcFwAssert_(typeof request.device_id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(request.device_id),'INVALID_DEVICE');
    const registry=qcFwRows_(b.getSheetByName('QR_Master'));
    const enabled=(type,id)=>registry.some(r=>r.Entity_Type===type&&r.Entity_ID===id&&(r.Enabled===true||String(r.Enabled).toUpperCase()==='TRUE'));
    qcFwAssert_(enabled('LOGGER',request.device_id),'LOGGER_NOT_REGISTERED_OR_DISABLED');
    const jobs=qcFwRows_(b.getSheetByName('Job_Assignments'));
    if(request.action==='qc_get_assignment_v2'){
      const active=jobs.filter(j=>j.Logger_ID===request.device_id&&!j.Ended_At);
      qcFwAssert_(active.every(j=>typeof j.Job_ID==='string'&&j.Job_ID.length>0&&j.Started_At instanceof Date&&!isNaN(j.Started_At.getTime())),'INVALID_ACTIVE_JOB_METADATA');
      qcFwAssert_(active.length<=1,'CONFLICT_MULTIPLE_ACTIVE_JOBS');const j=active[0];
      if(j)qcFwAssert_(enabled('MACHINE',j.Molding_Machine_ID)&&enabled('PART',j.Part_ID),'JOB_ENTITY_DISABLED');
      return qcFwJson_({success:true,device_id:request.device_id,active:!!j,
        assignment_id:j?j.Job_ID:'',assignment_version:1,machine_id:j?j.Molding_Machine_ID:'',part_id:j?j.Part_ID:'',
        operator_id:j?j.Changed_By:'',defect_catalog_version:1});
    }
    qcFwAssert_(typeof request.record_json==='string'&&request.record_json.length<=2048,'INVALID_RECORD');
    const hash=qcFwHash_(request.record_json);qcFwAssert_(hash===request.payload_hash,'HASH_MISMATCH');
    const p=JSON.parse(request.record_json);
    qcFwAssert_(p.schema_version===2&&p.device_id===request.device_id,'INVALID_SCHEMA');
    qcFwAssert_(typeof p.generation==='string'&&/^[a-f0-9]{16}$/.test(p.generation),'INVALID_GENERATION');
    qcFwAssert_(Number.isSafeInteger(p.sequence)&&p.sequence>0,'INVALID_SEQUENCE');
    qcFwAssert_(p.event_id===p.device_id+'-'+p.generation+'-'+p.sequence,'INVALID_EVENT_ID');
    qcFwAssert_(Number.isInteger(p.quantity)&&p.quantity>=1&&p.quantity<=9999,'INVALID_QUANTITY');
    qcFwAssert_(Number.isInteger(p.rejection_code)&&p.rejection_code>=1&&p.rejection_code<=16,'INVALID_DEFECT');
    const log=b.getSheetByName('ESP32_Log');
    qcFwAssert_(JSON.stringify(log.getRange(1,1,1,18).getValues()[0])===JSON.stringify(QC_FW_HEADERS.concat(QC_FW_EXTRA)),'SETUP_REQUIRED: run setupRejectionLogger');
    // One log row is BOTH the idempotency guard and the event ledger.
    // No secondary counter write that could fail between operations.
    const matches=log.getLastRow()>1?log.getRange(2,11,log.getLastRow()-1,1).createTextFinder(p.event_id).matchEntireCell(true).useRegularExpression(false).findAll():[];
    qcFwAssert_(matches.length<=1,'DUPLICATE_LEDGER_ROWS');
    if(matches.length){const old=log.getRange(matches[0].getRow(),1,1,18).getValues()[0];
      qcFwAssert_(old[13]===hash,'EVENT_ID_PAYLOAD_CONFLICT');
      return qcFwJson_({success:true,status:'duplicate',event_id:p.event_id,payload_hash:hash,new_total_count:old[5]});}
    const candidates=jobs.filter(j=>j.Job_ID===p.assignment_id);
    qcFwAssert_(candidates.length===1,'JOB_NOT_FOUND_OR_AMBIGUOUS');const j=candidates[0];
    qcFwAssert_(j&&j.Logger_ID===p.device_id&&j.Molding_Machine_ID===p.machine_id&&j.Part_ID===p.part_id&&p.assignment_version===1,'JOB_SNAPSHOT_MISMATCH');
    const defects=qcFwRows_(b.getSheetByName('Defect_Master'));const defect=defects.find(d=>Number(d.Rejection_Code)===p.rejection_code);
    qcFwAssert_(defect,'DEFECT_NOT_IN_MASTER');
    qcFwAssert_(Number.isInteger(p.client_ms)&&p.client_ms>=0&&p.client_ms<=4294967295,'INVALID_CLIENT_MS');
    qcFwAssert_(['keypad','touch'].includes(p.source),'INVALID_SOURCE');
    qcFwAssert_(['sntp','unsynchronized'].includes(p.time_quality),'INVALID_TIME_QUALITY');
    let occurred=null;
    if(p.time_quality==='sntp'){
      qcFwAssert_(typeof p.occurred_at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(p.occurred_at),'INVALID_TIMESTAMP');
      occurred=new Date(p.occurred_at);qcFwAssert_(Number.isFinite(occurred.getTime()),'INVALID_TIMESTAMP');
      qcFwAssert_(occurred.toISOString().replace('.000Z','Z')===p.occurred_at,'INVALID_TIMESTAMP');
      qcFwAssert_(j.Started_At instanceof Date&&!isNaN(j.Started_At.getTime())&&(!j.Ended_At||(j.Ended_At instanceof Date&&!isNaN(j.Ended_At.getTime()))),'INVALID_JOB_TIMESTAMPS');
      qcFwAssert_(occurred.getTime()>=new Date(j.Started_At).getTime()-5000,'BEFORE_JOB_START');
      if(j.Ended_At)qcFwAssert_(occurred.getTime()<=new Date(j.Ended_At).getTime()+5000,'AFTER_JOB_END_REVIEW_REQUIRED');
      qcFwAssert_(occurred.getTime()<=Date.now()+300000,'FUTURE_TIMESTAMP');
    }
    qcFwAssert_(typeof p.device_name==='string'&&p.device_name.length<=80,'INVALID_DEVICE_NAME');
    // The log is authoritative. This cache is usable only while its recorded
    // row count matches the ledger; any interrupted append forces a rebuild.
    const props=PropertiesService.getScriptProperties(),last=log.getLastRow();
    const cachedLast=Number(props.getProperty('QC_TOTAL_LAST_ROW')),cachedTotal=Number(props.getProperty('QC_TOTAL'));
    const previous=props.getProperty('QC_TOTAL_BOOK_ID')===b.getId()&&cachedLast===last&&Number.isSafeInteger(cachedTotal)&&cachedTotal>=0?cachedTotal:
      (last>1?log.getRange(2,6,last-1,1).getValues().reduce((m,r)=>Math.max(m,Number(r[0])||0),0):0);
    const total=previous+p.quantity,received=new Date();qcFwAssert_(Number.isSafeInteger(total),'TOTAL_OUT_OF_RANGE');
    const row=[received,p.device_id,p.rejection_code,qcFwSafe_(defect.Defect_Name),p.client_ms,total,request.record_json,
      qcFwSafe_(p.part_id),qcFwSafe_(p.machine_id),qcFwSafe_(p.assignment_id),p.event_id,'DEVICE_JOB_SNAPSHOT',
      p.quantity,hash,occurred||'',p.time_quality,p.source,qcFwSafe_(p.device_name)];
    const nextRow=log.getLastRow()+1;qcFwEnsureRows_(log,nextRow);
    const reports=b.getSheetByName('Report_Data');if(reports)qcFwEnsureRows_(reports,log.getMaxRows());
    log.getRange(nextRow,1,1,18).setValues([row]);SpreadsheetApp.flush();
    const saved=log.getRange(nextRow,11,1,4).getValues()[0];
    qcFwAssert_(saved[0]===p.event_id&&saved[2]===p.quantity&&saved[3]===hash,'WRITE_NOT_CONFIRMED_RETRY');
    try{props.setProperties({QC_TOTAL_BOOK_ID:b.getId(),QC_TOTAL_LAST_ROW:String(nextRow),QC_TOTAL:String(total)});}catch(cacheError){}
    return qcFwJson_({success:true,status:'committed',event_id:p.event_id,payload_hash:hash,new_total_count:total});
  }catch(err){return qcFwJson_({success:false,status:'error',error:String(err.message||err)});}
  finally{if(lock.hasLock())lock.releaseLock();}
}
