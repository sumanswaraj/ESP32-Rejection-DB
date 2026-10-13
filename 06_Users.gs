/** Server-enforced account creation, role changes and credential reset. */
function qcFwCanManageUser_(actor,user,role){
  qcFwAssert_(['OWNER','ADMIN'].includes(actor.role),'FORBIDDEN');
  qcFwAssert_(!user||user.Role!=='OWNER','OWNER_ACCOUNT_PROTECTED');
  if(actor.role!=='OWNER')qcFwAssert_((!user||['OPERATOR','VIEWER'].includes(user.Role))&&(!role||['OPERATOR','VIEWER'].includes(role)),'ONLY_OWNER_MANAGES_ADMIN_ACCESS');
}

function qcFwUserCredentialMutation_(request){
  const actor=qcFwRequireUser_(request.token,['OWNER','ADMIN']),create=request.action==='USER_CREATE';
  const id=request.user_id?qcFwUserId_(request.user_id):'';
  const role=create?qcFwText_(request.role,'ROLE',16,true):'',name=create?qcFwText_(request.name,'NAME',120,true):'';
  if(create)qcFwAssert_(['ADMIN','OPERATOR','VIEWER'].includes(role),'ROLE_INVALID');else qcFwAssert_(id,'USER_ID_REQUIRED');
  const prior=create?null:qcFwFind_('Users','User_ID',id);qcFwCanManageUser_(actor,prior,role);
  const proof=qcFwCredentialProof_(qcFwPasswordPolicy_(request.password));
  const meta=qcFwRequestMeta_(request,actor,request.action,{id,role,name,proof,revision:create?0:request.revision});
  const replay=create?qcFwReplayCreate_('Users',meta):qcFwReplayUpdate_(prior,meta);
  if(replay)return {success:true,message:'Request already applied.',user:create?qcFwPublicUser_(replay):qcFwPublicUser_(prior)};
  const credentials=qcFwPasswordFields_(request.password); // Expensive hashing occurs outside the sheet lock.
  return qcFwLocked_(()=>{
    const currentActor=qcFwRequireUser_(request.token,['OWNER','ADMIN']);
    if(create){
      qcFwCanManageUser_(currentActor,null,role);const duplicate=qcFwReplayCreate_('Users',meta);if(duplicate)return {success:true,user:qcFwPublicUser_(duplicate),message:'Login already created.'};
      const newId=id||qcFwNewId_('user_').slice(0,20);qcFwAssert_(!qcFwRead_('Users').some(u=>u.User_ID===newId),'USER_ID_EXISTS');
      const u=qcFwAppend_('Users',Object.assign({User_ID:newId,Display_Name:qcFwSafe_(name),Role:role,Enabled:true,Created_At:new Date(),Created_By:currentActor.userId,
        Token_Version:1,Must_Change_Password:true,Failed_Attempts:0,Revision:1,Request_ID:meta.id,Request_Fingerprint:meta.hash},credentials));
      qcFwAudit_(currentActor,'CREATE_USER','USER',newId,['Name','Role'],meta.id);return {success:true,user:qcFwPublicUser_(u),message:'Login created. Temporary password must be changed at first sign-in.'};
    }
    const u=qcFwFind_('Users','User_ID',id);qcFwCanManageUser_(currentActor,u);
    if(qcFwReplayUpdate_(u,meta))return {success:true,message:'Password already reset.'};qcFwRevision_(u,request.revision);
    qcFwUpdate_('Users',u,Object.assign(credentials,{Token_Version:Number(u.Token_Version||1)+1,Must_Change_Password:true,Failed_Attempts:0,Locked_Until:'',Revision:Number(u.Revision||1)+1,Last_Request_ID:meta.id,Last_Request_Fingerprint:meta.hash}));
    qcFwAudit_(currentActor,'RESET_PASSWORD','USER',id,['Password','Token_Version'],meta.id);return {success:true,message:'Password reset; old sessions revoked.'};
  });
}

function qcFwUserUpdate_(request,actor){
  const id=qcFwUserId_(request.user_id),u=qcFwFind_('Users','User_ID',id),role=qcFwText_(request.role,'ROLE',16,true),name=qcFwText_(request.name,'NAME',120,true);
  qcFwAssert_(['ADMIN','OPERATOR','VIEWER'].includes(role)&&typeof request.enabled==='boolean','USER_FIELDS_INVALID');qcFwCanManageUser_(actor,u,role);
  const meta=qcFwRequestMeta_(request,actor,'USER_UPDATE',{id,name,role,enabled:request.enabled,revision:request.revision});
  if(qcFwReplayUpdate_(u,meta))return {success:true,message:'Login already updated.'};qcFwRevision_(u,request.revision);
  qcFwUpdate_('Users',u,{Display_Name:qcFwSafe_(name),Role:role,Enabled:request.enabled,Token_Version:Number(u.Token_Version||1)+1,Revision:Number(u.Revision||1)+1,Last_Request_ID:meta.id,Last_Request_Fingerprint:meta.hash});
  qcFwAudit_(actor,'UPDATE_USER','USER',id,['Name','Role','Enabled','Token_Version'],meta.id);return {success:true,message:'Account updated; existing sessions revoked.'};
}

