import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true,channel:process.env.PROTOTYPE_BROWSER_CHANNEL||'chrome'})
const page=await browser.newPage(),errors=[],warnings=[],results=[]
const evidencePrefix=process.env.EVIDENCE_PREFIX||'ux'
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});page.on('console',m=>{if(['warning','error'].includes(m.type()))warnings.push(m.text())})
const player=page.locator('.shared-player'),time=async()=>Number(await player.getAttribute('data-time'))
const button=name=>page.getByRole('button',{name,exact:true})
async function seek(t){await page.getByRole('slider',{name:'时间跳转'}).fill(String(t));await page.waitForTimeout(50);assert.equal(await time(),t);assert.equal(await player.getAttribute('data-playing'),'false')}
async function state(){return page.evaluate(()=>({devices:[...document.querySelectorAll('[data-device]')].map(e=>[e.dataset.device,e.dataset.status,e.getAttribute('class')]),packets:[...document.querySelectorAll('[data-packet]')].map(e=>[e.dataset.packet,e.getAttribute('transform'),getComputedStyle(e).display,e.dataset.phase]),rows:[...document.querySelectorAll('[data-row]')].map(e=>[e.dataset.row,e.dataset.phase,e.getAttribute('class')]),narration:document.querySelector('[data-testid=narration]')?.textContent,details:document.querySelector('[data-testid=details]')?.textContent}))}
try{
 await page.goto(process.env.BROWSER_BASE_URL||'http://127.0.0.1:5173/#/prototype');await page.locator('.network-svg').waitFor();assert.equal(await page.locator('.shell').count(),0)
 for(const width of [1440,900,390,320]){
  await page.setViewportSize({width,height:1000});await seek(2600)
  assert.equal(await page.locator('[data-device]').count(),4);assert.equal(await page.locator('[data-link]').count(),3)
  await page.getByRole('combobox',{name:'选择对象'}).selectOption('syn');const expected=await state()
  await seek(18000);await seek(0);await seek(2600);assert.deepEqual(await state(),expected)
  await page.locator('[data-device="client"]').click();assert.match(await page.locator('[data-testid=details]').textContent(),/SYN-SENT/)
  await page.getByRole('button',{name:'查看 SYN, ACK 报文',exact:true}).click();assert.equal(await time(),6000);assert.match(await page.locator('[data-testid=details]').textContent(),/101/);assert.equal(await page.locator('[data-row=synack]').getAttribute('aria-selected'),'true')
  await seek(10100);assert.equal(await page.locator('[data-device=client]').getAttribute('data-status'),'ESTABLISHED');assert.equal(await page.locator('[data-device=server]').getAttribute('data-status'),'SYN-RECEIVED');assert.equal(await page.locator('[data-row=synack]').getAttribute('data-phase'),'received')
  await button('回退').click();assert.equal(await time(),6000);await button('回退').click();assert.equal(await time(),0);await button('下一步').click();assert.equal(await time(),6000)
  await button('时序').click();assert.equal(await page.locator('[data-sequence]').count(),3)
  await page.getByRole('button',{name:'ACK 时序',exact:true}).click();assert.equal(await time(),12000);assert.match(await page.locator('[data-testid=details]').textContent(),/301/)
  if(width===1440)await page.screenshot({path:`docs/evidence/${evidencePrefix}-tcp-sequence-1440.png`,fullPage:true})
  await button('网络').click();await seek(16100);assert.equal(await page.locator('[data-device=server]').getAttribute('data-status'),'ESTABLISHED');assert.equal(await page.locator('[data-row=ack]').getAttribute('data-phase'),'received')
  await page.getByRole('combobox',{name:'播放速度'}).selectOption('2');assert.equal(await page.getByRole('combobox',{name:'播放速度'}).inputValue(),'2')
  await seek(6000);await button('播放').click();await page.waitForTimeout(240);await button('暂停').click();const paused=await time();assert(paused>6000);await page.waitForTimeout(120);assert.equal(await time(),paused)
  await seek(17990);await button('播放').click();await page.waitForTimeout(150);assert.equal(await time(),18000);assert.equal(await player.getAttribute('data-playing'),'false')
  await button('重播').click();await page.waitForTimeout(100);assert(await time()<2000);await button('暂停').click();await button('重置').click();assert.equal(await time(),0)
  await page.getByRole('combobox',{name:'选择对象'}).selectOption('syn');await seek(2600)
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`page overflow ${width}`)
  if(width<=390){assert(await page.locator('.packet-table-scroll').evaluate(e=>e.scrollWidth>e.clientWidth));await page.locator('.packet-table-scroll').evaluate(e=>{e.scrollLeft=e.scrollWidth});assert(await page.locator('.packet-table-scroll').evaluate(e=>e.scrollLeft>0));await page.locator('.packet-table-scroll').evaluate(e=>{e.scrollLeft=0})}
  if(width<=390){await page.locator('.network-canvas-host').evaluate(e=>{e.scrollLeft=0});assert(await page.locator('.mobile-pan-hint').isVisible())}
  await page.locator('.learning-header').scrollIntoViewIfNeeded();await page.screenshot({path:`docs/evidence/${evidencePrefix}-tcp-${width}.png`,fullPage:true})
  results.push({width,networkAndSequence:'passed',reverseStateAndDetails:'passed',tableSelection:'passed',controlsAndSpeed:'passed',responsive:'passed'})
 }
 await page.setViewportSize({width:1440,height:1000});await seek(0);await page.locator('.network-board').click({position:{x:20,y:55}});await page.keyboard.press('Space');await page.waitForTimeout(100);assert.equal(await player.getAttribute('data-playing'),'true');await page.keyboard.press('Space');assert.equal(await player.getAttribute('data-playing'),'false');await page.keyboard.press('ArrowRight');assert.equal(await time(),6000);await page.keyboard.press('ArrowLeft');assert.equal(await time(),0)
 // Shared player reuse: the remaining scenes stay functional in the learner shell.
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000})
  for(const [title,id] of [['报销审批流程','expense'],['勾股定理','pythagoras'],['生产加工流程','production']]){
   await page.locator('.sample-tabs').getByRole('button',{name:new RegExp(title)}).click();await page.waitForTimeout(200);assert.equal(await player.getAttribute('data-course'),id);await seek(4000)
   if(id==='expense'){assert.equal(await page.locator('.business-node').count(),8);await page.getByRole('combobox',{name:'选择对象'}).selectOption('bill');assert.match(await page.locator('[data-testid=details]').textContent(),/待主管审批/)}
   if(id==='pythagoras'){assert.equal(await page.locator('.object-overlay annotation').textContent(),'a^2+b^2=c^2');assert.equal(await page.locator('.object-overlay math').count(),1)}
   if(id==='production'){const href=await page.locator('.object-overlay image').getAttribute('href');assert(await page.evaluate(async url=>{const image=new Image();image.src=url;await image.decode();return image.naturalWidth>0},href))}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390)await page.screenshot({path:`docs/evidence/${evidencePrefix}-${id}-390.png`,fullPage:true})
   await button('重置').click();assert.equal(await time(),0);results.push({course:id,width,sharedPlayerRegression:'passed'})
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[])
 writeFileSync(process.env.BROWSER_EVIDENCE||`docs/evidence/${evidencePrefix}-browser.json`,JSON.stringify({result:'passed',browser:await browser.version(),errors,warnings,results,keyboard:'passed',screenshots:8},null,2)+'\n')
 console.log('PASS experience: 4 TCP widths, network/sequence, controls, selection, packet fields, keyboard; 3 other courses × 3 widths; 8 screenshots')
}finally{await browser.close()}
