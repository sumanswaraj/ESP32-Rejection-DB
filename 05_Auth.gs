/** Password validation, throttled sign-in and revocable sessions. */
function qcFwPasswordPolicy_(password){qcFwAssert_(typeof password==='string'&&password.length>=12&&password.length<=128&&password.trim(),'PASSWORD_POLICY: use 12–128 characters');return password;}

function qcFwAuthSecret_(){const s=PropertiesService.getScriptProperties().getProperty('QC_AUTH_SECRET');qcFwAssert_(s,'AUTH_SETUP_REQUIRED');return s;}

function qcFwPasswordHash_(password,salt,iterations){
  const key=Utilities.computeHmacSha256Signature(password,qcFwAuthSecret_(),Utilities.Charset.UTF_8).map(b=>b&255);
  return Utilities.base64Encode(qcFwPbkdf2Sha256_(key,Array.from(salt,c=>c.charCodeAt(0)),iterations).map(b=>b>127?b-256:b));
}

function qcFwPasswordFields_(password){qcFwPasswordPolicy_(password);const salt=Utilities.getUuid();return {Password_Hash:qcFwPasswordHash_(password,salt,QC_APP.PASSWORD_ITERATIONS),Password_Salt:salt,Password_Version:'PBKDF2-SHA256-v1',Iterations:QC_APP.PASSWORD_ITERATIONS};}

function qcFwVerifyPassword_(password,user){
  const iterations=Number(user.Iterations);
  return user.Password_Version==='PBKDF2-SHA256-v1'&&Number.isInteger(iterations)&&iterations>=QC_APP.PASSWORD_ITERATIONS&&iterations<=2000000
    &&/^[a-f0-9-]{36}$/i.test(String(user.Password_Salt))&&qcFwConstantEqual_(qcFwPasswordHash_(password,String(user.Password_Salt),iterations),user.Password_Hash);
}

function qcFwCredentialProof_(password){return Utilities.base64Encode(Utilities.computeHmacSha256Signature('request-fingerprint\u0000'+password,qcFwAuthSecret_(),Utilities.Charset.UTF_8));}

function qcFwPublicUser_(u){return {userId:u.User_ID,name:u.Display_Name,role:u.Role,enabled:qcFwEnabled_(u.Enabled),mustChangePassword:qcFwEnabled_(u.Must_Change_Password),revision:Number(u.Revision||1),lastLogin:u.Last_Login instanceof Date?u.Last_Login.toISOString():''};}

function qcFwRequireUser_(token,roles,allowPasswordChange){
  qcFwReady_();qcFwAssert_(typeof token==='string'&&/^[a-f0-9]{64}$/.test(token),'AUTH: sign in');
  const session=qcFwRead_('Sessions').find(s=>s.Token_Hash===qcFwHash_(token));
  qcFwAssert_(session&&session.Expires_At instanceof Date&&session.Expires_At.getTime()>Date.now(),'AUTH: session expired; sign in again');
  const u=qcFwFind_('Users','User_ID',session.User_ID);
  qcFwAssert_(qcFwEnabled_(u.Enabled)&&QC_ROLES.includes(u.Role)&&Number(session.Token_Version)===Number(u.Token_Version||1),'AUTH: access changed; sign in again');
  const actor=qcFwPublicUser_(u);
  qcFwAssert_(allowPasswordChange||!actor.mustChangePassword,'PASSWORD_CHANGE_REQUIRED');
  if(roles)qcFwAssert_(roles.includes(actor.role),'FORBIDDEN');return actor;
}

function qcFwIssueSession_(user){
  const table=qcFwTable_('Sessions'),rows=qcFwRead_('Sessions'),now=Date.now();
  const keep=rows.filter(s=>s.User_ID===user.User_ID&&s.Expires_At instanceof Date&&s.Expires_At.getTime()>now).sort((a,b)=>new Date(b.Created_At)-new Date(a.Created_At)).slice(0,4);
  rows.filter(s=>!(s.Expires_At instanceof Date)||s.Expires_At.getTime()<=now||(s.User_ID===user.User_ID&&!keep.includes(s))).map(s=>s._row).sort((a,b)=>b-a).forEach(row=>table.deleteRow(row));
  const token=qcFwNewId_('')+qcFwNewId_(''),expiresAt=new Date(now+QC_APP.SESSION_SECONDS*1000);
  qcFwAppend_('Sessions',{Token_Hash:qcFwHash_(token),User_ID:user.User_ID,Token_Version:Number(user.Token_Version||1),Expires_At:expiresAt,Created_At:new Date()});
  return {token,user:qcFwPublicUser_(user),expiresAt:expiresAt.toISOString()};
}

function qcFwLogin_(request){
  const id=qcFwUserId_(request.user_id),password=typeof request.password==='string'?request.password:'';
  qcFwAssert_(password.length>0&&password.length<=128,'AUTH: invalid login details');
  const snapshot=qcFwLocked_(()=>{
    const props=PropertiesService.getScriptProperties(),minute=Math.floor(Date.now()/60000);
    let rate;try{rate=JSON.parse(props.getProperty('QC_LOGIN_RATE')||'{}');}catch(err){rate={};}
    if(rate.minute!==minute)rate={minute,count:0};qcFwAssert_(rate.count<QC_APP.LOGIN_GLOBAL_PER_MINUTE,'RATE_LIMIT: try again in a minute');
    rate.count++;props.setProperty('QC_LOGIN_RATE',JSON.stringify(rate));
    const matches=qcFwRead_('Users').filter(u=>u.User_ID===id),u=matches.length===1?matches[0]:null;
    if(!u||!qcFwEnabled_(u.Enabled)||!QC_ROLES.includes(u.Role))return null;
    const until=u.Locked_Until instanceof Date?u.Locked_Until.getTime():0;
    qcFwAssert_(until<=Date.now(),'AUTH: invalid details or temporarily locked account');
    const attempts=until&&until<=Date.now()?0:Number(u.Failed_Attempts||0);
    qcFwAssert_(attempts<QC_APP.LOGIN_FAILURE_LIMIT,'AUTH: temporarily locked account');
    // Reserve an attempt before hashing: concurrent attempts cannot evade the limit.
    return qcFwUpdate_('Users',u,{Failed_Attempts:attempts+1,Locked_Until:new Date(Date.now()+QC_APP.LOGIN_LOCK_MINUTES*60000)});
  });
  const valid=snapshot?qcFwVerifyPassword_(password,snapshot):qcFwConstantEqual_(qcFwPasswordHash_(password,'00000000-0000-0000-0000-000000000000',QC_APP.PASSWORD_ITERATIONS),'invalid');
  return qcFwLocked_(()=>{
    qcFwAssert_(snapshot,'AUTH: invalid login details');const current=qcFwFind_('Users','User_ID',snapshot.User_ID);
    if(!valid){if(Number(current.Failed_Attempts)<QC_APP.LOGIN_FAILURE_LIMIT)qcFwUpdate_('Users',current,{Locked_Until:''});throw new Error('AUTH: invalid login details');}
    qcFwAssert_(qcFwEnabled_(current.Enabled)&&current.Password_Hash===snapshot.Password_Hash&&Number(current.Token_Version||1)===Number(snapshot.Token_Version||1),'AUTH: access changed; sign in again');
    const saved=qcFwUpdate_('Users',current,{Failed_Attempts:0,Locked_Until:'',Last_Login:new Date()});
    qcFwAudit_({userId:current.User_ID},'LOGIN','USER',current.User_ID,[],'');return qcFwIssueSession_(saved);
  });
}

function qcFwChangePassword_(request){
  const actor=qcFwRequireUser_(request.token,null,true),current=qcFwFind_('Users','User_ID',actor.userId);
  qcFwAssert_(typeof request.current_password==='string'&&request.current_password.length<=128&&qcFwVerifyPassword_(request.current_password,current),'CURRENT_PASSWORD_INVALID');
  qcFwPasswordPolicy_(request.new_password);qcFwAssert_(request.current_password!==request.new_password,'USE_A_DIFFERENT_PASSWORD');
  const fields=qcFwPasswordFields_(request.new_password);
  return qcFwLocked_(()=>{
    qcFwRequireUser_(request.token,null,true);const latest=qcFwFind_('Users','User_ID',actor.userId);
    qcFwAssert_(latest.Password_Hash===current.Password_Hash,'PASSWORD_CHANGED_IN_ANOTHER_SESSION');
    qcFwUpdate_('Users',latest,Object.assign(fields,{Token_Version:Number(latest.Token_Version||1)+1,Must_Change_Password:false,Failed_Attempts:0,Locked_Until:'',Revision:Number(latest.Revision||1)+1}));
    qcFwAudit_(actor,'CHANGE_PASSWORD','USER',actor.userId,['Password','Token_Version'],'');return {success:true,message:'Password changed. Sign in again.'};
  });
}

