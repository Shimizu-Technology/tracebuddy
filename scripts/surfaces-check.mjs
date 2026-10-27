import puppeteer from 'puppeteer-core'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clickByText, closeBrowser, findChromeExecutable } from './browser-utils.mjs'

const url = (process.env.CHECK_URL || 'http://127.0.0.1:5202').replace(/#.*$/, '')
const evidence = process.env.CHECK_EVIDENCE
const fixtures = mkdtempSync(join(tmpdir(), 'tracebuddy-surfaces-'))
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (ok, message) => { if (!ok) throw new Error(message) }
// Real video frames exercise the detector, not a mocked tracking result. Loop:
// paper 6s → dark 5s → paper 6s. Y4M is generated locally and never committed.
const width = 320, height = 240
const visible = Buffer.alloc(width * height * 3 / 2, 128)
const dark = Buffer.from(visible)
visible.fill(45, 0, width * height)
dark.fill(45, 0, width * height)
for (let y = 30; y < 210; y++) for (let x = 60; x < 260; x++) visible[y * width + x] = 235
const frames = [Buffer.from(`YUV4MPEG2 W${width} H${height} F5:1 Ip A1:1 C420jpeg\n`)]
for (let n = 0; n < 85; n++) frames.push(Buffer.from('FRAME\n'), n < 30 || n >= 55 ? visible : dark)
writeFileSync(join(fixtures, 'paper.y4m'), Buffer.concat(frames))
writeFileSync(join(fixtures, 'corrupt.png'), 'not PNG bytes')
writeFileSync(join(fixtures, 'text.txt'), 'not an image')
writeFileSync(join(fixtures, 'valid.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="30" fill="none" stroke="black"/></svg>')
const browser = await puppeteer.launch({ executablePath: findChromeExecutable(), headless: true,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${join(fixtures, 'paper.y4m')}`] })
const results = []
const shot = async (page, name) => { if (evidence) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: join(evidence, name + '.png') }) } }
try {
  for (const [name, w, h] of [['phone',390,844],['small-phone',360,740],['ipad-portrait',820,1180],['ipad-landscape',1180,820],['desktop',1440,900]]) {
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    await page.setViewport({ width:w, height:h, isMobile:w<1200, hasTouch:w<1200 })
    await page.goto(url+'#pictures', { waitUntil:'networkidle0' })
    const first = await page.$eval('.drawing-card', (e) => e.getBoundingClientRect().top)
    assert(first < h * .6, `${name}: pictures start too low: ${first}`)
    await page.type('.drawing-search input', 'Guam')
    await page.select('select[aria-label="Difficulty level"]', 'Starter')
    await page.click('[data-favorite-button="guam-outline"]')
    await page.click('.favorites-filter')
    await page.evaluate(() => scrollTo({top:100, behavior:'instant'}))
    await pause(100)
    const scroll = await page.evaluate(() => scrollY)
    await page.click('[data-drawing-id="guam-outline"] .drawing-card-action')
    if (await page.$('.setup-coach-backdrop')) await clickByText(page, 'Close for now')
    await clickByText(page, 'Change picture')
    await page.waitForSelector('.picker-screen')
    await pause(100)
    assert(await page.$eval('.drawing-search input', e=>e.value) === 'Guam', name+': query lost on return')
    assert(await page.$eval('.favorites-filter', e=>e.getAttribute('aria-pressed')) === 'true', name+': favorites lost on return')
    assert(Math.abs(await page.evaluate(()=>scrollY)-scroll)<3, name+': scroll lost on return')
    await page.click('[data-drawing-id="guam-outline"] .drawing-card-action')
    await page.goBack()
    await page.waitForSelector('.picker-screen')
    assert(await page.$eval('.drawing-search input',e=>e.value)==='Guam', name+': browser Back query lost')
    await pause(100)
    assert(Math.abs(await page.evaluate(()=>scrollY)-scroll)<3,name+': browser Back scroll lost '+JSON.stringify({expected:scroll,actual:await page.evaluate(()=>scrollY)}))
    await page.goto(url+'#camera', {waitUntil:'networkidle0'})
    await clickByText(page,'Close for now')
    await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0)
    // File rejection must preserve the selected guide and route; no IndexedDB write.
    const original = await page.$eval('.overlay-layer img', e=>e.src)
    for (const [file,message] of [['corrupt.png','Cannot open'],['text.txt','Choose an image']]) {
      const input = await page.$('.trace-header input[type=file]')
      await input.uploadFile(join(fixtures,file))
      await page.waitForFunction(text=>document.querySelector('.trace-header .upload-message')?.textContent.includes(text),{},message)
      assert(await page.$eval('.overlay-layer img',e=>e.src)===original,name+': invalid upload replaced guide')
      assert(await page.evaluate(()=>location.hash)==='#camera',name+': invalid upload navigated')
    }
    const countUploads = () => page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('tracebuddy-uploaded-images', 1)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const count = db.transaction('uploaded-images').objectStore('uploaded-images').count()
        count.onsuccess = () => { db.close(); resolve(count.result) }
        count.onerror = () => { db.close(); reject(count.error) }
      }
    }))
    assert(await countUploads() === 0, name+': rejected upload was saved')
    await (await page.$('.trace-header input[type=file]')).uploadFile(join(fixtures,'valid.svg'))
    await page.waitForFunction(()=>document.querySelector('.trace-header h1')?.textContent==='valid.svg')
    await page.waitForFunction(()=>document.querySelector('.overlay-layer img')?.naturalWidth===100)
    assert(await countUploads() === 1, name+': valid image was not saved')
    const frameSize = () => page.$eval('.camera-video', e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))
    const initialFrame = await frameSize()
    if (await page.$eval('.mobile-control-bar', e=>getComputedStyle(e).display!=='none')) await page.click('.sheet-toggle')
    const adjustedFrame = await frameSize()
    assert(Math.abs(adjustedFrame.height-initialFrame.height)<1,name+': panel rescaled video')
    const stageVisible = await page.$eval('.camera-stage', e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.top+Math.min(r.height,120)<innerHeight})
    assert(stageVisible,name+': adjusting loses camera')
    const body = await page.$('.controls-body')
    await body.evaluate(e=>e.scrollTop=e.scrollHeight)
    assert(await page.$eval('.camera-stage',e=>e.getBoundingClientRect().top)>=0,name+': panel scroll moved camera')
    await body.evaluate(e=>e.scrollTop=0)
    await page.click('.mini-lock').catch(async()=>{await clickByText(page,'Lock','.toggle')})
    assert(await page.$eval('button[aria-label="Move overlay right"]',e=>e.disabled),name+': locked nudge still enabled')
    assert(await page.$$eval('.slider-control', labels=>labels.find(e=>e.textContent.trim().startsWith('Size')).querySelector('input').disabled),name+': locked size still enabled')
    await clickByText(page,'Start child trace')
    await page.waitForSelector('.child-trace-mode')
    const childFrame = await frameSize()
    assert(Math.abs(childFrame.height-initialFrame.height)<1,name+': child mode rescaled video')
    await page.click('.child-mode-exit')
    assert(await page.$('.child-trace-mode'),name+': short tap exited child mode')
    await page.focus('.child-mode-exit')
    await page.keyboard.down('Space'); await pause(700); await page.keyboard.up('Space')
    assert(await page.$('.child-trace-mode'),name+': partial hold exited')
    await page.keyboard.down('Enter'); await pause(1600); await page.keyboard.up('Enter')
    await page.waitForFunction(()=>!document.querySelector('.child-trace-mode'))
    // Text enlargement and collapsed navigation retain reachable Help.
    await page.evaluate(()=>document.documentElement.style.fontSize='200%')
    const menu = await page.$('.nav-toggle')
    if (menu && await menu.evaluate(e=>getComputedStyle(e).display!=='none')) await menu.click()
    await clickByText(page,'Help')
    await page.waitForSelector('.parent-help-dialog')
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+': 200% page overflows')
    await shot(page,name+'--text200-help')
    await page.keyboard.press('Escape')
    await page.evaluate(()=>document.documentElement.style.fontSize='')
    await page.goto(url+'#learn',{waitUntil:'networkidle0'})
    const lesson = await page.evaluate(()=>{const guide=document.querySelector('.lesson-picture img').getBoundingClientRect(),instruction=document.querySelector('.lesson-instruction h3').getBoundingClientRect(),next=document.querySelector('.lesson-actions .primary-button').getBoundingClientRect();return {guide:guide.bottom,instruction:instruction.top,next:next.bottom,h:innerHeight}})
    assert(lesson.instruction>=0&&lesson.guide<lesson.h&&lesson.next<lesson.h,name+': lesson requires scroll '+JSON.stringify(lesson))
    await shot(page,name+'--lesson-workspace')
    await context.close()
    results.push({name,passed:true,firstPicture:first})
  }
  const page = await browser.newPage()
  await page.setViewport({width:1180,height:820})
  await page.goto(url+'#camera',{waitUntil:'networkidle0'})
  await clickByText(page,'Close for now')
  await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0)
  await clickByText(page,'Track paper')
  await page.waitForFunction(()=>document.querySelector('.paper-status')?.classList.contains('found'),{timeout:20000})
  await page.waitForFunction(()=>document.querySelector('.paper-status')?.classList.contains('lost'),{timeout:20000})
  assert(await page.$eval('.overlay-layer',e=>e.style.opacity)==='0','Lost paper kept stale guide visible')
  assert(await page.$eval('.trace-header .primary-button',e=>e.disabled),'Lost paper allows child mode')
  assert(!(await page.$('.paper-guide')),'Lost paper kept stale success outline')
  await shot(page,'paper-lost')
  await page.waitForFunction(()=>document.querySelector('.paper-status')?.classList.contains('found'),{timeout:20000})
  assert(!await page.$eval('.trace-header .primary-button',e=>e.disabled),'Reacquired paper did not allow child mode')
  await shot(page,'paper-reacquired')
  await page.waitForFunction(()=>document.querySelector('.paper-status')?.classList.contains('lost'),{timeout:20000})
  await clickByText(page,'Align manually')
  assert(await page.$eval('.overlay-layer',e=>e.style.opacity)!=='0','Manual recovery did not restore guide')
  assert(!await page.$eval('button[aria-label="Move overlay right"]',e=>e.disabled),'Manual recovery did not unlock geometry')
  // Permission failure retry stays in the opening viewport at all sizes.
  for (const [w,h] of [[360,740],[820,1180],[1440,900]]) {
    const p=await browser.newPage();await p.setViewport({width:w,height:h})
    await p.evaluateOnNewDocument(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Fixture denied','NotAllowedError')}})
    await p.goto(url+'#camera',{waitUntil:'networkidle0'});await clickByText(p,'Close for now')
    await p.waitForSelector('.camera-help button')
    assert(await p.$eval('.camera-help button',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight}),`${w}: retry is off screen`)
    await shot(p,w+'--camera-denied');await p.close()
  }
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}])
  await page.goto(url+'#together',{waitUntil:'networkidle0'})
  await page.evaluate(()=>{window.__scrollBehavior=[];const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(o){window.__scrollBehavior.push(o.behavior);original.call(this,o)}})
  await page.click('[data-family-activity-id="guam-memory-map"]')
  await pause(100)
  assert(await page.evaluate(()=>window.__scrollBehavior.every(x=>x==='auto')),'Together ignored reduced motion')
  results.push({tracking:'lost → reacquired',reducedMotion:'auto',permissionRetry:'visible'})
  console.log(JSON.stringify(results,null,2))
  if(evidence)writeFileSync(join(evidence,'surfaces-results.json'),JSON.stringify(results,null,2))
} finally { await closeBrowser(browser); rmSync(fixtures,{recursive:true,force:true}) }
