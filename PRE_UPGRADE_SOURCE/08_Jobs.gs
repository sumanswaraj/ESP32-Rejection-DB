/** Serialized job start, stop and changeover; historical IDs stay immutable. */
function qcFwPublicJob_(r){return {id:r.Job_ID,start:r.Started_At,end:r.Ended_At||'',logger:r.Logger_ID,machine:r.Molding_Machine_ID,part:r.Part_ID,operator:r.Machine_Operator||'',startedBy:r.Changed_By,closedBy:r.Closed_By||'',reason:r.Change_Reason||'',closeReason:r.Close_Reason||'',revision:Number(r.Revision||1)};}

function qcFwJobInputs_(request,actor,action){
  qcFwAssert_(['OWNER','ADMIN','OPERATOR'].includes(actor.role),'FORBIDDEN');
  const inputs={logger:qcFwId_(request.logger_id,'LOGGER_ID'),machine:qcFwId_(request.machine_id,'MACHINE_ID'),part:qcFwId_(request.part_id,'PART_ID'),reason:qcFwText_(request.reason,'REASON',200,false)};
  const machineOperator=qcFwText_(request.machine_operator,'MACHINE_OPERATOR',120,false);
  // Omit the empty field from the fingerprint so pre-upgrade job retries stay
  // valid. A named operator participates in the immutable request fingerprint.
  if(machineOperator)inputs.operator=machineOperator;
  if(action==='PART_CHANGEOVER')inputs.previous=qcFwId_(request.job_id,'JOB_ID');
  const meta=qcFwRequestMeta_(request,actor,action,inputs),replay=qcFwReplayCreate_('Job_Assignments',meta);
  if(replay)return {inputs,meta,replay};
  if(machineOperator)qcFwAssert_(qcFwHeaders_(qcFwTable_('Job_Assignments')).includes('Machine_Operator'),'SETUP_UPDATE_REQUIRED: run setupRejectionLogger to add the optional operator column');
  const entities=qcFwRead_('QR_Master');[['LOGGER',inputs.logger],['MACHINE',inputs.machine],['PART',inputs.part]].forEach(([type,id])=>{
    const rows=entities.filter(e=>e.Entity_Type===type&&e.Entity_ID===id);qcFwAssert_(rows.length===1&&qcFwEnabled_(rows[0].Enabled),type+'_NOT_REGISTERED_OR_DISABLED');});
  return {inputs,meta,replay:null};
}

function qcFwNewJob_(inputs,meta,actor,now){return {Job_ID:qcFwNewId_('JOB_'),Started_At:now,Ended_At:'',Logger_ID:inputs.logger,Molding_Machine_ID:inputs.machine,Part_ID:inputs.part,Machine_Operator:qcFwSafe_(inputs.operator||''),Changed_By:actor.userId,Request_ID:meta.id,Request_Fingerprint:meta.hash,Change_Reason:qcFwSafe_(inputs.reason||'START_JOB'),Revision:1};}

function qcFwStartJob_(request,actor){
  const {inputs,meta,replay}=qcFwJobInputs_(request,actor,'START_JOB');if(replay)return {success:true,job:qcFwPublicJob_(replay),message:'Job already started.'};
  const active=qcFwRead_('Job_Assignments').filter(j=>!j.Ended_At);
  qcFwAssert_(!active.some(j=>j.Logger_ID===inputs.logger),'LOGGER_ALREADY_HAS_ACTIVE_JOB');qcFwAssert_(!active.some(j=>j.Molding_Machine_ID===inputs.machine),'MACHINE_ALREADY_HAS_ACTIVE_JOB');
  const job=qcFwAppend_('Job_Assignments',qcFwNewJob_(inputs,meta,actor,new Date()));
  qcFwAudit_(actor,'START_JOB','JOB',job.Job_ID,['Logger','Machine','Part','Machine_Operator'],meta.id);return {success:true,job:qcFwPublicJob_(job),message:'Job started. Verify the applied assignment on the ESP32.'};
}

function qcFwStopJob_(request,actor){
  qcFwAssert_(['OWNER','ADMIN','OPERATOR'].includes(actor.role),'FORBIDDEN');const id=qcFwId_(request.job_id,'JOB_ID'),reason=qcFwText_(request.reason,'REASON',200,true),job=qcFwFind_('Job_Assignments','Job_ID',id);
  const meta=qcFwRequestMeta_(request,actor,'STOP_JOB',{id,reason,revision:request.revision});
  if(job.Close_Request_ID===meta.id){qcFwAssert_(job.Close_Request_Fingerprint===meta.hash,'REQUEST_ID_PAYLOAD_CONFLICT');return {success:true,message:'Job already stopped.'};}
  qcFwAssert_(!job.Ended_At,'JOB_ALREADY_CLOSED');qcFwRevision_(job,request.revision);
  qcFwUpdate_('Job_Assignments',job,{Ended_At:new Date(),Closed_By:actor.userId,Close_Reason:qcFwSafe_(reason),Revision:Number(job.Revision||1)+1,Close_Request_ID:meta.id,Close_Request_Fingerprint:meta.hash});
  qcFwAudit_(actor,'STOP_JOB','JOB',id,['Ended_At','Closed_By','Close_Reason'],meta.id);return {success:true,message:'Job stopped. Verify the ESP32 shows no active assignment.'};
}

function qcFwChangeover_(request,actor){
  const {inputs,meta,replay}=qcFwJobInputs_(request,actor,'PART_CHANGEOVER');if(replay)return {success:true,job:qcFwPublicJob_(replay),message:'Changeover already applied.'};
  qcFwAssert_(inputs.reason,'CHANGEOVER_REASON_REQUIRED');const jobs=qcFwRead_('Job_Assignments'),previous=jobs.find(j=>j.Job_ID===inputs.previous);
  qcFwAssert_(previous&&!previous.Ended_At&&previous.Logger_ID===inputs.logger,'ACTIVE_JOB_CHANGED: refresh before changeover');qcFwRevision_(previous,request.revision);
  qcFwAssert_(!jobs.some(j=>!j.Ended_At&&j.Job_ID!==previous.Job_ID&&(j.Logger_ID===inputs.logger||j.Molding_Machine_ID===inputs.machine)),'LOGGER_OR_MACHINE_JOB_CONFLICT');
  qcFwAssert_(previous.Part_ID!==inputs.part||previous.Molding_Machine_ID!==inputs.machine,'JOB_ALREADY_USES_THIS_MACHINE_AND_PART');
  const now=new Date(),next=qcFwNewJob_(inputs,meta,actor,now),table=qcFwTable_('Job_Assignments'),last=table.getLastRow()+1;
  qcFwEnsureRows_(table,last);const width=table.getLastColumn(),headers=table.getRange(1,1,1,width).getValues()[0];
  // One contiguous range write applies the closure and new job together. Other job
  // rows in that range are read and preserved, including all custom columns.
  const range=table.getRange(previous._row,1,last-previous._row+1,width);
  qcFwAssert_(range.getFormulas().every(row=>row.every(f=>f==='')),'JOB_LEDGER_HAS_FORMULAS: review changeover before writing');
  const values=range.getValues(),closed=Object.assign({},previous,{Ended_At:now,Closed_By:actor.userId,Close_Reason:qcFwSafe_(inputs.reason),Revision:Number(previous.Revision||1)+1,Close_Request_ID:meta.id,Close_Request_Fingerprint:meta.hash});
  values[0]=headers.map((h,i)=>closed[h]===undefined?values[0][i]:closed[h]);values[values.length-1]=headers.map(h=>next[h]===undefined?'':next[h]);
  range.setValues(values);SpreadsheetApp.flush();
  const confirmed=table.getRange(last,1).getValue();qcFwAssert_(confirmed===next.Job_ID,'CHANGEOVER_WRITE_NOT_CONFIRMED_RETRY');
  qcFwAudit_(actor,'PART_CHANGEOVER','JOB',next.Job_ID,['Previous job '+previous.Job_ID,'Machine','Part','Machine_Operator'],meta.id);
  return {success:true,job:qcFwPublicJob_(next),message:'Changeover saved. Wait for this job ID on the ESP32 before using the new part.'};
}


