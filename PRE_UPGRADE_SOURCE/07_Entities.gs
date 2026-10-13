/** Logger, molding-machine and part registry with immutable IDs. */
function qcFwPublicEntity_(r){return {type:r.Entity_Type,id:r.Entity_ID,name:r.Display_Name,enabled:qcFwEnabled_(r.Enabled),qr:r.QR_Text,revision:Number(r.Revision||1)};}

function qcFwEntityCreate_(request,actor){
  qcFwAssert_(['OWNER','ADMIN'].includes(actor.role),'FORBIDDEN');
  const type=qcFwText_(request.type,'TYPE',16,true),name=qcFwText_(request.name,'NAME',120,true),supplied=request.entity_id?qcFwId_(request.entity_id,'ENTITY_ID'):'';
  qcFwAssert_(['LOGGER','MACHINE','PART'].includes(type),'ENTITY_TYPE_INVALID');
  const meta=qcFwRequestMeta_(request,actor,'ENTITY_CREATE',{type,name,id:supplied}),replay=qcFwReplayCreate_('QR_Master',meta);
  if(replay)return {success:true,entity:qcFwPublicEntity_(replay),message:'Entity already registered.'};
  const id=supplied||qcFwNewId_({LOGGER:'ESP32_',MACHINE:'MOLD_',PART:'PART_'}[type]).slice(0,26);
  qcFwAssert_(!qcFwRead_('QR_Master').some(r=>r.Entity_ID===id),'ENTITY_ID_EXISTS');
  const row=qcFwAppend_('QR_Master',{Entity_Type:type,Entity_ID:id,Display_Name:qcFwSafe_(name),Enabled:true,QR_Text:'QC:'+type+':'+id,Created_At:new Date(),Created_By:actor.userId,Revision:1,Request_ID:meta.id,Request_Fingerprint:meta.hash});
  qcFwAudit_(actor,'REGISTER_ENTITY',type,id,['Name','Enabled'],meta.id);return {success:true,entity:qcFwPublicEntity_(row),message:'Entity registered.'};
}

function qcFwEntityUpdate_(request,actor){
  qcFwAssert_(['OWNER','ADMIN'].includes(actor.role),'FORBIDDEN');const id=qcFwId_(request.entity_id,'ENTITY_ID'),r=qcFwFind_('QR_Master','Entity_ID',id),name=qcFwText_(request.name,'NAME',120,true);
  qcFwAssert_(typeof request.enabled==='boolean','ENABLED_INVALID');const meta=qcFwRequestMeta_(request,actor,'ENTITY_UPDATE',{id,name,enabled:request.enabled,revision:request.revision});
  if(qcFwReplayUpdate_(r,meta))return {success:true,message:'Entity already updated.'};qcFwRevision_(r,request.revision);
  if(!request.enabled)qcFwAssert_(!qcFwRead_('Job_Assignments').some(j=>!j.Ended_At&&[j.Logger_ID,j.Molding_Machine_ID,j.Part_ID].includes(id)),'STOP_ACTIVE_JOB_BEFORE_DISABLING_ENTITY');
  qcFwUpdate_('QR_Master',r,{Display_Name:qcFwSafe_(name),Enabled:request.enabled,Revision:Number(r.Revision||1)+1,Last_Request_ID:meta.id,Last_Request_Fingerprint:meta.hash});
  qcFwAudit_(actor,'UPDATE_ENTITY',r.Entity_Type,id,['Name','Enabled'],meta.id);return {success:true,message:'Entity updated. IDs and historical assignments were kept.'};
}

