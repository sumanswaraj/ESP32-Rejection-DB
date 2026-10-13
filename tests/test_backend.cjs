const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const {DOMParser}=require('@xmldom/xmldom');
const root=fs.existsSync(path.join(__dirname,'ESP32_Rejection_Logger'))?path.join(__dirname,'ESP32_Rejection_Logger'):path.resolve(__dirname,'..');
const source=fs.readdirSync(root).filter(n=>n.endsWith('.gs')).sort().map(n=>fs.readFileSync(path.join(root,n),'utf8')).join('\n');
const clone=v=>v;
function col(s){return [...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);}
class Range{
 constructor(sheet,r,c,n=1,m=1){Object.assign(this,{sheet,r,c,n,m});}
 getValues(){if(this.sheet.name==='ESP32_Log'&&this.r===2&&this.n>1&&this.m===18)this.sheet.fullLogReads++;this.sheet.reads.push({r:this.r,c:this.c,n:this.n,m:this.m});return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sheet.cells[this.r+i-1]?.[this.c+j-1]??''));}
 getValue(){return this.getValues()[0][0];}
 setValues(values){assert.equal(values.length,this.n);values.forEach((row,i)=>{assert.equal(row.length,this.m);this.sheet.cells[this.r+i-1]??=[];row.forEach((v,j)=>this.sheet.cells[this.r+i-1][this.c+j-1]=clone(v));});if(this.sheet.throwAfterWrite&&this.r>1){this.sheet.throwAfterWrite=false;throw new Error('SIMULATED_RESPONSE_LOSS_AFTER_WRITE');}return this;}
 setValue(v){return this.setValues([[v]]);}
 getFormulas(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sheet.formulas[(this.r+i)+','+(this.c+j)]||''));}
 getFormula(){return this.getFormulas()[0][0];}
 setFormula(f){this.sheet.formulas[this.r+','+this.c]=f;return this;}
 setFormulas(values){values.forEach((row,i)=>row.forEach((f,j)=>this.sheet.formulas[(this.r+i)+','+(this.c+j)]=f));return this;}
 createTextFinder(value){const self=this;return {matchEntireCell(){return this;},useRegularExpression(){return this;},findAll(){const result=[];for(let i=0;i<self.n;i++)if(self.sheet.cells[self.r+i-1]?.[self.c-1]===value)result.push({getRow:()=>self.r+i});return result;}};}
 setDataValidation(rule){this.sheet.validations.push(rule);if(rule.checkbox){for(let i=0;i<this.n;i++){this.sheet.cells[this.r+i-1]??=[];for(let j=0;j<this.m;j++)if(this.sheet.cells[this.r+i-1][this.c+j-1]==null||this.sheet.cells[this.r+i-1][this.c+j-1]==='')this.sheet.cells[this.r+i-1][this.c+j-1]=false;}}return this;}
}
for(const method of ['setNumberFormat','setBackground','setFontColor','setFontWeight','setFontSize','setWrap','setNotes'])Range.prototype[method]=function(){return this;};
class Sheet{
 constructor(name){this.name=name;this.cells=[];this.formulas={};this.maxRows=1000;this.maxColumns=26;this.validations=[];this.charts=[];this.fullLogReads=0;this.reads=[];}
 getName(){return this.name;}getMaxRows(){return this.maxRows;}getMaxColumns(){return this.maxColumns;}
 insertRowsAfter(r,n){this.maxRows+=n;}insertColumnsAfter(c,n){this.maxColumns+=n;}
 getLastRow(){return Math.max(0,...Array.from(this.cells,(r,i)=>r&&r.some(v=>v!==''&&v!=null)?i+1:0),...Object.keys(this.formulas).map(k=>+k.split(',')[0]));}
 getLastColumn(){return Math.max(0,...Array.from(this.cells,r=>r?r.length:0),...Object.keys(this.formulas).map(k=>+k.split(',')[1]));}
 getRange(r,c,n=1,m=1){if(typeof r==='string'){const a=r.split(':');const parse=s=>{const p=/^([A-Z]+)(\d*)$/.exec(s);return {c:col(p[1]),r:p[2]?+p[2]:null};};const x=parse(a[0]),y=a[1]?parse(a[1]):x;r=x.r||1;c=x.c;n=a[1]?(y.r||this.maxRows)-r+1:1;m=y.c-c+1;}assert.ok(r>=1&&c>=1&&n>=1&&m>=1);assert.ok(r+n-1<=this.maxRows&&c+m-1<=this.maxColumns,'Range exceeds grid');return new Range(this,r,c,n,m);}
 getDataRange(){return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()));}
 appendRow(row){return this.getRange(this.getLastRow()+1,1,1,row.length).setValues([row]);}
 deleteRow(r){this.cells.splice(r-1,1);}
 newChart(){const c={};for(const n of ['setChartType','addRange','setPosition','setOption'])c[n]=()=>c;c.build=()=>({chart:true});return c;}
 insertChart(c){this.charts.push(c);}
}
for(const method of ['setFrozenRows','setTabColor','setColumnWidths','setRowHeight'])Sheet.prototype[method]=function(){return this;};
function workbook(id){return {id,sheets:{Sheet1:new Sheet('Sheet1')},timezone:'Asia/Kolkata',getId(){return this.id;},getSheetByName(n){return this.sheets[n]||null;},insertSheet(n){assert.ok(!this.sheets[n]);return this.sheets[n]=new Sheet(n);},setSpreadsheetTimeZone(t){this.timezone=t;},getSpreadsheetTimeZone(){return this.timezone;}};}
const book=workbook('generated-test-book-id'),second=workbook('another-test-book-id'),legacy=workbook('existing-v3-upgrade-book'),properties=new Map(),cacheValues=new Map();let activeBook=book,ownerHtml='',busy=false,opens=0;
const xmlElement=el=>({getName:()=>el.localName,getNamespace:()=>({getURI:()=>el.namespaceURI||''}),getChildren:()=>Array.from(el.childNodes).filter(n=>n.nodeType===1).map(xmlElement),getAttributes:()=>Array.from(el.attributes).filter(a=>a.namespaceURI!=='http://www.w3.org/2000/xmlns/').map(a=>({getName:()=>a.localName,getValue:()=>a.value}))});
const context={Date,console:{warn(){},error(){},info(){}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty(k,v){properties.set(k,String(v));return this;},setProperties(o){Object.entries(o).forEach(([k,v])=>properties.set(k,String(v)));return this;},deleteProperty(k){properties.delete(k);}})},
 SpreadsheetApp:{getActiveSpreadsheet:()=>activeBook,openById:id=>{opens++;assert.equal(id,properties.get('QC_BOOK_ID'));return [book,second,legacy].find(b=>b.id===id);},flush(){},newDataValidation:()=>{const r={checkbox:false,requireCheckbox(){this.checkbox=true;return this;}};for(const n of ['requireValueInList','setAllowInvalid'])r[n]=()=>r;r.build=()=>({validated:true,checkbox:r.checkbox});return r;},getUi:()=>({alert(){},showModalDialog(html){ownerHtml=html.content;},createMenu(){const menu={addItem(){return menu;},addToUi(){}};return menu;}})},
 XmlService:{parse(xml){const doc=new DOMParser({onError(level,message){throw new Error(message);}}).parseFromString(xml,'image/svg+xml');return {getRootElement:()=>xmlElement(doc.documentElement)};}},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:value=>({value,setMimeType(){return this;}})},
 HtmlService:{createHtmlOutput:content=>({content,setWidth(){return this;},setHeight(){return this;}})},Charts:{ChartType:{BAR:'bar'}},
 LockService:{getScriptLock:()=>({held:false,tryLock(){if(busy)return false;this.held=true;return true;},releaseLock(){this.held=false;},hasLock(){return this.held;}})},
 CacheService:{getScriptCache:()=>({get:k=>cacheValues.get(k)||null,getAll:keys=>Object.fromEntries(keys.filter(k=>cacheValues.has(k)).map(k=>[k,cacheValues.get(k)])),put(k,v){assert.ok(Buffer.byteLength(v)<100000);cacheValues.set(k,v);},putAll(o){Object.entries(o).forEach(([k,v])=>{assert.ok(Buffer.byteLength(v)<100000);cacheValues.set(k,v);});}})},
 Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(alg,value)=>Array.from(crypto.createHash('sha256').update(typeof value==='string'?value:Buffer.from(value.map(b=>b&255))).digest()),computeHmacSha256Signature:(value,key)=>Array.from(crypto.createHmac('sha256',key).update(value).digest()),base64Encode:bytes=>Buffer.from(bytes.map(b=>b&255)).toString('base64'),base64Decode:s=>Array.from(Buffer.from(s,'base64')),formatDate:(date,tz)=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
};
vm.createContext(context);for(const name of fs.readdirSync(root).filter(n=>n.endsWith('.gs')).sort())vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
// Compare the reused V8 KDF against native Node crypto, including the full configured work factor.
for(const iterations of [1,2,1000,600000]){const key=Buffer.from('unicode-key-π'),salt=Buffer.from('00000000-0000-0000-0000-000000000001');const actual=Buffer.from(context.qcFwPbkdf2Sha256_(Array.from(key),Array.from(salt),iterations));assert.deepEqual(actual,crypto.pbkdf2Sync(key,salt,iterations,32,'sha256'));}
console.log('PASS: PBKDF2 matches native crypto at 1, 2, 1,000 and 600,000 iterations.');
// Business-flow tests use native KDF after equivalence above to avoid repeated pure-V8 hashing time.
context.qcFwPbkdf2Sha256_=(key,salt,iterations)=>Array.from(crypto.pbkdf2Sync(Buffer.from(key.map(b=>b&255)),Buffer.from(salt.map(b=>b&255)),iterations,32,'sha256'));
// Ignore only checkbox-only templates: disabled accounts and incomplete
// non-checkbox records remain visible to setup's existing-account safeguards.
const sparseUsers=new Sheet('Users');sparseUsers.cells=[['User_ID','Role','Enabled','Must_Change_Password','Password_Hash'],['','',false,false,''],['','',true,true,''],['disabled_user','VIEWER',false,false,'existing-hash'],['','',false,false,'incomplete-hash']];
const realRows=context.qcFwRows_(sparseUsers);assert.equal(realRows.length,2);assert.equal(realRows[0]._row,4);assert.equal(realRows[1]._row,5);
context.setupRejectionLogger();assert.equal(properties.get('QC_BOOK_ID'),book.id);
const names=['ESP32_Log','Defect_Master','Report_Data','QR_Master','Job_Assignments','Config','Setup','Legends','Users','Sessions','Audit_Log','Dashboard'];names.forEach(n=>assert.ok(book.sheets[n],n));
assert.ok(!book.sheets.Looker_Data&&!book.sheets.Looker_Setup,'Fresh setup must not create Looker tabs');assert.equal(book.sheets.Report_Data.cells[0][5],'Logger_ID');assert.ok(book.sheets.Sheet1);assert.equal(book.sheets.Defect_Master.getLastRow(),17);assert.equal(book.sheets.ESP32_Log.getLastRow(),1);assert.equal(book.sheets.Job_Assignments.getLastRow(),1);assert.equal(context.qcFwRows_(book.sheets.QR_Master).length,0);
assert.equal(context.qcFwRows_(book.sheets.Users).length,1);assert.equal(context.qcFwRows_(book.sheets.Users)[0]._row,2,'Owner must reuse row 2 rather than append beyond checkbox defaults');
assert.equal(book.sheets.Users.cells[999][7],false,'Unused checkbox defaults must be preserved');
assert.equal(book.sheets.Report_Data.maxRows,2000);assert.match(book.sheets.Report_Data.formulas['2,9'],/ESP32_Log!M2:M/);assert.match(book.sheets.Report_Data.formulas['2,1'],/O2:O/);assert.equal(book.sheets.Dashboard.charts.length,1);
const credentials=[...ownerHtml.matchAll(/<pre>(.*?)<\/pre>/g)].map(m=>m[1]);assert.equal(credentials.length,2);let [ownerId,initialPassword]=credentials;
const apiKey=book.sheets.Config.cells.find(r=>r[0]==='API_Key')[1],secret=properties.get('QC_AUTH_SECRET'),ownerHash=book.sheets.Users.cells[1][3];assert.equal(apiKey.length,64);
context.setupRejectionLogger();assert.equal(context.qcFwRows_(book.sheets.Users).length,1);assert.equal(book.sheets.Config.cells.find(r=>r[0]==='API_Key')[1],apiKey);assert.equal(properties.get('QC_AUTH_SECRET'),secret);assert.equal(book.sheets.Users.cells[1][3],ownerHash);assert.equal(book.sheets.Dashboard.charts.length,1);
activeBook=null;assert.throws(()=>context.setupRejectionLogger(),/BOUND_EDITOR_REQUIRED/);activeBook=book;
function portal(action,payload={}){return context.qcPortal({action,...payload});}
function ok(r){assert.equal(r.success,true,r.error);return r;}
function reject(r,pattern){assert.equal(r.success,false);assert.match(r.error,pattern);return r;}
function rid(){return crypto.randomUUID().replace(/-/g,'');}
let ownerToken=ok(portal('LOGIN',{user_id:ownerId,password:initialPassword})).token;
reject(portal('GET_DATA',{token:ownerToken}),/PASSWORD_CHANGE_REQUIRED/);
ok(portal('CHANGE_PASSWORD',{token:ownerToken,current_password:initialPassword,new_password:'Owner permanent test passphrase!'}));reject(portal('WHOAMI',{token:ownerToken}),/AUTH:/);
ownerToken=ok(portal('LOGIN',{user_id:ownerId,password:'Owner permanent test passphrase!'})).token;
const initial=ok(portal('GET_DATA',{token:ownerToken}));for(const privateValue of [apiKey,secret,ownerHash,initialPassword])assert.ok(!JSON.stringify(initial).includes(privateValue));
function createUser(actor,id,role){const request={token:actor,user_id:id,role,name:id,password:'Temporary test passphrase!',request_id:rid()};const first=ok(portal('USER_CREATE',request)),duplicate=ok(portal('USER_CREATE',request));assert.equal(first.user.userId,duplicate.user.userId);return first.user;}
function activate(id){let t=ok(portal('LOGIN',{user_id:id,password:'Temporary test passphrase!'})).token;ok(portal('CHANGE_PASSWORD',{token:t,current_password:'Temporary test passphrase!',new_password:'Permanent '+id+' test passphrase!'}));return ok(portal('LOGIN',{user_id:id,password:'Permanent '+id+' test passphrase!'})).token;}
createUser(ownerToken,'admin_one','ADMIN');const adminToken=activate('admin_one');createUser(adminToken,'operator_one','OPERATOR');createUser(adminToken,'viewer_one','VIEWER');const operatorToken=activate('operator_one'),viewerToken=activate('viewer_one');
reject(portal('USER_CREATE',{token:adminToken,user_id:'admin_two',role:'ADMIN',name:'Blocked',password:'Temporary test passphrase!',request_id:rid()}),/ONLY_OWNER/);
reject(portal('USER_UPDATE',{token:adminToken,user_id:ownerId,name:'Owner',role:'ADMIN',enabled:false,revision:2,request_id:rid()}),/OWNER_ACCOUNT_PROTECTED/);
reject(portal('ENTITY_CREATE',{token:operatorToken,type:'PART',name:'Blocked',entity_id:'BLOCKED',request_id:rid()}),/FORBIDDEN/);
reject(portal('START_JOB',{token:viewerToken,logger_id:'ESP32_3',machine_id:'M1',part_id:'P1',request_id:rid()}),/FORBIDDEN/);
reject(portal('SETUP',{token:ownerToken}),/UNKNOWN_ACTION/);
function entity(type,id){return ok(portal('ENTITY_CREATE',{token:adminToken,type,entity_id:id,name:id,request_id:rid()})).entity;}
entity('LOGGER','ESP32_3');entity('LOGGER','ESP32_4');entity('MACHINE','M1');entity('MACHINE','M2');entity('PART','P1');entity('PART','P2');
assert.equal(book.sheets.QR_Master.cells[1][1],'ESP32_3','First entity must reuse row 2');
assert.equal(context.qcFwRows_(book.sheets.QR_Master).length,6,'Checkbox-only entity rows must not appear in registry');
const auto=ok(portal('ENTITY_CREATE',{token:adminToken,type:'PART',name:'Auto ID',request_id:rid()}));assert.match(auto.entity.id,/^PART_/);
const start={token:operatorToken,logger_id:'ESP32_3',machine_id:'M1',part_id:'P1',machine_operator:'Employee 17',reason:'Initial test',request_id:rid()};const firstJob=ok(portal('START_JOB',start)).job;assert.equal(ok(portal('START_JOB',start)).job.id,firstJob.id);assert.equal(firstJob.operator,'Employee 17');assert.equal(firstJob.startedBy,'operator_one');
reject(portal('START_JOB',{...start,machine_operator:'Employee 18'}),/REQUEST_ID_PAYLOAD_CONFLICT/);
reject(portal('START_JOB',{...start,machine_operator:'x'.repeat(121),request_id:rid()}),/MACHINE_OPERATOR_INVALID/);
reject(portal('START_JOB',{...start,request_id:rid()}),/LOGGER_ALREADY_HAS_ACTIVE_JOB/);reject(portal('START_JOB',{...start,logger_id:'ESP32_4',request_id:rid()}),/MACHINE_ALREADY_HAS_ACTIVE_JOB/);
reject(portal('ENTITY_UPDATE',{token:adminToken,entity_id:'M1',name:'M1',enabled:false,revision:1,request_id:rid()}),/STOP_ACTIVE_JOB/);
function firmware(p){const result=context.doPost({postData:{contents:JSON.stringify(p)}});return JSON.parse(result.value);}
let assignment=ok(firmware({action:'qc_get_assignment_v2',api_key:apiKey,device_id:'ESP32_3'}));assert.equal(assignment.assignment_id,firstJob.id);assert.equal(assignment.operator_id,'operator_one','Keep the existing firmware actor contract');
function event(seq,q=10,job=firstJob){return {schema_version:2,device_id:'ESP32_3',generation:'0123456789abcdef',sequence:seq,event_id:'ESP32_3-0123456789abcdef-'+seq,rejection_code:1,quantity:q,client_ms:100,source:'touch',time_quality:'sntp',occurred_at:new Date(job.start).toISOString().replace(/\.\d{3}Z$/,'Z'),assignment_id:job.id,assignment_version:1,machine_id:job.machine,part_id:job.part,device_name:'QC test'};}
function request(p){const raw=JSON.stringify(p);return {action:'qc_ingest_v2',api_key:apiKey,device_id:p.device_id,record_json:raw,payload_hash:crypto.createHash('sha256').update(raw).digest('hex')};}
reject(firmware({...request(event(1)),api_key:'incorrect'}),/AUTH_FAILED/);reject(firmware({...request(event(1)),payload_hash:'bad'}),/HASH_MISMATCH/);
let committed=ok(firmware(request(event(1))));assert.equal(committed.status,'committed');assert.equal(committed.new_total_count,10);
let duplicate=ok(firmware(request(event(1))));assert.equal(duplicate.status,'duplicate');assert.equal(book.sheets.ESP32_Log.getLastRow(),2);
reject(firmware(request(event(1,11))),/EVENT_ID_PAYLOAD_CONFLICT/);reject(firmware(request(event(2,0))),/INVALID_QUANTITY/);
const change={token:operatorToken,logger_id:'ESP32_3',machine_id:'M1',part_id:'P2',machine_operator:'Employee 22',job_id:firstJob.id,revision:firstJob.revision,reason:'Part change',request_id:rid()};
const secondJob=ok(portal('PART_CHANGEOVER',change)).job;assert.equal(ok(portal('PART_CHANGEOVER',change)).job.id,secondJob.id);assert.equal(book.sheets.Job_Assignments.getLastRow(),3);
const jobHeaders=book.sheets.Job_Assignments.cells[0],oldRow=book.sheets.Job_Assignments.cells[1],newRow=book.sheets.Job_Assignments.cells[2];assert.equal(oldRow[2].toISOString(),newRow[1].toISOString());assert.equal(oldRow[9],'operator_one');
assert.equal(oldRow[15],'Employee 17');assert.equal(newRow[15],'Employee 22');assert.equal(secondJob.operator,'Employee 22');
let historical=ok(firmware(request(event(2,3,firstJob))));assert.equal(historical.new_total_count,13);assert.equal(book.sheets.ESP32_Log.cells.at(-1)[9],firstJob.id);
reject(firmware(request({...event(3,1,firstJob),occurred_at:new Date(new Date(secondJob.start).getTime()+7000).toISOString().replace(/\.\d{3}Z$/,'Z')})),/AFTER_JOB_END/);
// Simulate a write succeeding while the RPC response fails; retry must deduplicate.
book.sheets.ESP32_Log.throwAfterWrite=true;reject(firmware(request(event(3,2,secondJob))),/SIMULATED_RESPONSE_LOSS/);assert.equal(ok(firmware(request(event(3,2,secondJob)))).status,'duplicate');assert.equal(ok(firmware(request(event(4,4,secondJob)))).new_total_count,19);
let r=ok(portal('GET_REPORT',{token:viewerToken,filters:{},page:0,page_size:1}));assert.equal(r.pieces,19);assert.equal(r.total,4);assert.equal(r.events.length,1);const readCount=book.sheets.ESP32_Log.fullLogReads;
let next=ok(portal('GET_REPORT',{token:viewerToken,filters:{},snapshot_row:r.snapshotRow,page:1,page_size:1}));assert.equal(next.pieces,19);assert.equal(book.sheets.ESP32_Log.fullLogReads,readCount,'Cached page must not reread full ledger');
cacheValues.clear();ok(portal('GET_REPORT',{token:viewerToken,filters:{},snapshot_row:r.snapshotRow,page:1,page_size:1}));assert.equal(book.sheets.ESP32_Log.fullLogReads,readCount+1,'Evicted cache must rebuild from ledger');
// Dashboard aggregation uses pieces and immutable event snapshots.
assert.equal(r.byPart.find(v=>v.name==='P1').pieces,13);assert.equal(r.byPart.find(v=>v.name==='P2').pieces,6);assert.equal(r.byLogger.find(v=>v.name==='ESP32_3').pieces,19);
assert.equal(r.byWeek.reduce((n,v)=>n+v.pieces,0),19);assert.equal(r.byMonth.reduce((n,v)=>n+v.pieces,0),19);assert.ok(r.byWeek.every(v=>new Date(v.name+'T00:00:00Z').getUTCDay()===1));
const combined=ok(portal('GET_REPORT',{token:viewerToken,filters:{logger:'ESP32_3',machine:'M1',part:'P1'}}));assert.equal(combined.pieces,13);assert.ok(combined.events.every(e=>e.job===firstJob.id));
reject(portal('GET_REPORT',{token:viewerToken,filters:{from:'2026-02-30'}}),/DATE_FILTER_INVALID/);reject(portal('GET_REPORT',{token:viewerToken,filters:{from:'2026-10-12',to:'2026-10-11'}}),/DATE_RANGE_INVALID/);
const refresh0=ok(portal('GET_LIVE_STATE',{token:viewerToken}));assert.equal(refresh0.entities.length,7);assert.equal(refresh0.latestLogRow,5);assert.equal(ok(portal('GET_LIVE_STATE',{token:viewerToken,registry_revision:refresh0.registryRevision})).entities,null);
reject(portal('GET_LIVE_STATE',{}),/AUTH:/);for(const privateValue of [apiKey,secret,ownerHash])assert.ok(!JSON.stringify(refresh0).includes(privateValue));
entity('PART','P_NEW');const refresh1=ok(portal('GET_LIVE_STATE',{token:viewerToken,registry_revision:refresh0.registryRevision}));assert.notEqual(refresh0.registryRevision,refresh1.registryRevision);assert.equal(refresh1.entities.length,8);
const edge=Array(18).fill('');edge[0]=new Date('2025-12-15T05:00:00Z');edge[1]='ESP32_3';edge[2]=1;edge[3]='Short Shot';edge[7]='__proto__';edge[8]='constructor';edge[12]=2;book.sheets.ESP32_Log.appendRow(edge);
const edgeReport=ok(portal('GET_REPORT',{token:viewerToken,filters:{from:'2025-12-15',to:'2025-12-15',part:'__proto__',machine:'constructor'}}));assert.equal(edgeReport.pieces,2);assert.equal(edgeReport.byPart[0].name,'__proto__');assert.equal(edgeReport.byMachine[0].pieces,2);book.sheets.ESP32_Log.cells.pop();cacheValues.clear();
// Optional machine operator needs no login account. Blank and omitted values
// must produce the same pre-upgrade request fingerprint and the same job.
const blankStart={token:operatorToken,logger_id:'ESP32_4',machine_id:'M2',part_id:'P1',request_id:rid()};
const blankJob=ok(portal('START_JOB',blankStart)).job;assert.equal(blankJob.operator,'');assert.equal(ok(portal('START_JOB',{...blankStart,machine_operator:''})).job.id,blankJob.id);
ok(portal('STOP_JOB',{token:operatorToken,job_id:blankJob.id,reason:'Complete',revision:blankJob.revision,request_id:rid()}));
// Large history fixtures exercise real page boundaries and bounded range reads.
for(let i=0;i<23;i++){context.qcFwStartRequest_();context.qcFwAppend_('Job_Assignments',{Job_ID:'PAST_'+i,Started_At:new Date(),Ended_At:new Date(),Logger_ID:'ESP32_4',Molding_Machine_ID:'M2',Part_ID:'P1',Changed_By:'operator_one',Revision:1});}
const history0=ok(portal('GET_JOB_HISTORY',{token:viewerToken}));assert.equal(history0.jobs.length,10);assert.equal(history0.total,26);assert.equal(history0.jobs[0].id,'PAST_22');
book.sheets.Job_Assignments.reads=[];
const history1=ok(portal('GET_JOB_HISTORY',{token:viewerToken,page:1,page_size:10,snapshot_row:history0.snapshotRow}));assert.equal(history1.jobs.length,10);assert.equal(history1.jobs[0].id,'PAST_12');
assert.ok(book.sheets.Job_Assignments.reads.filter(q=>q.c===1&&q.m===16).every(q=>q.n<=10),'History page must not read the whole job ledger');
context.qcFwStartRequest_();context.qcFwAppend_('Job_Assignments',{Job_ID:'NEW_AFTER_PAGE',Started_At:new Date(),Ended_At:new Date(),Logger_ID:'ESP32_4',Molding_Machine_ID:'M2',Part_ID:'P1',Changed_By:'operator_one',Revision:1});
const history2=ok(portal('GET_JOB_HISTORY',{token:viewerToken,page:2,page_size:10,snapshot_row:history0.snapshotRow}));assert.equal(history2.jobs.length,6);assert.equal(new Set([...history0.jobs,...history1.jobs,...history2.jobs].map(j=>j.id)).size,26);assert.ok(!history2.jobs.some(j=>j.id==='NEW_AFTER_PAGE'));
assert.equal(ok(portal('GET_JOB_HISTORY',{token:viewerToken,page_size:5})).jobs.length,5);
reject(portal('GET_JOB_HISTORY',{token:viewerToken,page_size:300}),/PAGE_SIZE_INVALID/);reject(portal('GET_JOB_HISTORY',{page_size:10}),/AUTH:/);
const smallInitial=ok(portal('GET_DATA',{token:viewerToken}));assert.equal(smallInitial.jobs.length,10);assert.equal(smallInitial.jobHistory.total,27);assert.equal(ok(portal('GET_DATA',{token:viewerToken,job_page_size:5})).jobs.length,5);
for(let i=0;i<25;i++){const fixture=Array(18).fill('');fixture[0]=new Date();fixture[1]='SAMPLE_PAGE_TEST';fixture[2]=1;fixture[3]='Short Shot';fixture[5]=20+i;fixture[10]='sample-page-'+i;fixture[12]=1;book.sheets.ESP32_Log.appendRow(fixture);}
const defaultReport=ok(portal('GET_REPORT',{token:viewerToken,filters:{}}));assert.equal(defaultReport.events.length,10);assert.equal(defaultReport.total,29);assert.equal(defaultReport.pieces,44);
assert.equal(ok(portal('GET_REPORT',{token:viewerToken,filters:{},page_size:5,snapshot_row:defaultReport.snapshotRow})).events.length,5);
assert.equal(ok(portal('GET_REPORT',{token:viewerToken,filters:{},page_size:500,snapshot_row:defaultReport.snapshotRow})).events.length,29,'Explicit CSV export still reads all matching records');
// Branding writes require Owner/Admin, use an atomic Config value, and protect
// revisions/retries. A logo never grants access or exposes private settings.
const brand0=ok(portal('GET_BRANDING',{token:viewerToken})).branding;assert.equal(brand0.logoType,'NONE');
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><defs><linearGradient id="brand"><stop stop-color="#157e79"/></linearGradient></defs><path d="M0 0H80V40H0Z" fill="url(#brand)"/><text x="8" y="28" fill="white">QC</text></svg>';
const brandRequest={token:adminToken,name:'Company <Example>',logo_type:'SVG',logo:svg,revision:brand0.revision,request_id:rid()};
reject(portal('BRANDING_UPDATE',{...brandRequest,token:viewerToken}),/FORBIDDEN/);reject(portal('BRANDING_UPDATE',{...brandRequest,token:operatorToken}),/FORBIDDEN/);
const brand1=ok(portal('BRANDING_UPDATE',brandRequest)).branding;assert.equal(brand1.logo,svg);assert.equal(brand1.name,brandRequest.name);assert.equal(brand1.revision,2);assert.equal(ok(portal('BRANDING_UPDATE',brandRequest)).branding.revision,2);
reject(portal('BRANDING_UPDATE',{...brandRequest,name:'Changed on retry'}),/REQUEST_ID_PAYLOAD_CONFLICT/);reject(portal('BRANDING_UPDATE',{...brandRequest,request_id:rid()}),/REVISION_CONFLICT/);
for(const badSvg of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>','<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>','<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.com/a.svg#id"/></svg>','<!DOCTYPE svg [<!ENTITY x "bad">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>','<svg xmlns="http://www.w3.org/2000/svg" style="fill:url(https://example.com/a)"/>','<svg xmlns="http://www.w3.org/2000/svg"><g></svg>']){
  reject(portal('BRANDING_UPDATE',{...brandRequest,logo:badSvg,revision:brand1.revision,request_id:rid()}),/SVG_LOGO_INVALID/);
}
reject(portal('BRANDING_UPDATE',{...brandRequest,logo_type:'URL',logo:'javascript:alert(1)',revision:brand1.revision,request_id:rid()}),/LOGO_URL_INVALID/);
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQk0AAAAASUVORK5CYII=';
const imageBrand=ok(portal('BRANDING_UPDATE',{token:ownerToken,name:'Test Company',logo_type:'IMAGE',logo:png,revision:brand1.revision,request_id:rid()})).branding;assert.equal(imageBrand.logo,png);
reject(portal('BRANDING_UPDATE',{token:ownerToken,name:'Test',logo_type:'IMAGE',logo:'data:image/png;base64,'+Buffer.from('not an image').toString('base64'),revision:imageBrand.revision,request_id:rid()}),/LOGO_IMAGE_INVALID/);
const urlBrand=ok(portal('BRANDING_UPDATE',{token:ownerToken,name:'Test Company',logo_type:'URL',logo:'https://example.com/logo.png',revision:imageBrand.revision,request_id:rid()})).branding;
assert.equal(ok(portal('GET_DATA',{token:viewerToken})).branding.logo,urlBrand.logo);assert.ok(!('lastRequestHash' in urlBrand));
const encoded=context.qcFwHtmlJson_({name:'</script><img src=x onerror=alert(1)>\u2028'});assert.ok(!encoded.includes('<'));assert.equal(JSON.parse(encoded).name,'</script><img src=x onerror=alert(1)>\u2028');
context.setupRejectionLogger();assert.equal(ok(portal('GET_BRANDING',{token:viewerToken})).branding.revision,urlBrand.revision,'Setup must retain custom branding');
const u=ok(portal('GET_DATA',{token:ownerToken})).users.find(u=>u.userId==='admin_one');ok(portal('USER_UPDATE',{token:ownerToken,user_id:u.userId,name:u.name,role:'VIEWER',enabled:true,revision:u.revision,request_id:rid()}));reject(portal('GET_REPORT',{token:adminToken,filters:{}}),/AUTH:/);reject(portal('GET_DATA',{token:adminToken}),/AUTH:/);
let operator=ok(portal('GET_DATA',{token:ownerToken})).users.find(u=>u.userId==='operator_one');
const reset={token:ownerToken,user_id:operator.userId,password:'Reset temporary test passphrase!',revision:operator.revision,request_id:rid()};ok(portal('USER_RESET_PASSWORD',reset));ok(portal('USER_RESET_PASSWORD',reset));reject(portal('WHOAMI',{token:operatorToken}),/AUTH:/);
const resetToken=ok(portal('LOGIN',{user_id:operator.userId,password:reset.password})).token;reject(portal('GET_DATA',{token:resetToken}),/PASSWORD_CHANGE_REQUIRED/);
operator=ok(portal('GET_DATA',{token:ownerToken})).users.find(u=>u.userId==='operator_one');ok(portal('USER_UPDATE',{token:ownerToken,user_id:operator.userId,name:operator.name,role:'OPERATOR',enabled:false,revision:operator.revision,request_id:rid()}));reject(portal('WHOAMI',{token:resetToken}),/AUTH:/);reject(portal('LOGIN',{user_id:operator.userId,password:reset.password}),/AUTH:/);
properties.delete('QC_LOGIN_RATE');for(let i=0;i<5;i++)reject(portal('LOGIN',{user_id:'viewer_one',password:'Wrong test password!'}),/AUTH:/);reject(portal('LOGIN',{user_id:'viewer_one',password:'Permanent viewer_one test passphrase!'}),/temporarily locked/);
const state={key:apiKey,rows:book.sheets.ESP32_Log.getLastRow(),users:book.sheets.Users.getLastRow(),jobs:book.sheets.Job_Assignments.getLastRow()};context.setupRejectionLogger();assert.equal(book.sheets.ESP32_Log.getLastRow(),state.rows);assert.equal(book.sheets.Users.getLastRow(),state.users);assert.equal(book.sheets.Job_Assignments.getLastRow(),state.jobs);
busy=true;reject(firmware({action:'qc_get_assignment_v2',api_key:apiKey,device_id:'ESP32_3'}),/BUSY_RETRY/);busy=false;
activeBook=second;context.setupRejectionLogger();assert.equal(properties.get('QC_BOOK_ID'),second.id);assert.equal(second.sheets.ESP32_Log.getLastRow(),1);assert.equal(context.qcFwRows_(second.sheets.Users).length,1);assert.equal(context.qcFwRows_(second.sheets.Users)[0]._row,2);
// Real existing accounts without an owner must still trigger the review guard.
const secondOwner=second.sheets.Users.cells[1],savedRole=secondOwner[2],savedHash=secondOwner[3],savedKey=second.sheets.Config.cells.find(r=>r[0]==='API_Key')[1];
secondOwner[2]='ADMIN';assert.throws(()=>context.setupRejectionLogger(),/OWNER_SETUP_REQUIRED/);assert.equal(second.sheets.Users.cells[1][3],savedHash);assert.equal(second.sheets.Config.cells.find(r=>r[0]==='API_Key')[1],savedKey);assert.equal(context.qcFwRows_(second.sheets.Users).length,1);secondOwner[2]=savedRole;context.setupRejectionLogger();
// A matching cached row count from a different workbook must not supply its total.
second.sheets.QR_Master.cells=book.sheets.QR_Master.cells.map(r=>r.slice());second.sheets.Job_Assignments.cells=[book.sheets.Job_Assignments.cells[0].slice(),book.sheets.Job_Assignments.cells[1].slice()];second.sheets.Job_Assignments.cells[1][2]='';
const seed=Array(18).fill('');seed[0]=new Date();seed[1]='OLD_LOGGER';seed[5]=7;seed[10]='old-event';seed[12]=7;second.sheets.ESP32_Log.appendRow(seed);
properties.set('QC_TOTAL_BOOK_ID',book.id);properties.set('QC_TOTAL_LAST_ROW','2');properties.set('QC_TOTAL','999');const secondKey=second.sheets.Config.cells.find(r=>r[0]==='API_Key')[1];assert.equal(ok(firmware({...request(event(99,3,firstJob)),api_key:secondKey})).new_total_count,10);
// Upgrade an existing v3 ledger, with records and credentials, from 15 columns.
for(const [name,s] of Object.entries(book.sheets)){const copy=new Sheet(name);copy.cells=s.cells.map(r=>r&&r.slice());copy.formulas={...s.formulas};copy.maxRows=s.maxRows;copy.charts=s.charts.slice();legacy.sheets[name]=copy;}
legacy.sheets.Job_Assignments.cells=legacy.sheets.Job_Assignments.cells.map(r=>r.slice(0,15));legacy.sheets.Config.cells=legacy.sheets.Config.cells.filter(r=>r[0]!=='Company_Branding_JSON');legacy.sheets.Config.cells.find(r=>r[0]==='App_Version')[1]='3.0';
const priorJobs=legacy.sheets.Job_Assignments.cells.map(r=>r.slice()),priorLogs=legacy.sheets.ESP32_Log.cells.map(r=>r.slice()),priorKey=legacy.sheets.Config.cells.find(r=>r[0]==='API_Key')[1],priorHash=legacy.sheets.Users.cells[1][3];
properties.set('QC_BOOK_ID',legacy.id);activeBook=legacy;
reject(portal('START_JOB',{token:ownerToken,logger_id:'ESP32_4',machine_id:'M2',part_id:'P1',machine_operator:'Employee new',request_id:rid()}),/SETUP_UPDATE_REQUIRED/);
context.setupRejectionLogger();assert.equal(legacy.sheets.Job_Assignments.cells[0][15],'Machine_Operator');assert.deepEqual(legacy.sheets.Job_Assignments.cells.map(r=>r.slice(0,15)),priorJobs);assert.deepEqual(legacy.sheets.ESP32_Log.cells,priorLogs);assert.equal(legacy.sheets.Config.cells.find(r=>r[0]==='API_Key')[1],priorKey);assert.equal(legacy.sheets.Users.cells[1][3],priorHash);assert.equal(properties.get('QC_AUTH_SECRET'),secret);
assert.equal(ok(portal('GET_JOB_HISTORY',{token:ownerToken})).jobs[0].operator,'');assert.equal(legacy.sheets.Config.cells.find(r=>r[0]==='App_Version')[1],'3.2.1');
const namedUpgrade=ok(portal('START_JOB',{token:ownerToken,logger_id:'ESP32_4',machine_id:'M2',part_id:'P1',machine_operator:'=employee17',request_id:rid()})).job;assert.equal(namedUpgrade.operator,"'=employee17",'Protect sheet cells from formula-looking operator names');
// Additive migration keeps legacy tabs/custom dashboard cells and all records.
legacy.sheets.Looker_Data=new Sheet('Looker_Data');legacy.sheets.Looker_Data.cells=[['Legacy custom header'],['Keep me']];
legacy.sheets.Looker_Setup=new Sheet('Looker_Setup');legacy.sheets.Looker_Setup.cells=[['Custom'],['Keep me too']];
legacy.sheets.Dashboard.formulas['3,2']='=SUM(Looker_Data!I2:I)';legacy.sheets.Dashboard.formulas['5,2']='=1+1';
const beforeLogs=JSON.stringify(legacy.sheets.ESP32_Log.cells),beforeJobs=JSON.stringify(legacy.sheets.Job_Assignments.cells),beforeUsers=JSON.stringify(legacy.sheets.Users.cells);delete legacy.sheets.Report_Data;
const upgrade=context.applyRejectionLoggerUpgrade();assert.equal(upgrade.success,true);assert.equal(upgrade.recordsPreserved,true);assert.equal(upgrade.credentialsPreserved,true);assert.equal(upgrade.installedVersion,'3.2.1');
assert.equal(JSON.stringify(legacy.sheets.ESP32_Log.cells),beforeLogs);assert.equal(JSON.stringify(legacy.sheets.Job_Assignments.cells),beforeJobs);assert.equal(JSON.stringify(legacy.sheets.Users.cells),beforeUsers);assert.equal(legacy.sheets.Config.cells.find(r=>r[0]==='API_Key')[1],priorKey);
assert.equal(legacy.sheets.Looker_Data.cells[1][0],'Keep me');assert.equal(legacy.sheets.Looker_Setup.cells[1][0],'Keep me too');assert.equal(legacy.sheets.Dashboard.formulas['3,2'],'=SUM(Report_Data!I2:I)');assert.equal(legacy.sheets.Dashboard.formulas['5,2'],'=1+1');
console.log('PASS: piece totals by part/logger/week/month, combined historical filters, date validation, unusual IDs, authenticated live registry revisions and additive no-Looker migration.');
assert.ok(!/SpreadsheetApp\.openById\(['"]/.test(source));assert.ok(!source.includes('getEmail('));assert.ok(!/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(source));
console.log('PASS: two arbitrary blank sheets; all 12 required tabs, formulas, legend and owner bootstrap; rerun/key/history preservation; no email/ID dependency.');
console.log('PASS: forced password changes, private-data filtering, role boundaries, generated/custom IDs, idempotent creation, sessions and immediate role-revocation checks.');
console.log('PASS: job conflicts, changeover/history, device assignment, quantity ingest, duplicate/hash validation, closed-job replay, response-loss recovery and optional report-cache fallback.');
console.log('PASS: cached report pagination avoids a repeated full ESP32_Log read; auth is rechecked before returning cached reports.');
console.log('PASS: FALSE/TRUE checkbox-only rows do not become users/entities; owner and first entity use row 2; disabled/incomplete records and real-account review safeguards are preserved.');
console.log('PASS: 5/10-row history pages, bounded range reads, stable browsing after new jobs, 10-row rejection defaults and explicit full CSV pages.');
console.log('PASS: optional machine operator, separate login actor, legacy retries, changeover attribution and existing v3 ledger/credentials upgrade.');
console.log('PASS: company branding roles, SVG/image/URL validation, revisions/retry safety, safe boot JSON and setup preservation.');
