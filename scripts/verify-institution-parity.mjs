import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const output=path.resolve('.codex/parity-tests');fs.mkdirSync(output,{recursive:true});
const browser=process.env.BROWSER_BIN||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const root=path.resolve('dist');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
 const target=file===root||fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
 if(!fs.existsSync(target)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(target)]||'application/octet-stream');res.end(fs.readFileSync(target));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const profile=fs.mkdtempSync(path.join(output,'browser-'));
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;const errors=[];const checks=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try {
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(portFile);i++)await delay(100);
 assert(fs.existsSync(portFile),'Browser debugging connection started');
 const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
 const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 socket=new WebSocket(targets.find(target=>target.type==='page').webSocketDebuggerUrl);
 await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 let serial=0;const waiting=new Map();
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=waiting.get(data.id);waiting.delete(data.id);if(data.error)entry.reject(Error(data.error.message));else entry.resolve(data.result);}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const until=async(expression,label)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(100);}throw Error(`Timed out: ${label}\n${await evaluate('document.body.innerText')}`);};
 const text=async(value)=>until(`document.body.innerText.includes(${JSON.stringify(value)})`,value);
 const click=async(label)=>{await until(`[...document.querySelectorAll('button,summary')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,label);await evaluate(`[...document.querySelectorAll('button,summary')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled).click()`);await delay(150);};
 const fill=async(selector,value)=>{await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing input '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
 const visit=async(route,label)=>{await evaluate(`location.hash=${JSON.stringify('#'+route)}`);await text(label);};
 const check=(name)=>{checks.push(name);console.log('PASS '+name);};
 await call('Runtime.enable');await call('Page.enable');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(${fixtures.toString()})()`});
 await call('Page.navigate',{url:origin+'/#/attendance'});await text('Mark filtered present');
 await click('Mark filtered present');await click('Save attendance');await until(`window.requests.some(r=>r.endpoint==='/institution/staff-attendance'&&r.method==='POST'&&r.body.records.length===2)`,'attendance writes');check('staff attendance marks all staff and queues offline writes');
 await visit('/campuses','Campus workspaces');await fill('input[name=name]','North Campus');await fill('input[name=address]','12 Campus Road');await fill('input[name=loginEmail]','north@example.test');await click('Create campus login');await text('Campus login created');
 assert(await evaluate(`window.requests.some(r=>r.endpoint==='/institution/campuses'&&r.body.address==='12 Campus Road'&&r.body.loginEmail==='north@example.test')`));check('campus creation sends current address/login contract and displays credentials');
 await visit('/settings','Payment accounts');
 assert(await evaluate(`!window.requests.some(r=>r.endpoint==='/institution/restore-requests')`));
 await click('Payment accounts');await text('Your payment accounts');await click('Add gateway');await text('Payment gateway name');await fill('input[name=providerName]','Test Bank');await fill('input[name=accountTitle]','Test School');await fill('input[name=accountNumber]','PK123456');
 await evaluate(`document.querySelector('input[name=providerName]').closest('form').requestSubmit()`);await until(`window.requests.some(r=>r.endpoint==='/institution/settings/payment-accounts'&&r.method==='POST')`,'account save');
 await click('Restore requests');await text('Submit restore request');check('settings loads payment accounts and restore workflow on expansion');
 await visit('/fees?section=billing','Monthly challans');await text('One-time');await fill('input[name=dueDate]','2026-10-25');await click('Preview billing');await click('Generate previewed challans');assert(await evaluate(`window.requests.some(r=>r.body?.action==='generateMonth'&&r.body.expectedPreviewHash==='a'.repeat(64))`));check('billing previews and issues with the preview hash; one-time billing is available');
 await visit('/fees?section=collections','Collection');await text('Page 1 of 2');check('challan pagination is available');
 await visit('/admissions?section=status','Archived cycles');await click('Archived cycles');await text('Archived admission cycles');check('admission archives and campus intake controls render');
 await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
 await visit('/admissions?section=offline','Walk-in');check('walk-in admissions remain available');
 await visit('/public-events','Event studio');await click('Blank event');await text('Event title');await text('Publish to site');await fill('input[placeholder="Annual science fair"]','Science fair');await click('Save');await text('Event saved successfully.');assert(await evaluate(`window.requests.some(r=>r.endpoint==='/institution/public-events'&&r.body?.action==='SAVE_DRAFT'&&r.body.slug==='science-fair'&&Array.isArray(r.body.blocks))`));await click('Publish to site');await text('Event published.');check('event designer saves structured drafts and publishes through current API contract');
 await evaluate(`window.onbeforeunload=null; location.hash='#/settings/public-website'`);
 // The event editor warns on unload but route changes unmount it normally.
 await text('Design & layout');await click('Preview website');await until(`document.querySelector('iframe[title="Institution website preview"]')?.contentDocument?.body.innerText.includes('Test School')`,'website preview content');check('website designer and responsive preview render locally');
 await visit('/staff/7/performance','Teacher One');await text('Mathematics');check('individual teacher performance renders');
 await visit('/promotion/4','Annual results');await text('Download CSV');await text('80.00%');check('promotion review totals and CSV/print controls render');
 await visit('/academics','Academics setup');assert(await evaluate(`document.querySelectorAll('button[aria-label^="Delete "]').length===3`));check('subject/class/section deletion controls exist');
 await evaluate(`document.querySelector('button[aria-label="Notifications"]').click()`);await text('Mark all read');const inboxReads=await evaluate(`window.requests.filter(r=>r.endpoint==='/me/notifications'&&r.method==='GET').length`);await click('Mark all read');assert.equal(await evaluate(`window.requests.filter(r=>r.endpoint==='/me/notifications'&&r.method==='GET').length`),inboxReads,'marking read does not refetch the inbox');assert(await evaluate(`window.requests.some(r=>r.endpoint==='/me/notifications/read-all'&&r.method==='PATCH')`));check('notification inbox marks all read');
 await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
 // Exercise the actual transport guard, not a disabled button alone.
 await evaluate(`sessionStorage.setItem('campus_view','signed-view-token');sessionStorage.setItem('campus_name','North');window.requests=[];`);
 await visit('/settings','Payment accounts');await click('Payment accounts');await text('Your payment accounts');await click('Add gateway');await text('Payment gateway name');await fill('input[name=providerName]','Read Only Bank');await fill('input[name=accountTitle]','Account');await fill('input[name=accountNumber]','123456');await evaluate(`document.querySelector('input[name=providerName]').closest('form').requestSubmit()`);await text('This campus is read-only');
 assert(!(await evaluate(`window.requests.some(r=>r.endpoint==='/institution/settings/payment-accounts'&&r.method==='POST')`)));check('cross-campus mutations blocked before IPC');
 await evaluate(`sessionStorage.removeItem('campus_view');sessionStorage.removeItem('campus_name');localStorage.setItem('password_change_required','1');window.dispatchEvent(new Event('auth-changed'));`);await text('Replace your temporary password');
 await fill('input[name=currentPassword]','temporary');await fill('input[name=newPassword]','replacement123');await fill('input[name=confirmPassword]','replacement123');await click('Update password and sign in again');await until(`window.requests.some(r=>r.endpoint==='/auth/change-password')`,'password change');check('required password change sends authenticated update and clears local session');
 assert.equal(errors.length,0,JSON.stringify(errors));
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate(`localStorage.setItem('nisaab_token','fixture-token');window.dispatchEvent(new Event('auth-changed'));`);await delay(500);await visit('/fees?section=billing','Monthly challans');
 await until(`!document.querySelector('#sync-loop')`,'startup overlay closes');await delay(300);
 const shot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'billing-desktop.png'),Buffer.from(shot.data,'base64'));
 fs.writeFileSync(path.join(output,'requests.json'),JSON.stringify(await evaluate('window.requests'),null,2));
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,errors},null,2));
 console.log(`${checks.length} browser checks passed.`);
} catch(error) { console.error(JSON.stringify(errors,null,2)); throw error; } finally {socket?.close();child.kill();server.close();}

function fixtures(){
 localStorage.setItem('nisaab_token','fixture-token');localStorage.setItem('nisaab_refresh_token','fixture-refresh');localStorage.setItem('nisaab_onboarded','1');localStorage.removeItem('password_change_required');
 window.requests=[];
 const staff=[{id:7,name:'Teacher One',email:'teacher@example.test'},{id:8,name:'Teacher Two'}];
 const classes=[{id:1,name:'Class 1',level:1,isFinalClass:false}];
 const heads=[{id:1,name:'Tuition',kind:'RECURRING',isActive:true},{id:2,name:'Trip',kind:'ONE_TIME',isActive:true}];
 const workspace={institutionId:1,homeInstitutionId:1,campusId:1,campusName:'Main',role:'INSTITUTION',readOnly:false,isMainCampus:true,registrationNumber:'TEST',needsOwner:false,canManageCampuses:true,plan:{id:'STANDARD',name:'Standard',campusLimit:3,campusDetail:'Three campuses'},campuses:[{id:1,name:'Main',workspaceId:1,workspaceName:'Main',loginEmail:'main@example.test',address:'Main Road'}]};
 const batch={id:4,title:'Annual results',className:'Class 1',sectionName:'A',subjectCount:1,allSubjectsPublished:true};
 const site={institution:{name:'Test School',type:'SCHOOL',city:'Lahore',country:'Pakistan',logoKey:'',publicSlug:'test',publicSiteEnabled:true,admissionsEnabled:true},profile:{theme:'default',tagline:'Learning together',statistics:[],programs:[],highlights:[],galleryImages:[]},publicUrl:'https://test.example.test',qrUrl:'https://test.example.test'};
 async function request(method,endpoint,body){
  const url=new URL(endpoint,'http://fixture.test');const pathname=url.pathname.replace(/^\/api/,'');window.requests.push({method,endpoint:pathname,query:url.search,body});
  if(method!=='GET'){
   if(pathname.startsWith('/institution/public-events'))return {event:{id:9,...body,status:body.action==='PUBLISH'?'PUBLISHED':'DRAFT',createdAt:'2026-10-13T10:00:00Z',expiresAt:null}};
   if(pathname==='/institution/campuses')return {loginEmail:body.loginEmail,defaultPassword:'1234567890'};
   if(pathname==='/institution/campus-view')return {success:true,readOnly:!body.returnHome,campusViewToken:'signed-view-token',campusName:'North'};
   if(pathname==='/institution/fees'&&body.action==='previewMonth')return {previewHash:'a'.repeat(64),eligible:1,alreadyBilled:0,ready:1,zeroTotal:0,totalAmount:1500,missingStudents:0,missingAmounts:[]};
   return {success:true,queued:pathname==='/institution/staff-attendance',created:1,account:{id:'new',...body}};
  }
  if(pathname==='/institution/workspace')return workspace;
  if(pathname==='/institution/campuses')return {campuses:workspace.campuses};
  if(pathname==='/institution/staff')return {staff};
  if(pathname==='/institution/staff-attendance')return {records:[]};
  if(pathname==='/institution/settings')return {profile:{name:'Test School',type:'SCHOOL',registrationNumber:'TEST'}};
  if(pathname==='/institution/settings/grading')return {scale:null};
  if(pathname==='/institution/settings/payment-accounts')return {accounts:[]};
  if(pathname==='/institution/settings/google-drive')return {connected:false,passwordConfigured:false};
  if(pathname==='/course-streaming')return {configured:false};
  if(pathname==='/institution/restore-requests')return {items:[]};
  if(pathname==='/institution/roles')return {roles:[]};
  if(pathname==='/institution/fees')return {classes,heads,classItems:[{id:1,classId:1,feeHeadId:1,amount:1500}],invoices:[],submissions:[],pagination:{page:1,pageSize:50,total:51,pages:2},summary:{invoiceCount:0,billed:0,collected:0,outstanding:0,defaulters:0}};
  if(pathname==='/institution/admissions/attention-count')return {count:0};
  if(pathname==='/institution/admissions/campuses')return {campus:{id:1,name:'Main'},cycles:[{id:1,name:'2026 intake',academicYear:'2026',isOpen:true,cycleAccepting:true}]};
  if(pathname==='/institution/admissions')return {cycles:[],offerings:[],total:0};
  if(pathname==='/institution/admissions/applications')return {applications:[],pagination:{page:1,pageSize:30,total:0,pages:1},counts:{},options:{cycles:[],offerings:[],campuses:[],classes,sections:[]}};
  if(pathname==='/institution/public-site')return site;
  if(pathname==='/institution/public-events')return {events:[]};
  if(pathname==='/institution/staff/7/performance')return {teacher:staff[0],assignments:[{}],allPoints:[{}],overallAverage:80,performanceGroups:[{key:'1',className:'Class 1',sectionName:'A',subjectName:'Mathematics',average:80,points:[{id:1,title:'Daily quiz',type:'DAILY',label:'Oct 1',average:80,students:1}]}]};
  if(pathname==='/institution/students/auto-promote')return url.searchParams.has('batchExamId')?{rows:[{studentId:1,student:'Student One',roll:'1',subject:'Mathematics',marks:80,maxMarks:100,isPublished:true}]}:{batches:[batch]};
  if(pathname==='/institution/academics')return {subjects:[{id:1,name:'Mathematics',code:'MATH'}],classes,sections:[{id:1,classId:1,name:'A',classTeacherName:'Teacher One'}]};
  if(pathname==='/me/notifications')return {notifications:[{id:1,title:'Welcome',message:'Institution ready',isRead:false,createdAt:'2026-10-13T10:00:00Z'}],unreadCount:1};
  if(pathname==='/institution/students/picker')return {students:[]};
  if(pathname==='/institution/timetable')return {allClasses:classes,allSections:[],entries:[]};
  return {};
 }
 window.electronAPI={isElectron:true,config:{apiOrigin:'http://fixture.test',apiBaseUrl:'http://fixture.test/api'},app:{startupState:async()=>({}),checkUpdate:async()=>({updateAvailable:false})},auth:{setToken:async()=>({success:true}),clearToken:async()=>({success:true})},sync:{initial:async()=>({success:true}),pull:async()=>({success:true}),status:async()=>({online:true,pendingCount:0,tableStates:[]})},data:{request,live:async({endpoint,method,body})=>({status:200,headers:{'content-type':'application/json'},bytes:new TextEncoder().encode(JSON.stringify(await request(method,endpoint,body?JSON.parse(body):undefined)))})}};
}
