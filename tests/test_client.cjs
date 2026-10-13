const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const root=require('node:path').resolve(__dirname,'..')+'/';
const defaultBrand={name:'Example Company',logoType:'NONE',logo:'',revision:1};
const html=fs.readFileSync(root+'Index.html','utf8').replace(/<\?!= qcInclude_\('(\w+)'\); \?>/g,(_,name)=>fs.readFileSync(root+name+'.html','utf8')).replace(/<\?!= brandingJson; \?>/g,JSON.stringify(defaultBrand));
const {window,document}=parseHTML(html);const calls=[],store=new Map([['qc_session','a'.repeat(64)]]),timers=[];
const viewer={userId:'viewer_one',name:'Viewer',role:'VIEWER',enabled:true,mustChangePassword:false,revision:1};let actor=viewer,branding={...defaultBrand};
const entities=[{id:'ESP32_3',type:'LOGGER',name:'Logger',enabled:true,qr:'QC:LOGGER:ESP32_3',revision:1}];
const jobs=Array.from({length:27},(_,i)=>({id:'JOB_'+(26-i),logger:'ESP32_3',machine:'M1',part:'P1',operator:'Employee '+i,start:'2026-10-10T08:00:00Z',end:'2026-10-10T09:00:00Z',startedBy:'operator_one',closedBy:'operator_one',revision:1}));
let activeJobs=[{...jobs[0],id:'ACTIVE_1',operator:'Employee 17',end:''}];
const event={timestamp:'2026-10-10T08:00:00Z',received:'2026-10-10T08:00:00Z',day:'2026-10-10',logger:'ESP32_3',machine:'M1',part:'P1',defectCode:1,defect:'<img src=x onerror=alert(1)>',quantity:7,job:'JOB_1',event:'e1',source:'touch',timeQuality:'sntp',type:'REAL'};
const events=Array.from({length:25},(_,i)=>({...event,event:'e'+i}));
const report={success:true,timezone:'Asia/Kolkata',snapshotRow:26,total:25,pieces:175,byDefect:[{name:event.defect,pieces:175}],byMachine:[{name:'M1',pieces:175}],byDay:[{name:event.day,pieces:175}],byPart:[{name:'P1',pieces:175}],byLogger:[{name:'ESP32_3',pieces:175}],byWeek:[{name:'2026-10-05',pieces:175}],byMonth:[{name:'2026-10',pieces:175}]};
let reportDelay=[],historyDelay=[];
function response(r){
 if(r.action==='WHOAMI')return {success:true,user:actor};
 if(r.action==='GET_DATA'){const size=r.job_page_size||10;return {success:true,user:actor,version:'3.1',timezone:'Asia/Kolkata',branding,entities,jobs:jobs.slice(0,size),jobHistory:{page:0,pageSize:size,total:jobs.length,snapshotRow:jobs.length+1},activeJobs,users:[],audit:[],defects:[{code:1,key:'1',touch:1,name:'Short Shot'}]};}
 if(r.action==='GET_JOB_HISTORY'){const page=r.page||0,size=r.page_size||10;return {success:true,page,pageSize:size,total:jobs.length,snapshotRow:r.snapshot_row||jobs.length+1,jobs:jobs.slice(page*size,(page+1)*size)};}
 if(r.action==='GET_ACTIVE_JOBS')return {success:true,activeJobs};
 if(r.action==='GET_LIVE_STATE')return {success:true,activeJobs,entities,registryRevision:'test-revision',latestLogRow:26};
 if(r.action==='GET_REPORT'){const page=r.page||0,size=r.page_size||10;return {...report,page,pageSize:size,events:events.slice(page*size,(page+1)*size)};}
 if(r.action==='START_JOB'||r.action==='PART_CHANGEOVER')return {success:true,job:{id:'SAVED_JOB'},message:'Job saved.'};
 if(r.action==='GET_BRANDING')return {success:true,branding};
 if(r.action==='BRANDING_UPDATE'){branding={name:r.name,logoType:r.logo_type,logo:r.logo,revision:branding.revision+1};return {success:true,branding,message:'Company name and logo saved.'};}
 if(r.action==='LOGOUT')return {success:true};return {success:false,error:'FORBIDDEN'};
}
for(const id of ['editDialog','scanDialog']){document.getElementById(id).showModal=function(){this.open=true;};document.getElementById(id).close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};}
window.HTMLSelectElement.prototype.add=function(option){this.append(option);};
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.getAttribute('value')??this.querySelector('option')?.getAttribute('value')??'';},set(value){this.querySelectorAll('option').forEach(o=>{if(o.getAttribute('value')===String(value))o.setAttribute('selected','');else o.removeAttribute('selected');});}});
const context={window,document,Node:window.Node,Option:function(label,value){const o=document.createElement('option');o.textContent=label;o.setAttribute('value',value);return o;},Intl,Date,console,crypto:crypto.webcrypto,sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},setTimeout:(fn)=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval(){},URL,Blob,Event:window.Event,navigator:{},Image:class {},
 URLSearchParams,google:{script:{run:{withSuccessHandler(success){return {withFailureHandler(failure){return {qcPortal(request){calls.push(request);const queue=request.action==='GET_REPORT'?reportDelay:request.action==='GET_JOB_HISTORY'?historyDelay:[];if(queue.length)queue.shift()(()=>success(response(request)));else setImmediate(()=>success(response(request)));}};}};}}}}};
window.location={origin:'https://example-script.googleusercontent.com'};
vm.createContext(context);for(const script of document.querySelectorAll('script'))vm.runInContext(script.textContent,context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{for(let i=0;i<5;i++)await flush();};
const el=id=>document.getElementById(id),rows=id=>el(id).querySelectorAll('tbody tr').length;
const click=id=>el(id).dispatchEvent(new window.Event('click'));
const change=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new window.Event('change',{bubbles:true}));};
(async()=>{
 await settle();
 assert.equal(el('loginView').hidden,true);assert.equal(el('appView').hidden,false);assert.match(el('identity').textContent,/VIEWER/);
 assert.ok(document.querySelector('[data-view="users"]').hidden);assert.ok(document.querySelector('[data-view="settings"]').hidden);assert.ok(document.querySelector('[data-write-job]').hidden);assert.equal(calls.filter(c=>c.action==='GET_REPORT').length,1,'Dashboard loads a report; detail reports remain lazy');assert.equal(el('dashPieces').textContent,'175');vm.runInContext("switchView('jobs')",context);
 assert.equal(rows('jobHistory'),10);assert.match(el('jobPageInfo').textContent,/1–10 of 27/);assert.equal(el('previousJobPage').disabled,true);assert.equal(el('companyName').textContent,'Example Company');
 vm.runInContext("switchView('settings')",context);assert.equal(el('settingsView').hidden,true,'Viewer cannot navigate to company settings');
 click('nextJobPage');await settle();assert.equal(rows('jobHistory'),10);assert.match(el('jobPageInfo').textContent,/11–20 of 27/);assert.equal(calls.at(-1).action,'GET_JOB_HISTORY');assert.equal(calls.at(-1).snapshot_row,28);
 click('nextJobPage');await settle();assert.equal(rows('jobHistory'),7);assert.equal(el('nextJobPage').disabled,true);assert.match(el('jobPageInfo').textContent,/21–27/);
 change('jobPageSize','5');await settle();assert.equal(rows('jobHistory'),5);assert.match(el('jobPageInfo').textContent,/1–5/);
 click('nextJobPage');await settle();await vm.runInContext('refreshJobs()',context);assert.match(el('jobPageInfo').textContent,/6–10/);assert.equal(rows('jobHistory'),5,'Polling active jobs must not append or replace the history page');
 const waitingHistory=[];historyDelay=[fn=>waitingHistory.push(fn),fn=>waitingHistory.push(fn)];vm.runInContext('loadJobHistory(false,1);loadJobHistory(false,2)',context);await flush();waitingHistory[1]();await settle();waitingHistory[0]();await settle();assert.match(el('jobPageInfo').textContent,/11–15/,'Older job page must not replace a newer page');
 vm.runInContext("switchView('reports')",context);await settle();assert.equal(el('pieceTotal').textContent,'175');assert.equal(rows('events'),10);assert.equal(el('events').querySelector('img'),null,'Untrusted names must stay text');assert.equal(calls.at(-1).page_size,10);
 click('nextPage');await settle();assert.equal(rows('events'),10);assert.match(el('pageInfo').textContent,/11–20 of 25/);assert.equal(calls.at(-1).snapshot_row,26);
 change('reportPageSize','5');await settle();assert.equal(rows('events'),5);assert.match(el('pageInfo').textContent,/1–5/);assert.equal(calls.at(-1).page_size,5);
 const qr=context.qrcode(0,'M');qr.addData('QC:LOGGER:ESP32_3');qr.make();assert.ok(qr.getModuleCount()>20);assert.match(qr.createSvgTag(),/^<svg/);
 assert.equal(vm.runInContext("csvCell('=SUM(A1:A2)')",context),'"\'=SUM(A1:A2)"');assert.equal(vm.runInContext("qrId('QC:LOGGER:ESP32_3','LOGGER')",context),'ESP32_3');assert.throws(()=>vm.runInContext("qrId('QC:PART:P1','LOGGER')",context),/LOGGER QR/);
 const waiting=[];reportDelay=[fn=>waiting.push(fn),fn=>waiting.push(fn)];vm.runInContext('loadReport(true);loadReport(true)',context);await flush();assert.equal(waiting.length,2);report.pieces=9;waiting[1]();await settle();report.pieces=2;waiting[0]();await settle();assert.equal(el('pieceTotal').textContent,'9','Older response must not overwrite the latest report');
 vm.runInContext("showQr({id:'ESP32_3',type:'LOGGER',name:'<script>bad</script>',qr:'QC:LOGGER:ESP32_3'})",context);assert.equal(el('dialogContent').querySelector('script'),null);assert.ok(el('dialogContent').querySelector('svg'));
 // Optional operator is included by the job form, independently of the actor.
 actor={...viewer,role:'OWNER',name:'Owner'};await vm.runInContext('loadData()',context);vm.runInContext("switchView('jobs')",context);assert.equal(document.querySelector('[data-write-job]').hidden,false);assert.equal(el('jobOperator').hasAttribute('required'),false);
 el('jobLogger').value='ESP32_3';el('jobMachine').value='M1';el('jobPart').value='P1';el('jobOperator').value='Employee 24';el('jobForm').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();assert.equal(calls.findLast(c=>c.action==='START_JOB').machine_operator,'Employee 24');assert.equal(el('jobOperator').value,'');
 el('jobForm').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();assert.equal(calls.findLast(c=>c.action==='START_JOB').machine_operator,'','Blank operator must still submit a job');
 const changeover=document.querySelector('#activeJobs button');changeover.click();await settle();assert.equal(el('jobOperator').value,'Employee 17');assert.equal(el('jobAction').value,'PART_CHANGEOVER');
 // Original SVG stays an isolated image; names never become HTML nodes.
 vm.runInContext("switchView('settings')",context);const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M0 0H100V50H0Z" fill="#157e79"/></svg>';
 el('brandName').value='<img src=x onerror=alert(1)> Company';change('brandLogoType','SVG');el('brandSvgCode').value=svg;el('brandSvgCode').dispatchEvent(new window.Event('input',{bubbles:true}));assert.equal(el('brandPreviewName').querySelector('img'),null);assert.ok(el('brandPreviewLogo').getAttribute('src').startsWith('data:image/svg+xml;'));assert.equal(el('brandLogoUrl').disabled,true,'Hidden URL field must not block SVG/no-logo form validation');
 el('brandingForm').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();assert.equal(calls.findLast(c=>c.action==='BRANDING_UPDATE').logo,svg);assert.equal(el('companyName').textContent,'<img src=x onerror=alert(1)> Company');assert.equal(el('companyName').querySelector('img'),null);
 click('clearBrandLogo');assert.equal(el('brandLogoType').value,'NONE');assert.equal(el('brandPreviewLogo').hidden,true);assert.ok(el('brandPreviewName').textContent.includes('Company'));el('brandingForm').dispatchEvent(new window.Event('submit',{cancelable:true}));await settle();assert.equal(el('companyLogo').hidden,true);assert.ok(el('companyName').textContent.includes('Company'),'Removing a logo keeps the name');
 // QR selection sees every valid choice, independent of the current value.
 entities.push({id:'ESP32_4',type:'LOGGER',name:'Second Logger',enabled:true,qr:'QC:LOGGER:ESP32_4',revision:1});await vm.runInContext('refreshJobs()',context);
 el('jobLogger').value='ESP32_3';vm.runInContext("chooseEntity('jobLogger','LOGGER')",context);assert.equal(el('dialogContent').querySelectorAll('[role=option]').length,2);Array.from(el('dialogContent').querySelectorAll('button')).find(b=>b.textContent.includes('ESP32_4')).click();await settle();assert.equal(el('jobLogger').value,'ESP32_4');
 const requestsBeforeScan=calls.filter(c=>c.action==='START_JOB').length;vm.runInContext("openQrScanner('jobLogger','LOGGER')",context);
 assert.equal(vm.runInContext("useQrResult('QC:PART:P1')",context),false);assert.match(el('scanStatus').textContent,/logger label/);assert.equal(vm.runInContext("useQrResult('https://example.com')",context),false);assert.equal(vm.runInContext("useQrResult('QC:LOGGER:UNKNOWN')",context),false);assert.equal(vm.runInContext("useQrResult('QC:LOGGER:ESP32_3')",context),true);assert.equal(el('jobLogger').value,'ESP32_3');assert.equal(calls.filter(c=>c.action==='START_JOB').length,requestsBeforeScan,'Scanning must never start a job');
 // The external camera bridge accepts only the active popup, exact origin and random nonce.
 const popup={closed:false,close(){this.closed=true;},postMessage(){}};let popupUrl='';window.open=url=>{popupUrl=url;popup.closed=false;return popup;};context.popup=popup;
 vm.runInContext("openQrScanner('jobLogger','LOGGER');startQrCamera()",context);const opened=new URL(popupUrl),params=new URLSearchParams(opened.hash.slice(1));assert.equal(params.get('type'),'LOGGER');assert.match(params.get('nonce'),/^[a-f0-9]{32}$/);assert.equal(params.get('origin'),window.location.origin);assert.equal(opened.search,'','Session and API credentials must never appear in the camera URL');assert.equal(opened.origin,vm.runInContext('QC_CAMERA_ORIGIN',context));
 el('jobLogger').value='ESP32_4';const cameraEvent={origin:opened.origin,source:popup,data:{action:'QC_SCAN_RESULT',nonce:params.get('nonce'),payload:'QC:LOGGER:ESP32_3'}};
 context.cameraEvent={...cameraEvent,origin:'https://evil.example'};vm.runInContext('receiveQrCamera(cameraEvent)',context);assert.equal(el('jobLogger').value,'ESP32_4');
 context.cameraEvent={...cameraEvent,source:{}};vm.runInContext('receiveQrCamera(cameraEvent)',context);assert.equal(el('jobLogger').value,'ESP32_4');
 context.cameraEvent={...cameraEvent,data:{...cameraEvent.data,nonce:'b'.repeat(32)}};vm.runInContext('receiveQrCamera(cameraEvent)',context);assert.equal(el('jobLogger').value,'ESP32_4');
 context.cameraEvent={...cameraEvent,data:{...cameraEvent.data,payload:'QC:LOGGER:UNKNOWN'}};vm.runInContext('receiveQrCamera(cameraEvent)',context);assert.equal(el('jobLogger').value,'ESP32_4');
 entities.push({id:'DISABLED',type:'LOGGER',name:'Disabled',enabled:false});context.cameraEvent={...cameraEvent,data:{...cameraEvent.data,payload:'QC:LOGGER:DISABLED'}};vm.runInContext('receiveQrCamera(cameraEvent)',context);assert.equal(el('jobLogger').value,'ESP32_4');
 context.cameraEvent=cameraEvent;vm.runInContext('receiveQrCamera(cameraEvent)',context);assert.equal(el('jobLogger').value,'ESP32_3');assert.equal(popup.closed,true);assert.equal(calls.filter(c=>c.action==='START_JOB').length,requestsBeforeScan);
 vm.runInContext("openQrScanner('jobLogger','LOGGER');startQrCamera()",context);el('jobLogger').value='ESP32_4';vm.runInContext('receiveQrCamera(cameraEvent)',context);assert.equal(el('jobLogger').value,'ESP32_4','An old popup nonce must not select a field');vm.runInContext('closeQrScanner()',context);assert.equal(popup.closed,true);
 window.open=()=>null;vm.runInContext("openQrScanner('jobLogger','LOGGER');startQrCamera()",context);assert.match(el('scanStatus').textContent,/blocked the camera window/);el('scanCode').value='QC:LOGGER:ESP32_3';click('scanUseCode');assert.equal(el('jobLogger').value,'ESP32_3');
 console.log('PASS: external camera URL contains no credentials; source/origin/nonce/stale checks, registry/enabled checks, popup cleanup and paste fallback.');
 // Decode the actual bundled QR generator output, including an inverted image.
 const generated=context.qrcode(0,'M');generated.addData('QC:LOGGER:ESP32_3');generated.make();const size=(generated.getModuleCount()+8)*6,rgba=new Uint8ClampedArray(size*size*4).fill(255);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const row=Math.floor(y/6)-4,col=Math.floor(x/6)-4;if(row>=0&&col>=0&&row<generated.getModuleCount()&&col<generated.getModuleCount()&&generated.isDark(row,col)){const i=(y*size+x)*4;rgba[i]=rgba[i+1]=rgba[i+2]=0;}}
 assert.equal(context.scanPixels(rgba,size,size),'QC:LOGGER:ESP32_3');for(let i=0;i<rgba.length;i+=4)rgba[i]=rgba[i+1]=rgba[i+2]=255-rgba[i];assert.equal(context.scanPixels(rgba,size,size),'QC:LOGGER:ESP32_3');
 const week=vm.runInContext("presetDates('WEEK')",context);assert.equal(new Date(week.from+'T00:00:00Z').getUTCDay(),1);assert.ok(week.from<=week.to);assert.equal(vm.runInContext("presetDates('MONTH').from.slice(-2)",context),'01');
 vm.runInContext("switchView('dashboard')",context);await settle();assert.equal(rows('dashRecent'),10);change('dashGrouping','WEEK');assert.ok(el('dashTrend').textContent.includes('2026-10-05'));
 const waitDash=[];reportDelay=[fn=>waitDash.push(fn),fn=>waitDash.push(fn)];vm.runInContext('loadDashboard();loadDashboard()',context);await flush();report.pieces=47;waitDash[1]();await settle();report.pieces=3;waitDash[0]();await settle();assert.equal(el('dashPieces').textContent,'47','A stale dashboard response must be discarded');
 vm.runInContext("switchView('reports')",context);await settle();const pageBefore=el('pageInfo').textContent,eventsBefore=el('events').textContent;await vm.runInContext('refreshJobs()',context);assert.equal(el('pageInfo').textContent,pageBefore);assert.equal(el('events').textContent,eventsBefore);
 console.log('PASS: real QR image/inverted decoding, strict type/registry checks, choice reselection, scan without job writes, week/month presets, bounded dashboard rows, stale-response protection and stable report pages during live refresh.');
 // A pending page must not write data back after sign-out.
 const afterLogout=[];historyDelay=[fn=>afterLogout.push(fn)];vm.runInContext('loadJobHistory(false,0)',context);await flush();vm.runInContext('clearSession()',context);afterLogout[0]();await settle();assert.equal(store.has('qc_session'),false);assert.equal(el('appView').hidden,true);assert.equal(el('dialogContent').childNodes.length,0);
 console.log('PASS: 5/10-row rejection and job pages, totals, stable snapshots, last-page controls, no auto-append and stale-response handling.');
 console.log('PASS: optional machine operator form and changeover prefill; safe company name, original SVG image, branding save/removal and role controls.');
 console.log('PASS: client boot, lazy reports, safe text rendering, local QR, CSV escaping, typed QR checks and sign-out during pending work.');
})().catch(e=>{console.error(e);process.exitCode=1;});
