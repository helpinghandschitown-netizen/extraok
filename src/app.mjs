import {buildAuditSummary, createChangeRecord, formatCurrency, formatSchedule, recordDecision, validateDraft} from './core.mjs';
import {createDecisionReceipt, createIdentity, createReviewPackage, decodeEnvelope, encodeEnvelope, fingerprint, verifyDecisionReceipt, verifyReviewPackage} from './crypto.mjs';
import {activeCount, exportBackup, findRecord, importBackup, loadState, saveState, upsertRecord} from './store.mjs';
import {verifyLicenseCode} from './license.mjs';

const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const PURCHASE_URL = 'https://buy.stripe.com/5kQ3cvfgHexp4qR4kPdby00';
let state = loadState();
let installPrompt = null;

const h = value => String(value ?? '').replace(/[&<>'"]/gu, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const baseUrl = () => location.href.split('#')[0];
const isPro = () => Boolean(state.license?.product === 'extraok-pro-lifetime');
const route = () => {
  const raw = location.hash.slice(1) || 'home';
  const at = raw.indexOf('=');
  return at < 0 ? {name: raw, value: ''} : {name: raw.slice(0, at), value: raw.slice(at + 1)};
};

function toast(message) {
  toastEl.textContent = message; toastEl.classList.add('show');
  clearTimeout(toastEl._timer); toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(label); }
  catch { const area=document.createElement('textarea'); area.value=text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); toast(label); }
}

function download(name, content, type='application/json') {
  const link=document.createElement('a'); link.href=URL.createObjectURL(new Blob([content],{type})); link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

const statusLabel = status => status.replaceAll('_',' ');
const dateTime = value => new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(value));
function persist(next=state) { state=next; saveState(state); }
function setMain(html, className='shell') { app.className=className; app.innerHTML=html; app.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }

function headerBlock(title, text, action='') {
  return `<div class="section-heading"><div><span class="eyebrow">ExtraOK workspace</span><h2>${h(title)}</h2><p>${h(text)}</p></div>${action}</div>`;
}

function homeView() {
  const pending=state.records.filter(x=>x.record.status==='pending').length;
  const approved=state.records.filter(x=>x.record.status==='approved').length;
  const recovered=state.records.filter(x=>x.record.status==='approved').reduce((n,x)=>n+x.record.money.totalCents,0);
  setMain(`<section class="hero"><div><span class="eyebrow">Built for small contractors</span><h1>Get the extra work approved <em>before</em> you do it.</h1><p class="lede">Clear scope, price, and schedule changes in any modern browser. Your client needs no account, and project details never touch an ExtraOK server.</p><div class="hero-actions"><a class="button secondary" href="#new">Create an approval</a><a class="button ghost" href="#how">See how it works</a></div><div class="trust-row"><span>Works on iPhone, Android & desktop</span><span>Installable and offline-ready</span><span>No project-data server</span></div></div><aside class="hero-card" aria-label="Example approval"><span class="mini-label">Change #CO-104</span><h3>Repair hidden water damage</h3><p class="muted">Kitchen refresh · Jordan Lee</p><div class="impact-grid"><div><span class="mini-label">Total change</span><div class="money">$391.32</div></div><div><span class="mini-label">Schedule</span><div class="money">+1 day</div></div></div><span class="status">Approved</span></aside></section>
  <section class="section"><div class="stats"><div class="stat"><strong>${pending}</strong><span>awaiting a decision</span></div><div class="stat"><strong>${approved}</strong><span>approved records</span></div><div class="stat"><strong>${formatCurrency(recovered)}</strong><span>approved extra work</span></div></div>${headerBlock('Your approvals','Records are stored only in this browser. Export a backup before clearing browser data.','<a class="button" href="#new">New approval</a>')}<div class="records">${recordsMarkup()}</div></section>
  <section id="how" class="section"><div class="section-heading"><div><span class="eyebrow">Three clear steps</span><h2>No suite. No client login. No chasing.</h2></div></div><div class="feature-grid"><div class="feature"><b>1 · Describe the delta</b><p>Reference the original scope, explain what changed, and show the exact price and schedule impact.</p></div><div class="feature"><b>2 · Send a private review link</b><p>The signed review package lives in the link fragment. Static hosts and analytics never receive it.</p></div><div class="feature"><b>3 · Import the receipt</b><p>Your client returns a signed decision receipt. ExtraOK verifies it and freezes that issued version.</p></div></div></section>
  <section id="pricing" class="section">${pricingMarkup()}</section>
  <section id="security" class="section"><div class="panel"><span class="eyebrow">Zero-data architecture</span><h2>Your projects are not our product.</h2><p class="lede">ExtraOK has no application database, trackers, ads, cookies, third-party scripts, or account system. Review links use URL fragments, which browsers do not send in HTTP requests. Browser-generated signatures detect changes to issued packages.</p><div class="notice"><strong>Important:</strong> integrity is not identity. ExtraOK does not verify who typed a name and does not guarantee legal enforceability. Confirm jurisdiction-specific requirements before relying on electronic records.</div><a class="button ghost" href="privacy.html">Read the privacy policy</a></div></section>`);
  bindCommon();
}

function recordsMarkup() {
  if (!state.records.length) return `<div class="empty"><h3>No approvals yet</h3><p>Create one from a real scope change. You can test the complete contractor/client handoff without an account.</p><a class="button" href="#new">Create your first approval</a></div>`;
  return state.records.map(({record})=>`<article class="record-card"><div><span class="status ${h(record.status)}">${h(statusLabel(record.status))}</span><h3>${h(record.changeTitle)}</h3><p>${h(record.job)} · ${h(record.client)}</p><div class="money">${formatCurrency(record.money.totalCents)}</div></div><a class="button ghost" href="#record=${encodeURIComponent(record.id)}">Open record</a></article>`).join('');
}

function pricingMarkup() {
  return `<div class="section-heading"><div><span class="eyebrow">Simple ownership</span><h2>Start free. Buy the tool once.</h2><p>No auto-renewal, per-envelope fee, ads, or sale of project data.</p></div></div><div class="price-grid"><article class="price-card"><h3>Free</h3><div class="price">$0</div><ul><li>Up to 3 pending approvals</li><li>Private review links</li><li>Signed decision receipts</li><li>Print and JSON backup</li></ul><a class="button ghost" href="#new">Use free</a></article><article class="price-card featured"><h3>Pro Lifetime</h3><div class="price">$19 <small>one time</small></div><ul><li>Unlimited approval records</li><li>Lifetime access to this edition</li><li>Offline install</li><li>License recovery support</li></ul><a class="button secondary" href="${PURCHASE_URL}" target="_blank" rel="noopener">Buy Pro — $19</a><a class="button ghost compact" href="#license">Activate a license</a><p class="muted">Signed license delivery to your checkout email follows payment verification, normally within one business day.</p></article></div>`;
}

function bindCommon() {
  document.querySelectorAll('[data-copy]').forEach(el=>el.addEventListener('click',()=>copy(el.dataset.copy)));
  document.querySelectorAll('[data-download-backup]').forEach(el=>el.addEventListener('click',()=>download(`extraok-backup-${new Date().toISOString().slice(0,10)}.json`,exportBackup(state))));
}

function newView() {
  if (!isPro() && activeCount(state)>=3) {
    setMain(`${headerBlock('Free limit reached','Finalize or remove a pending approval, or activate Pro for unlimited records.')}<div class="panel">${pricingMarkup()}</div>`); return;
  }
  setMain(`${headerBlock('Create a change approval','Use plain facts your client can understand. ExtraOK does not generate legal clauses or prices for you.')}<form id="change-form" class="panel" novalidate><div class="form-grid">
    ${field('company','Your company','text',state.company,'Northstar Painting')}${field('client','Client name','text','','Jordan Lee')}${field('job','Job or project','text','','Kitchen refresh')}${field('originalScope','Original scope reference','textarea','','Prime and paint kitchen walls and ceiling.')}${field('changeTitle','Short change title','text','','Repair hidden water damage')}${field('changeDescription','What extra work is requested?','textarea','','Cut out the damaged section, patch, sand, prime, and repaint.')}${field('reason','Why is the change needed?','textarea','','Damage was hidden behind the refrigerator and was not visible during estimating.')}
    ${field('labor','Labor','number','0.00','275.00','step="0.01" min="0"')}${field('materials','Materials','number','0.00','86.50','step="0.01" min="0"')}${field('taxRate','Tax rate (%)','number','0','8.25','step="0.001" min="0" max="100"')}${field('scheduleDays','Schedule change (days)','number','0','1','step="1" min="-365" max="365"')}
  </div><div class="notice">Only issue facts you have reviewed. Taxability, required disclosures, cancellation rights, and electronic-signature rules vary by location and contract.</div><div class="button-row"><button class="button secondary" type="submit">Issue private review</button><a class="button ghost" href="#home">Cancel</a></div></form>`);
  const form=document.querySelector('#change-form');
  form.addEventListener('submit',async event=>{event.preventDefault(); clearErrors(form); const draft=Object.fromEntries(new FormData(form).entries()); const errors=validateDraft(draft); if(Object.keys(errors).length){showErrors(form,errors);return} try{const record=createChangeRecord(draft); if(!state.identity)state.identity=await createIdentity(); const reviewPackage=await createReviewPackage(record,state.identity); state.company=record.company; persist(upsertRecord(state,{record,reviewPackage})); location.hash=`issued=${encodeURIComponent(record.id)}`;}catch(error){toast(error.message)}});
}

function field(name,label,type,value,placeholder,extra='') {
  const full=['originalScope','changeDescription','reason'].includes(name)?' full':'';
  const control=type==='textarea'?`<textarea id="${name}" name="${name}" placeholder="${h(placeholder)}">${h(value)}</textarea>`:`<input id="${name}" name="${name}" type="${type}" value="${h(value)}" placeholder="${h(placeholder)}" ${extra}>`;
  return `<div class="field${full}"><label for="${name}">${h(label)}</label>${control}<span class="field-error" id="${name}-error"></span></div>`;
}
function clearErrors(form){form.querySelectorAll('.field-error').forEach(x=>x.textContent='');form.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'))}
function showErrors(form,errors){for(const [name,message] of Object.entries(errors)){const input=form.elements[name],spot=document.querySelector(`#${name}-error`);if(input){input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',`${name}-error`)}if(spot)spot.textContent=message}form.querySelector('[aria-invalid]')?.focus();toast('Please correct the highlighted fields.')}

async function issuedView(id) {
  const entry=findRecord(state,decodeURIComponent(id)); if(!entry){notFound();return}
  const link=`${baseUrl()}#review=${encodeEnvelope(entry.reviewPackage)}`;
  const fp=await fingerprint(entry.reviewPackage.issuerPublicKey);
  setMain(`${headerBlock('Review link ready','Send this link to the named client. Anyone with the link can read the change details.')}<div class="panel"><span class="status pending">Awaiting decision</span><h2>${h(entry.record.changeTitle)}</h2><p class="lede">${h(entry.record.client)} · ${h(entry.record.job)}</p><div class="impact-grid"><div><span class="mini-label">Total change</span><div class="money">${formatCurrency(entry.record.money.totalCents)}</div></div><div><span class="mini-label">Schedule</span><div class="money">${h(formatSchedule(entry.record.scheduleDays))}</div></div></div><label for="review-link"><strong>Private review link</strong></label><div id="review-link" class="receipt">${h(link)}</div><p class="muted">Issuer fingerprint: <span class="mono">${h(fp)}</span>. The project data is in the URL fragment; do not post this link publicly.</p><div class="button-row"><button class="button secondary" id="copy-review">Copy review link</button><a class="button ghost" href="${h(link)}" target="_blank" rel="noopener">Open client view</a><button class="button ghost" id="download-backup">Export backup</button></div></div>`);
  document.querySelector('#copy-review').addEventListener('click',()=>copy(link,'Review link copied'));
  document.querySelector('#download-backup').addEventListener('click',()=>download(`extraok-${entry.record.id}.json`,exportBackup(state)));
}

async function reviewView(encoded) {
  let pkg; try{pkg=decodeEnvelope(encoded)}catch(error){invalidPackage(error.message);return}
  const valid=await verifyReviewPackage(pkg); if(!valid){invalidPackage('This review package has been changed or is incomplete.');return}
  const r=pkg.record, fp=await fingerprint(pkg.issuerPublicKey);
  setMain(`<section class="review-shell"><article class="review-sheet"><div class="integrity"><div><span class="mini-label">ExtraOK client review</span><h3>${h(r.company)}</h3></div><span class="integrity-ok">✓ Issued package verified</span></div><h1>${h(r.changeTitle)}</h1><p class="lede">Review the exact scope, price, and schedule impact before deciding.</p><dl class="detail-list"><dt>Client</dt><dd>${h(r.client)}</dd><dt>Job</dt><dd>${h(r.job)}</dd><dt>Original scope</dt><dd>${h(r.originalScope)}</dd><dt>Requested change</dt><dd>${h(r.changeDescription)}</dd><dt>Reason</dt><dd>${h(r.reason)}</dd><dt>Labor</dt><dd>${formatCurrency(r.money.laborCents)}</dd><dt>Materials</dt><dd>${formatCurrency(r.money.materialsCents)}</dd><dt>Tax</dt><dd>${formatCurrency(r.money.taxCents)} (${h(r.taxRate)}%)</dd><dt><strong>Total change</strong></dt><dd class="money">${formatCurrency(r.money.totalCents)}</dd><dt>Schedule impact</dt><dd>${h(formatSchedule(r.scheduleDays))}</dd></dl><p class="muted">Issuer fingerprint <span class="mono">${h(fp)}</span> · Issued ${h(dateTime(r.issuedAt))}</p><form id="decision-form" class="decision-box" novalidate><h2>Your decision</h2><div class="choice-row"><div class="choice"><input id="approve" name="status" value="approved" type="radio" required><label for="approve">Approve</label></div><div class="choice"><input id="revise" name="status" value="revision_requested" type="radio"><label for="revise">Request revision</label></div><div class="choice"><input id="decline" name="status" value="declined" type="radio"><label for="decline">Decline</label></div></div><div class="field" style="margin-top:16px"><label for="actor">Your full name</label><input id="actor" name="actor" autocomplete="name" value="${h(r.client)}"></div><div class="field" style="margin-top:16px"><label for="note">Note (optional)</label><textarea id="note" name="note" placeholder="Explain a requested revision or add a short record note."></textarea></div><label class="consent"><input name="consent" type="checkbox"><span>I reviewed this issued change and intend to submit the decision selected above. I understand ExtraOK does not verify my identity or provide legal advice.</span></label><button class="button secondary" type="submit">Create decision receipt</button></form></article></section>`,'');
  document.querySelector('#decision-form').addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(event.currentTarget);try{const receipt=await createDecisionReceipt(pkg,{status:data.get('status'),actor:data.get('actor'),note:data.get('note'),consent:data.get('consent')==='on'});location.hash=`decision=${encodeEnvelope(receipt)}`}catch(error){toast(error.message)}});
}

async function decisionView(encoded) {
  let receipt; try{receipt=decodeEnvelope(encoded)}catch(error){invalidPackage(error.message);return}
  if(!await verifyDecisionReceipt(receipt)){invalidPackage('This decision receipt did not pass its integrity checks.');return}
  const link=`${baseUrl()}#receipt=${encodeEnvelope(receipt)}`, d=receipt.decision, r=receipt.reviewPackage.record;
  setMain(`<section class="review-shell"><article class="review-sheet"><span class="integrity-ok">✓ Decision receipt created</span><h1>${h(statusLabel(d.status))}</h1><p class="lede">Return the receipt link to ${h(r.company)}. The contractor imports it to close this issued version.</p><dl class="detail-list"><dt>Change</dt><dd>${h(r.changeTitle)}</dd><dt>Total</dt><dd>${formatCurrency(r.money.totalCents)}</dd><dt>Decision by</dt><dd>${h(d.actor)}</dd><dt>Time</dt><dd>${h(dateTime(d.decidedAt))}</dd><dt>Note</dt><dd>${h(d.note||'No note provided')}</dd></dl><div class="receipt">${h(link)}</div><div class="button-row"><button id="copy-receipt" class="button secondary">Copy receipt link</button><button id="download-receipt" class="button ghost">Download receipt</button><button id="print-receipt" class="button ghost">Print</button></div><div class="notice">Keep this receipt private. It contains the change details and your decision.</div></article></section>`,'');
  document.querySelector('#copy-receipt').addEventListener('click',()=>copy(link,'Receipt link copied'));
  document.querySelector('#download-receipt').addEventListener('click',()=>download(`extraok-receipt-${r.id}.json`,JSON.stringify(receipt,null,2)));
  document.querySelector('#print-receipt').addEventListener('click',()=>window.print());
}

function importView(prefill='') {
  setMain(`${headerBlock('Import a client receipt','Paste the returned receipt link or upload its JSON file. ExtraOK verifies both issued package and decision signatures.')}<div class="panel"><form id="import-form"><div class="field"><label for="receipt-input">Receipt link or encoded receipt</label><textarea id="receipt-input" name="receipt" placeholder="https://…#receipt=…">${h(prefill)}</textarea></div><div class="button-row"><button class="button secondary" type="submit">Verify and import</button><label class="button ghost" for="receipt-file">Choose JSON file</label><input id="receipt-file" type="file" accept="application/json" hidden></div></form><div id="import-result"></div></div>`);
  document.querySelector('#import-form').addEventListener('submit',event=>{event.preventDefault();importReceiptText(new FormData(event.currentTarget).get('receipt'))});
  document.querySelector('#receipt-file').addEventListener('change',async event=>{const file=event.target.files[0];if(file)importReceiptText(await file.text())});
}

async function importReceiptText(text) {
  try {
    let receipt; const raw=String(text||'').trim();
    if(raw.startsWith('{'))receipt=JSON.parse(raw); else {const match=raw.match(/(?:#receipt=)?([A-Za-z0-9_-]+)$/u);if(!match)throw new Error('No receipt payload found.');receipt=decodeEnvelope(match[1])}
    if(!await verifyDecisionReceipt(receipt))throw new Error('Receipt integrity verification failed.');
    const original=receipt.reviewPackage.record, entry=findRecord(state,original.id);
    if(!entry)throw new Error('This browser does not contain the matching issued record. Import a backup first.');
    if(entry.record.status!=='pending')throw new Error('This issued version already has a final decision.');
    if(entry.reviewPackage.signature!==receipt.reviewPackage.signature)throw new Error('The receipt belongs to a different issued version.');
    const finalized=recordDecision(entry.record,{...receipt.decision,now:receipt.decision.decidedAt});
    persist(upsertRecord(state,{...entry,record:finalized,receipt}));
    location.hash=`record=${encodeURIComponent(finalized.id)}`;
  } catch(error){document.querySelector('#import-result').innerHTML=`<div class="notice danger"><strong>Could not import:</strong> ${h(error.message)}</div>`}
}

async function receiptView(encoded){importView(encoded);await importReceiptText(encoded)}

function recordView(id) {
  const entry=findRecord(state,decodeURIComponent(id));if(!entry){notFound();return}const r=entry.record;
  setMain(`${headerBlock(r.changeTitle,`${r.client} · ${r.job}`,'<a class="button ghost" href="#home">Back</a>')}<article class="panel"><span class="status ${h(r.status)}">${h(statusLabel(r.status))}</span><dl class="detail-list"><dt>Original scope</dt><dd>${h(r.originalScope)}</dd><dt>Requested change</dt><dd>${h(r.changeDescription)}</dd><dt>Reason</dt><dd>${h(r.reason)}</dd><dt>Total</dt><dd class="money">${formatCurrency(r.money.totalCents)}</dd><dt>Schedule</dt><dd>${h(formatSchedule(r.scheduleDays))}</dd><dt>Issued</dt><dd>${h(dateTime(r.issuedAt))}</dd><dt>Decision by</dt><dd>${h(r.decidedBy||'Pending')}</dd><dt>Decision time</dt><dd>${r.decidedAt?h(dateTime(r.decidedAt)):'Pending'}</dd><dt>Note</dt><dd>${h(r.decisionNote||'No note provided')}</dd></dl><div class="button-row"><button id="print-record" class="button">Print record</button>${r.status==='pending'?`<a class="button secondary" href="#issued=${encodeURIComponent(r.id)}">Open review link</a>`:''}<button id="download-summary" class="button ghost">Download text summary</button></div><pre class="receipt">${h(buildAuditSummary(r))}</pre></article>`);
  document.querySelector('#print-record').addEventListener('click',()=>window.print());
  document.querySelector('#download-summary').addEventListener('click',()=>download(`extraok-${r.id}.txt`,buildAuditSummary(r),'text/plain'));
}

function pricingView(){setMain(`${headerBlock('Pricing','Own the tool instead of renting another construction suite.')}<section>${pricingMarkup()}</section>`)}
function securityView(){location.hash='home';setTimeout(()=>document.querySelector('#security')?.scrollIntoView(),0)}

function licenseView() {
  setMain(`${headerBlock('Activate Pro','Paste the signed license code delivered to your checkout email after payment verification. Activation is checked locally.')}<div class="panel"><form id="license-form"><div class="field"><label for="license-code">License code</label><textarea id="license-code" name="code" autocomplete="off" spellcheck="false"></textarea></div><div class="button-row"><button class="button secondary" type="submit">Activate</button><a class="button ghost" href="${PURCHASE_URL}" target="_blank" rel="noopener">Buy Pro — $19</a></div></form><div id="license-result"></div></div>`);
  document.querySelector('#license-form').addEventListener('submit',async event=>{event.preventDefault();const code=new FormData(event.currentTarget).get('code');const license=await verifyLicenseCode(code);if(!license){document.querySelector('#license-result').innerHTML='<div class="notice danger">This license code is invalid.</div>';return}state.licenseCode=String(code).trim();state.license=license;persist();document.querySelector('#license-result').innerHTML=`<div class="notice"><strong>Pro activated.</strong> Licensed to ${h(license.customer)}.</div>`});
}

function invalidPackage(message){setMain(`<div class="review-sheet"><span class="integrity-bad">Integrity check failed</span><h1>Do not rely on this link.</h1><p class="lede">${h(message)}</p><p>Ask the contractor to issue a new ExtraOK review link through a trusted channel.</p></div>`,'review-shell')}
function notFound(){setMain(`<div class="empty"><h2>Record not found</h2><p>This browser does not have that local record.</p><a class="button" href="#home">Return home</a></div>`)}

async function render() {
  const r=route();
  try {
    if(r.name==='review')return await reviewView(r.value);
    if(r.name==='decision')return await decisionView(r.value);
    if(r.name==='receipt')return await receiptView(r.value);
    if(r.name==='new')return newView();
    if(r.name==='issued')return await issuedView(r.value);
    if(r.name==='record')return recordView(r.value);
    if(r.name==='import')return importView();
    if(r.name==='pricing')return pricingView();
    if(r.name==='license')return licenseView();
    if(r.name==='security')return securityView();
    return homeView();
  } catch(error){setMain(`<div class="notice danger"><strong>ExtraOK could not open this view.</strong><p>${h(error.message)}</p><a class="button" href="#home">Return home</a></div>`)}
}

window.addEventListener('hashchange',render);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;document.querySelector('#install-app').hidden=false});
document.querySelector('#install-app').addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.querySelector('#install-app').hidden=true});
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(state.licenseCode){state.license=await verifyLicenseCode(state.licenseCode);persist()}
render();
