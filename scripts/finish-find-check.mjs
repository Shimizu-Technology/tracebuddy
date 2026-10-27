import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { browserLifecycle } from './browser-lifecycle.mjs'
import { chromium, webkit } from 'playwright'
const engine = process.env.CHECK_ENGINE || 'chromium'
const output = process.env.CHECK_EVIDENCE
const url = process.env.CHECK_URL || 'http://127.0.0.1:4173'
const type = {chromium,webkit}[engine]
const server = await type.launchServer({ headless:true, ...(engine === 'chromium' && process.env.CHECK_CHROME ? {executablePath:process.env.CHECK_CHROME}: {}) })
const pid = server.process().pid
const life = (action) => { browserLifecycle(action, pid) }
life('claim')
const b = await type.connect(server.wsEndpoint())
const rows=[],errors=[]
if(output) mkdirSync(output,{recursive:true})
const pause = (ms=150)=>new Promise(r=>setTimeout(r,ms))
async function press(p,name,scope=p) { await scope.getByRole('button',{name,exact:true}).filter({visible:true}).first().click(); await pause() }
async function nav(p,name) { if(await p.locator('.nav-toggle').isVisible()) await press(p,'Menu'); await press(p,name,p.locator('#main-nav')); }
async function draw(p,settle=700) { await p.locator('.practice-document').waitFor();const r=await p.locator('.practice-document').boundingBox();await p.mouse.move(r.x+r.width*.3,r.y+r.height*.4);await p.mouse.down();await p.mouse.move(r.x+r.width*.7,r.y+r.height*.5,{steps:6});await p.mouse.up();await pause(settle) }
async function saved(p) { return p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('tracebuddy.previousWork.v1.session.')).map(k=>JSON.parse(localStorage.getItem(k)))) }
async function shot(p,name) { if(output)await p.screenshot({path:`${output}/${engine}-${name}.png`}) }
async function bounds(p,selector,min=44) {
 const bad=await p.locator(selector).evaluateAll((es,min)=>es.flatMap(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return[];const fail=[];if(r.width<min-.5||r.height<min-.5)fail.push('target');const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(walk.nextNode()){if(!walk.currentNode.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(walk.currentNode);for(const t of range.getClientRects())if(t.left<r.left-1||t.right>r.right+1||t.top<r.top-1||t.bottom>r.bottom+1)fail.push('text')}return fail.length?[{label:e.textContent,fail,w:r.width,h:r.height}]:[]}),min)
 assert.deepEqual(bad,[])
 for(const target of await p.locator(selector).all()){if(!await target.isVisible())continue;await target.scrollIntoViewIfNeeded();assert(await target.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===e||e.contains(hit)}),'Target center must be reachable')}
}
async function run(id,fn,opts={}) {if(process.env.CHECK_CASE&&!id.startsWith(process.env.CHECK_CASE))return;const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',acceptDownloads:true,...opts});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(8000);try{await p.goto(url+'/#home');const detail=await fn(p);rows.push({id,status:'passed',detail});console.log(engine,id,'passed')}catch(e){await shot(p,id+'-failure').catch(()=>undefined);rows.push({id,status:'failed',error:e.stack});throw e}finally{const video=p.video();await c.close();if(video&&output)await video.saveAs(`${output}/${engine}-${id}.webm`)}}
try {
 await run('F01-empty-home-and-gallery',async p=>{assert.equal(await p.locator('.continue-card').count(),0);await nav(p,'My drawings');await p.getByText('Your drawings will appear here',{exact:true}).waitFor();await press(p,'Pictures',p.locator('.drawing-empty-state'));await p.locator('.picker-screen').waitFor();return 'No empty Continue card; first-class gallery has a friendly Pictures escape.'})
 for(const[name,width,height]of[['phone',390,844],['small-phone',360,740],['ipad-portrait',820,1180],['ipad-landscape',1180,820],['desktop',1440,900]])for(const enlarged of[false,true]){
  if(process.env.CHECK_VIEW && process.env.CHECK_VIEW!==name)continue
  await run(`F02-${name}-${enlarged?'text200-reduced':'default'}`,async p=>{
   if(enlarged) await p.addStyleTag({content:'html{font-size:200%!important}'})
   await press(p,'Draw on screen',p.locator('.surface-choice'));await press(p,'Pick a picture');await p.locator('.picker-screen').waitFor()
   assert.equal(await p.locator('.surface-switch button[aria-pressed=true]').innerText().then(t=>t.includes('Draw on screen')),true)
   await bounds(p,'.surface-switch button')
   await shot(p,`${name}-${enlarged?'text200':'default'}-pictures`)
   await p.reload();await p.locator('.drawing-card').first().waitFor();if(enlarged)await p.addStyleTag({content:'html{font-size:200%!important}'})
   assert.equal(await p.locator('.current-mode-badge').first().innerText(),'On screen')
   await p.locator('.drawing-card-action').first().click();await draw(p)
   const original=(await saved(p))[0]
   await shot(p,`${name}-${enlarged?'text200':'default'}-practice`)
   const done=p.getByRole('button',{name:'Done',exact:true}).filter({visible:true}).first()
   await bounds(p,'.done-button',56)
   if(width<=600){const layout=await p.evaluate(()=>{const a=document.querySelector('.practice-canvas').getBoundingClientRect(),t=document.querySelector('.compact-child-tools').getBoundingClientRect();return{canvas:a.height,canvasBottom:a.bottom,toolsTop:t.top,toolsBottom:t.bottom,height:innerHeight}});assert(layout.canvas>=140&&layout.toolsTop>=layout.canvasBottom&&layout.toolsBottom<=height+1,JSON.stringify(layout))}
   await done.click();await p.locator('.keepsake-dialog[open]').waitFor();
   if(name==='small-phone'){const motion=await p.locator('.keepsake-dialog').evaluate(e=>({duration:getComputedStyle(e).transitionDuration,properties:getComputedStyle(e).transitionProperty}));assert(motion.duration.split(',').every(v=>Math.abs(parseFloat(v)-.2)<.001));if(enlarged)assert.equal(motion.properties,'opacity')}
   await pause(250)
   await bounds(p,'.keepsake-stamps button',56)
   await bounds(p,'.keepsake-dialog button')
   await press(p,'Star',p.locator('.keepsake-dialog'));await pause(450)
   assert.equal((await saved(p))[0].stamp,'star');assert.equal(await p.locator('.keepsake-picture .keepsake-stamp').count(),1)
   await shot(p,`${name}-${enlarged?'text200':'default'}-keepsake`)
   const downloadPromise=p.waitForEvent('download');await press(p,'Save picture',p.locator('.keepsake-dialog'));const download=await downloadPromise
   assert(download.suggestedFilename().endsWith('-tracebuddy.png'));if(output)await download.saveAs(`${output}/${engine}-${name}-${enlarged?'text200':'default'}-stamped.png`)
   const chunks=[]; for await (const chunk of await download.createReadStream()) chunks.push(chunk); const png=Buffer.concat(chunks).toString('base64')
   const canonical=await p.locator('.keepsake-picture svg').evaluate(el=>{const svg=el.cloneNode(true);svg.setAttribute('width','1000');svg.setAttribute('height','1000');return new XMLSerializer().serializeToString(svg)})
   // Keep the raster oracle's extra image documents separate from the actual
   // user journey, and compare the real keepsake renderer with the real PNG.
   const oracle=await b.newContext();const oraclePage=await oracle.newPage()
   const delta=await oraclePage.evaluate(async ({canonical,png})=>{async function pixels(src){const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=c.height=1000;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,1000,1000).data}const a=await pixels('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(canonical));const b=await pixels('data:image/png;base64,'+png);return a.reduce((n,v,i)=>n+(v!==b[i]),0)},{canonical,png})
   await oracle.close()
   assert.equal(delta,0,'Keepsake renderer and exported stamped PNG must match')
   await press(p,'Keep drawing',p.locator('.keepsake-dialog'));await p.locator('.keepsake-dialog').waitFor({state:'detached'});await pause()
   assert.equal(await done.evaluate(e=>e===document.activeElement),true)
   await nav(p,'Home');await p.locator('.continue-card').waitFor();await shot(p,`${name}-${enlarged?'text200':'default'}-home`)
   await p.reload();await p.locator('.continue-card').waitFor();if(enlarged)await p.addStyleTag({content:'html{font-size:200%!important}'})
   await press(p,'Continue',p.locator('.continue-card'));await p.locator('.practice-document').waitFor()
   assert.equal((await saved(p))[0].sessionId,original.sessionId)
   assert.equal(await p.locator('.practice-ink > g > path').count(),1)
   await done.click();await p.locator('.keepsake-dialog[open]').waitFor();await p.keyboard.press('Escape');await p.locator('.keepsake-dialog').waitFor({state:'detached'})
   await done.click();await p.locator('.keepsake-dialog[open]').waitFor();await p.goBack();await p.locator('.keepsake-dialog').waitFor({state:'detached'});assert.equal(new URL(p.url()).hash,'#practice')
   await nav(p,'My drawings');await p.locator('.previous-work-card').waitFor();assert.equal(await p.locator('.stamp-badge').count(),1);await bounds(p,'.previous-work-actions button, .previous-work-summary button');await shot(p,`${name}-${enlarged?'text200':'default'}-drawings`)
   return {continueTaps:1,doneToSaveTaps:2,withOptionalStampTaps:3,pngDifferingChannels:delta,stamp:'star',savedId:original.sessionId}
  },{viewport:{width,height},hasTouch:name!=='desktop',reducedMotion:enlarged?'reduce':'no-preference',...(output&&name==='small-phone'?{recordVideo:{dir:output+'/motion',size:{width,height}}}:{})})
 }
 await run('F03-save-failure-retry-stamp-toggle-and-clear',async p=>{
  await press(p,'Practice on screen');await draw(p)
  await p.evaluate(()=>{window.__set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('tracebuddy.previousWork.'))throw new DOMException('Fixture full','QuotaExceededError');window.__set.call(this,k,v)}})
  await draw(p);await p.getByRole('button',{name:'Done',exact:true}).filter({visible:true}).click();await pause(400)
  assert.equal(await p.locator('.keepsake-dialog').count(),0);await p.getByText('Not saved',{exact:false}).waitFor()
  await p.evaluate(()=>{Storage.prototype.setItem=window.__set});await press(p,'Retry');await pause(400)
  await p.getByRole('button',{name:'Done',exact:true}).filter({visible:true}).click();await p.locator('.keepsake-dialog[open]').waitFor()
  await press(p,'Heart',p.locator('.keepsake-dialog'));await pause(500);assert.equal((await saved(p))[0].stamp,'heart');await press(p,'Heart',p.locator('.keepsake-dialog'));await pause(500);assert.equal((await saved(p))[0].stamp,undefined)
  await press(p,'Sun',p.locator('.keepsake-dialog'));await pause(500);await press(p,'My drawings',p.locator('.keepsake-dialog'));await p.locator('.drawings-screen').waitFor()
  await nav(p,'Pictures');await press(p,'Draw on screen',p.locator('.surface-choice'));await p.reload();await p.locator('.current-mode-badge').first().waitFor();assert.equal(await p.locator('.current-mode-badge').first().innerText(),'On screen')
  await nav(p,'My drawings');p.once('dialog',d=>d.accept());await press(p,'Clear local work');await pause(500);assert.deepEqual(await saved(p),[]);assert.equal(await p.evaluate(()=>localStorage.getItem('tracebuddy.modePreference.v1')),null)
  await p.reload();await nav(p,'Home');assert.equal(await p.locator('.continue-card').count(),0);assert.equal(await p.locator('.surface-switch button[aria-pressed=true]').innerText().then(t=>t.includes('Trace on paper')),true)
  return 'Failed Done stays on canvas; Retry recovers; selecting twice removes stamp; Clear removes drawings/stamps/mode.'
 })
 await run('F04-old-session-and-unknown-stamp',async p=>{
  await press(p,'Practice on screen');await draw(p);const session=(await saved(p))[0]
  await p.evaluate(s=>{delete s.stamp;delete s.revision;delete s.clearGeneration;const key='tracebuddy.previousWork.v1.session.'+s.sessionId;localStorage.setItem(key,JSON.stringify({...s,stamp:'unknown-stamp'}))},session)
  await p.goto(url+'/#home');await p.reload();await p.locator('.continue-card').waitFor();await press(p,'Continue',p.locator('.continue-card'));await p.locator('.practice-document').waitFor();assert.equal(await p.locator('.practice-ink > g > path').count(),1);assert.equal(await p.locator('.keepsake-stamp').count(),0)
  return 'Pre-feature sessions load, missing metadata accepted, unknown stamp ignored.'
 })
 await run('F05-newest-and-ten-work-strip',async p=>{
  await press(p,'Practice on screen');await draw(p);const base=(await saved(p))[0]
  await p.evaluate(base=>{const ids=[];for(let i=0;i<12;i++){const s={...base,sessionId:'strip-'+i,title:'Family drawing '+i,updatedAt:new Date(Date.now()-i*86400000).toISOString()};localStorage.setItem('tracebuddy.previousWork.v1.session.'+s.sessionId,JSON.stringify(s));ids.push(s.sessionId)}localStorage.removeItem('tracebuddy.previousWork.v1.session.'+base.sessionId);localStorage.setItem('tracebuddy.previousWork.v1.index',JSON.stringify({version:1,ids:ids.reverse()}))},base)
  await p.goto(url+'/#home');await p.reload();await p.locator('.continue-card').waitFor();assert.equal(await p.locator('.continue-card p').innerText(),'Family drawing 0')
  await press(p,'Pick a picture');await p.locator('.saved-drawings-track > button').nth(9).waitFor();assert.equal(await p.locator('.saved-drawings-track > button').count(),10);assert.equal(await p.locator('.saved-drawings-track strong').first().innerText(),'Family drawing 0')
  await press(p,'See all',p.locator('.my-drawings-strip'));await p.locator('.previous-work-card').nth(11).waitFor();assert.equal(await p.locator('.previous-work-card > strong').first().innerText(),'Family drawing 0')
  return 'Newest-first independent of index order; ten thumbnail shortcuts; See all retains twelve full action cards.'
 })
 await run('F06-mode-selection-during-clear',async p=>{
  await press(p,'Draw on screen',p.locator('.surface-choice'));await press(p,'Practice on screen');await draw(p);await nav(p,'My drawings')
  await p.evaluate(()=>{
   const clear=IDBObjectStore.prototype.clear
   IDBObjectStore.prototype.clear=function(){
    const tx=this.transaction
    Object.defineProperty(tx,'oncomplete',{set(handler){tx.addEventListener('complete',event=>{window.__releaseClear=()=>handler.call(tx,event)})}})
    return clear.call(this)
   }
  })
  p.once('dialog',d=>d.accept());await press(p,'Clear local work')
  await p.waitForFunction(()=>typeof window.__releaseClear==='function')
  assert.equal(await p.evaluate(()=>localStorage.getItem('tracebuddy.modePreference.v1')),null)
  await nav(p,'Home')
  assert.equal(await p.locator('.surface-switch button:disabled').count(),2)
  // Dispatch even though disabled to exercise the handler's independent ref guard.
  await p.getByRole('button',{name:'Draw on screen',exact:true}).dispatchEvent('click')
  assert.equal(await p.evaluate(()=>localStorage.getItem('tracebuddy.modePreference.v1')),null)
  await shot(p,'clear-mode-disabled')
  await p.evaluate(()=>window.__releaseClear())
  await p.waitForFunction(()=>document.querySelectorAll('.surface-switch button:disabled').length===0)
  assert.equal(await p.evaluate(()=>localStorage.getItem('tracebuddy.modePreference.v1')),null)
  await p.reload();await p.locator('.surface-switch').waitFor()
  assert.equal(await p.evaluate(()=>localStorage.getItem('tracebuddy.modePreference.v1')),null)
  assert.equal(await p.getByRole('button',{name:'Trace on paper',exact:true}).getAttribute('aria-pressed'),'true')
  return 'Mode cards disabled while image cleanup waits; interleaved selection cannot recreate preference, including after reload.'
 })
 await run('F07-mounted-home-newest-session-and-source',async p=>{
  await press(p,'Practice on screen');await draw(p);const first=(await saved(p))[0]
  await nav(p,'Home');await p.locator('.continue-card').waitFor()
  const original=await p.locator('.continue-preview .practice-guide-image').first().getAttribute('href')
  const other=await p.context().newPage();await other.goto(url+'/#home')
  await press(other,'Draw on screen',other.locator('.surface-choice'));await press(other,'Pick a picture')
  await other.locator('.drawing-card-action').nth(1).click();await draw(other)
  const next=(await saved(other)).find(s=>s.sessionId!==first.sessionId)
  assert(next);const expected=await other.locator('.practice-guide-image').first().getAttribute('href');assert.notEqual(expected,original)
  await p.waitForFunction(title=>document.querySelector('.continue-card p')?.textContent===title,next.title)
  assert.equal(await p.locator('.continue-preview .practice-guide-image').first().getAttribute('href'),expected)
  await shot(p,'mounted-home-newest-guide')
  // Also replace a template source on the same session: the keyed instance stays
  // mounted and must reset its guide, even without a changed session ID.
  await other.evaluate(({next,first})=>{localStorage.setItem('tracebuddy.previousWork.v1.session.'+next.sessionId,JSON.stringify({...next,title:'Changed source',source:first.source,updatedAt:new Date().toISOString()}))},{next,first})
  await p.getByText('Changed source',{exact:true}).waitFor()
  assert.equal(await p.locator('.continue-preview .practice-guide-image').first().getAttribute('href'),original)
  await press(p,'Continue',p.locator('.continue-card'));await p.locator('.practice-document').waitFor()
  assert.equal(await p.locator('.practice-guide-image').first().getAttribute('href'),original)
  await other.close()
  return 'Home remains mounted across a cross-tab newest-session change and a same-session template-source change; title, guide, ink and Resume agree.'
 })
 await run('F08-delayed-upload-done-autosave-replacement-failure',async p=>{
  await press(p,'Pick a picture');await p.locator('.picker-alternates > summary').click()
  await p.locator('input[type=file]').setInputFiles(new URL('./fixtures/cleanup-photo.svg',import.meta.url).pathname)
  await p.locator('.trace-screen').waitFor()
  if(await p.locator('.setup-coach-backdrop').isVisible())await press(p,'Close for now')
  await p.locator('.sheet-toggle').click()
  await p.evaluate(()=>{
   window.__uploadReleases=[];window.__uploadWrites=0;window.__originalPut=IDBObjectStore.prototype.put
   IDBObjectStore.prototype.put=function(...args){
    window.__uploadWrites++
    if(window.__uploadWrites===3)throw new DOMException('Replacement upload write failed','QuotaExceededError')
    const tx=this.transaction
    Object.defineProperty(tx,'oncomplete',{set(handler){tx.addEventListener('complete',event=>window.__uploadReleases.push(()=>handler.call(tx,event)))}})
    return window.__originalPut.apply(this,args)
   }
  })
  await p.locator('.cleanup-mode-grid button').filter({hasText:'Line art'}).click()
  await p.waitForFunction(()=>document.querySelector('.cleanup-status')?.textContent.includes('Line-art cleanup applied'))
  await p.waitForFunction(()=>window.__uploadReleases.length===1)
  await press(p,'Practice on screen');await draw(p,0)
  await p.getByRole('button',{name:'Done',exact:true}).filter({visible:true}).first().click()
  await pause(600) // Let the ordinary 450 ms autosave supersede Done's pending image flush.
  assert.equal(await p.locator('.keepsake-dialog').count(),0)
  await p.evaluate(()=>window.__uploadReleases.shift()()) // background processed-guide write
  await p.waitForFunction(()=>window.__uploadReleases.length===1&&window.__uploadWrites===2)
  await p.evaluate(()=>window.__uploadReleases.shift()()) // Done's superseded write
  await p.waitForFunction(()=>window.__uploadWrites===3)
  await p.getByText('Not saved',{exact:false}).waitFor()
  assert.equal(await p.locator('.keepsake-dialog').count(),0,'A superseded Done must not present success when the replacement upload fails')
  assert.deepEqual(await saved(p),[])
  await shot(p,'delayed-done-replacement-failed')
  await p.evaluate(()=>{IDBObjectStore.prototype.put=window.__originalPut})
  await p.getByRole('button',{name:'Done',exact:true}).filter({visible:true}).first().click()
  await p.locator('.keepsake-dialog[open]').waitFor()
  assert.equal((await saved(p))[0].strokes.length,1)
  return 'Real Done and autosave overlap delayed processed-image writes; replacement failure keeps the canvas unsaved; a later Done commits and recovers.'
 })
 await run('F09-surface-storage-feedback-and-cross-tab-sync',async p=>{
  await p.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='tracebuddy.modePreference.v1')throw new DOMException('Fixture full','QuotaExceededError');window.__setItem.call(this,k,v)}})
  await press(p,'Draw on screen',p.locator('.surface-choice'))
  await p.getByRole('status').filter({hasText:'This choice will last for this visit only.'}).waitFor()
  assert.equal(await p.evaluate(()=>localStorage.getItem('tracebuddy.modePreference.v1')),null)
  await shot(p,'surface-visit-only-warning')
  await p.evaluate(()=>{Storage.prototype.setItem=window.__setItem})
  await press(p,'Trace on paper',p.locator('.surface-choice'))
  assert.equal(await p.getByText('This choice will last for this visit only.',{exact:true}).count(),0)
  const other=await p.context().newPage();await other.goto(url+'/#home')
  await press(other,'Draw on screen',other.locator('.surface-choice'))
  await p.waitForFunction(()=>document.querySelector('button[aria-label="Draw on screen"]')?.getAttribute('aria-pressed')==='true')
  await other.evaluate(()=>localStorage.removeItem('tracebuddy.modePreference.v1'))
  await p.waitForFunction(()=>document.querySelector('button[aria-label="Trace on paper"]')?.getAttribute('aria-pressed')==='true')
  await other.close()
  return 'Home reports failed preference writes and clears that warning on recovery; cross-tab choice and deletion update the mounted selector.'
 })
 await run('F10-pending-stamp-status-and-back-wins-gallery',async p=>{
  await press(p,'Practice on screen');await draw(p)
  await p.getByRole('button',{name:'Done',exact:true}).filter({visible:true}).first().click();await p.locator('.keepsake-dialog[open]').waitFor()
  const blocker=await p.context().newPage();await blocker.goto(url+'/#home')
  await blocker.evaluate(()=>new Promise(started=>{navigator.locks.request('tracebuddy.local-work',()=>new Promise(release=>{window.__releaseLock=release;started()}))}))
  await press(p,'Star',p.locator('.keepsake-dialog'))
  assert.equal(await p.locator('.keepsake-save-status').innerText(),'Saving…')
  assert.equal((await saved(p))[0].stamp,undefined)
  assert.equal(await p.locator('.keepsake-actions .primary-button').isDisabled(),true)
  await shot(p,'stamp-waits-for-commit')
  await press(p,'My drawings',p.locator('.keepsake-dialog'));await p.locator('.keepsake-dialog').waitFor({state:'detached'})
  await p.goBack();assert.equal(new URL(p.url()).hash,'#home')
  await blocker.evaluate(()=>window.__releaseLock())
  await p.locator('.hero-screen').waitFor();await pause(250)
  assert.equal(new URL(p.url()).hash,'#home','Delayed gallery action must not replace the newer Back destination')
  assert.equal((await saved(p))[0].stamp,'star')
  await blocker.close()
  return 'Stamp status and export stay pending under the storage lock; Back to Home wins over a delayed gallery callback and the stamp persists.'
 })
 await run('F11-short-document-stamp-bounds',async p=>{
  await press(p,'Practice on screen');await draw(p);const session=(await saved(p))[0]
  await p.evaluate(s=>localStorage.setItem('tracebuddy.previousWork.v1.session.'+s.sessionId,JSON.stringify({...s,document:{version:1,width:100,height:100}})),session)
  await p.reload();await p.locator('.practice-document').waitFor()
  await p.getByRole('button',{name:'Done',exact:true}).filter({visible:true}).first().click();await p.locator('.keepsake-dialog[open]').waitFor()
  await press(p,'Star',p.locator('.keepsake-dialog'));await pause(500)
  const bounds=await p.locator('.keepsake-picture .keepsake-stamp').evaluate(g=>{const box=g.getBBox(),m=g.transform.baseVal.consolidate().matrix;return{x:box.x*m.a+m.e,y:box.y*m.d+m.f,right:(box.x+box.width)*m.a+m.e,bottom:(box.y+box.height)*m.d+m.f}})
  assert(bounds.x>=0&&bounds.y>=0&&bounds.right<=100&&bounds.bottom<=100,JSON.stringify(bounds))
  return 'The stamp fits inside the smallest normalized 100×100 document; normal document placement is unchanged.'
 })
 assert.deepEqual(errors,[])
} finally {if(output)writeFileSync(`${output}/${engine}-finish-find.json`,JSON.stringify({rows,errors},null,2));await b.close();await server.close();life('release')}
