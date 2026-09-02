import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const port=9337;
const profile=path.resolve('.qa/chrome-profile');
const baseUrl=(process.env.EXTRAOK_BASE_URL||'http://127.0.0.1:4177/').replace(/\/?$/u,'/');
fs.rmSync(profile,{recursive:true,force:true});
fs.mkdirSync(profile,{recursive:true});
const proc=spawn(chrome,[`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--headless=new','--disable-gpu','--no-first-run','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function endpoint(){for(let i=0;i<50;i++){try{const data=await fetch(`http://127.0.0.1:${port}/json/version`).then(r=>r.json());if(data.webSocketDebuggerUrl)return data.webSocketDebuggerUrl}catch{}await pause(100)}throw new Error('Chrome CDP did not start')}
let id=0;const pending=new Map();
try{
  const ws=new WebSocket(await endpoint());
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result)}};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const call={id:++id,method,params};if(sessionId)call.sessionId=sessionId;pending.set(call.id,{resolve,reject});ws.send(JSON.stringify(call))});
  const {targetId}=await send('Target.createTarget',{url:`${baseUrl}#home`});
  const attached=await send('Target.attachToTarget',{targetId,flatten:true});const sid=attached.sessionId;
  await send('Page.enable',{},sid);await send('Runtime.enable',{},sid);await pause(700);
  const evalJs=async expression=>(await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sid)).result.value;
  const openFresh=async url=>{await send('Page.navigate',{url:'about:blank'},sid);await pause(150);await send('Page.navigate',{url},sid);await pause(500)};
  const waitFor=async(expression,label)=>{for(let i=0;i<150;i++){if(await evalJs(expression))return;await pause(100)}const diag=await evalJs(`({url:location.href,title:document.title,text:document.body?.innerText?.slice(0,500)})`);throw new Error(`Timed out: ${label} ${JSON.stringify(diag)}`)};
  await waitFor(`document.querySelector('h1')?.textContent.includes('extra work approved')`,'home');
  const home=await evalJs(`({title:document.title,h1:document.querySelector('h1').textContent,external:[...performance.getEntriesByType('resource')].map(x=>new URL(x.name).origin).filter(x=>x!==location.origin),missingLabels:[...document.querySelectorAll('input,textarea,select')].filter(x=>!x.labels?.length).length,emptyButtons:[...document.querySelectorAll('button,a.button')].filter(x=>!x.textContent.trim()).length,service:[...document.querySelectorAll('.price-card')].find(x=>x.textContent.includes('Done-for-you setup'))?.querySelector('a')?.href})`);
  if(home.external.length||home.missingLabels||home.emptyButtons||!home.service?.startsWith('mailto:helpinghandschitown@gmail.com?subject='))throw new Error(`Home QA failed: ${JSON.stringify(home)}`);
  await evalJs(`location.hash='new'`);await waitFor(`document.querySelector('#change-form')`,'create form');
  const fill={company:'Northstar Painting',client:'Jordan Lee',job:'Kitchen refresh',originalScope:'Prime and paint walls and ceiling.',changeTitle:'Repair hidden water damage',changeDescription:'Cut out damaged drywall, patch, sand, prime, and repaint.',reason:'Damage was hidden behind the refrigerator.',labor:'275.00',materials:'86.50',taxRate:'8.25',scheduleDays:'1'};
  await evalJs(`(()=>{const v=${JSON.stringify(fill)};for(const [k,val] of Object.entries(v)){const e=document.querySelector('[name="'+k+'"]');e.value=val;e.dispatchEvent(new Event('input',{bubbles:true}))}document.querySelector('#change-form').requestSubmit();return true})()`);
  await waitFor(`location.hash.startsWith('#issued=')`,'issued view');await waitFor(`document.querySelector('#review-link')?.textContent.includes('#review=')`,'review link');
  const reviewLink=await evalJs(`document.querySelector('#review-link').textContent.trim()`);
  await openFresh(reviewLink);await waitFor(`document.querySelector('#decision-form')`,'client review');
  const integrity=await evalJs(`document.querySelector('.integrity-ok')?.textContent`);if(!integrity?.includes('verified'))throw new Error('Review integrity badge missing');
  await evalJs(`(()=>{document.querySelector('#approve').checked=true;document.querySelector('[name="consent"]').checked=true;document.querySelector('#decision-form').requestSubmit();return true})()`);
  await waitFor(`location.hash.startsWith('#decision=')`,'decision receipt');await waitFor(`document.querySelector('#copy-receipt')`,'receipt view');
  const receiptLink=await evalJs(`document.querySelector('.receipt').textContent.trim()`);
  await openFresh(receiptLink);await waitFor(`location.hash.startsWith('#record=')`,'imported record');await waitFor(`document.querySelector('.status.approved')`,'approved status');
  const final=await evalJs(`({status:document.querySelector('.status').textContent.trim(),money:document.querySelector('.money').textContent.trim(),summary:document.querySelector('pre').textContent,records:JSON.parse(localStorage.getItem('extraok.state.v1')).records.length,external:[...performance.getEntriesByType('resource')].map(x=>new URL(x.name).origin).filter(x=>x!==location.origin)})`);
  if(final.status!=='approved'||final.money!=='$391.32'||final.records!==1||!final.summary.includes('EXTRAOK CHANGE SUMMARY')||final.external.length)throw new Error(`Final QA failed: ${JSON.stringify(final)}`);
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true},sid);fs.mkdirSync('.qa',{recursive:true});fs.writeFileSync('.qa/extraok-approved.png',Buffer.from(shot.data,'base64'));
  const pdf=await send('Page.printToPDF',{printBackground:true},sid);fs.writeFileSync('.qa/extraok-approved.pdf',Buffer.from(pdf.data,'base64'));
  console.log(JSON.stringify({passed:true,home,reviewIntegrity:integrity,final:{status:final.status,money:final.money,records:final.records,summaryHeader:final.summary.split('\n')[0]},artifacts:['.qa/extraok-approved.png','.qa/extraok-approved.pdf']},null,2));
  ws.close();
} finally {proc.kill();}
