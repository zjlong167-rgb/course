import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true,channel:process.env.PROTOTYPE_BROWSER_CHANNEL||'chrome'}),errors=[],checks=[]
try{
 for(const view of ['network','sequence']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'.local/motion-recordings',size:{width:1440,height:1000}}}),page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['warning','error'].includes(m.type()))errors.push(m.text())})
  const video=page.video()
  await page.goto(process.env.BROWSER_BASE_URL||'http://127.0.0.1:5173/#/prototype');await page.locator('.network-svg').waitFor()
  const root=page.locator('.shared-player'),seek=async t=>{await page.getByRole('slider',{name:'时间跳转'}).fill(String(t));await page.waitForTimeout(50)}
  if(view==='sequence')await page.getByRole('button',{name:'时序',exact:true}).click()
  if(view==='network'){
   assert.equal(await page.locator('[data-lane]').count(),6)
   assert.equal(await page.locator('.lane-track[marker-end]').count(),6)
   for(const t of [1200,2600,7200,8600]){await seek(t);const active=await page.locator('[data-lane].active').getAttribute('data-lane');assert.equal(active,({1200:'client>router',2600:'router>internet',7200:'server>internet',8600:'internet>router'})[t]);await page.screenshot({path:`docs/evidence/motion-network-${t}.png`,fullPage:true})}
  }else{
   for(const [t,p] of [[0,0],[1625,.25],[2450,.5],[3275,.75],[4100,1]]){await seek(t);assert.equal(Number(await page.locator('[data-sequence=syn]').getAttribute('data-progress')),p);assert.equal(await page.locator('[data-sequence=synack] .sequence-trace').count(),0);await page.screenshot({path:`docs/evidence/motion-sequence-${t}.png`,fullPage:true})}
   await seek(8450);assert.equal(Number(await page.locator('[data-sequence=synack]').getAttribute('data-progress')),.5);await page.screenshot({path:'docs/evidence/motion-sequence-return.png',fullPage:true})
  }
  await seek(2600);const frozen=await page.locator(view==='network'?'[data-packet=syn]':'[data-sequence=syn] .sequence-trace').getAttribute(view==='network'?'transform':'d');await page.waitForTimeout(200);assert.equal(await page.locator(view==='network'?'[data-packet=syn]':'[data-sequence=syn] .sequence-trace').getAttribute(view==='network'?'transform':'d'),frozen)
  await page.getByRole('button',{name:view==='network'?'时序':'网络',exact:true}).click();assert.equal(await root.getAttribute('data-time'),'2600');await page.getByRole('button',{name:view==='network'?'网络':'时序',exact:true}).click()
  await seek(18000);await seek(2600);assert.equal(await page.locator(view==='network'?'[data-packet=syn]':'[data-sequence=syn] .sequence-trace').getAttribute(view==='network'?'transform':'d'),frozen)
  await seek(0);await page.getByRole('combobox',{name:'播放速度'}).selectOption('2');await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.shared-player').dataset.time==='18000',{},{timeout:14000});assert.equal(await root.getAttribute('data-playing'),'false')
  await page.getByRole('button',{name:'重播',exact:true}).click();await page.waitForTimeout(200);assert(Number(await root.getAttribute('data-time'))<2000);await page.getByRole('button',{name:'暂停',exact:true}).click()
  await page.close();await context.close();await video.saveAs(`docs/evidence/motion-${view}.webm`)
  checks.push({view,directedAnimation:'passed',pauseFreeze:'passed',reverseSeek:'passed',viewSwitchTime:'passed',playEndReplay:'passed',video:`motion-${view}.webm`})
 }
 assert.deepEqual(errors,[]);writeFileSync('docs/evidence/motion-browser.json',JSON.stringify({result:'passed',browser:await browser.version(),errors,checks},null,2)+'\n');console.log('PASS directed lanes and progressive sequence, real playback, 2 videos')
}finally{await browser.close()}
