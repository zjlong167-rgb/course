import assert from 'node:assert/strict'
import fs from 'node:fs'
import {chromium} from 'playwright'
import {rebuild,duration,starts} from '../frontend/src/player/engine.ts'
import {validateCourse} from '../contracts/validate.mjs'
import {instantiate} from '../frontend/src/editor/templates.ts'
const course=JSON.parse(fs.readFileSync('samples/valid/expense.json','utf8')),scenes=course.chapters[0].scenes
assert.deepEqual(validateCourse(course),[])
assert.deepEqual(validateCourse(instantiate(course)),[])
for(const scene of scenes){
 const bill=scene.objects.find(o=>o.type==='packet'),steps=starts(scene),end=duration(scene)
 for(const t of [...steps,...steps.map(t=>t+875),end]){const expected=rebuild(scene,t);rebuild(scene,end);rebuild(scene,0);assert.deepEqual(rebuild(scene,t),expected)}
 assert.equal(rebuild(scene,steps.at(-2)).states[bill.id].status,'付款中')
 assert.equal(rebuild(scene,end).states[bill.id].status,'paid')
 if(scene.id==='return-scene'){const returned=rebuild(scene,steps[3]);assert.equal(returned.states[bill.id].status,'待补正');assert.equal(returned.states['return-cashier'].highlight,false)}
}
const b=await chromium.launch({channel:'chrome'}),page=await b.newPage(),errors=[],results=[]
page.on('pageerror',e=>errors.push(e.message))
const root=page.locator('.shared-player'),slider=page.getByRole('slider',{name:'时间跳转'})
const seek=async t=>{await slider.fill(String(t));assert.equal(await root.getAttribute('data-time'),String(t))}
const snapshot=()=>page.locator('.business-flow').evaluate(e=>e.outerHTML)
try{
 await page.goto((process.env.COURSE_BASE||'http://127.0.0.1:5173')+'/#/prototype?course=expense')
 await page.locator('.business-flow').waitFor()
 assert.equal(await root.getAttribute('data-course'),'expense')
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000})
  for(const [index,scene] of scenes.entries()){
   await page.getByRole('combobox',{name:'章节 / 场景'}).selectOption(String(index))
   await page.locator('.business-flow').waitFor()
   assert.equal(await root.getAttribute('data-time'),'0')
   const bill=scene.objects.find(o=>o.type==='packet'),offset=starts(scene)[3]+875
   await page.getByRole('combobox',{name:'选择对象'}).selectOption(bill.id)
   await seek(offset);const expected=await snapshot()
   await seek(duration(scene));assert.match(await page.getByTestId('details').innerText(),/已支付/)
   await seek(0);await seek(offset);assert.equal(await snapshot(),expected)
   await page.getByRole('button',{name:'回退',exact:true}).click();assert.equal(await root.getAttribute('data-time'),String(starts(scene)[3]))
   await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(150);await page.getByRole('button',{name:'暂停',exact:true}).click()
   const paused=await root.getAttribute('data-time');await page.waitForTimeout(80);assert.equal(await root.getAttribute('data-time'),paused)
   await page.getByRole('combobox',{name:'播放倍速'}).selectOption('2')
   await seek(duration(scene)-10);await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(120);assert.equal(await root.getAttribute('data-time'),String(duration(scene)))
   await page.getByRole('button',{name:'重置',exact:true}).click();await seek(offset)
   assert.equal(await page.locator('.business-edge').count(),8)
   const card=page.locator(`[data-object="${bill.id}"]`);await card.scrollIntoViewIfNeeded();await card.focus();await page.keyboard.press('Enter');assert.equal(await page.getByRole('combobox',{name:'选择对象'}).inputValue(),bill.id)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`page overflow ${width}`)
   if(width<=390){await page.locator('.stage-scroll').evaluate(e=>{e.scrollLeft=e.scrollWidth});assert.ok(await page.locator('.stage-scroll').evaluate(e=>e.scrollLeft>0));await page.locator('.stage-scroll').evaluate(e=>{e.scrollLeft=0})}
   if(width===1440 || index===0){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`docs/evidence/expense-${index}-${width}.png`,fullPage:true})}
   results.push({scene:scene.title,width,controls:true,reverseRebuild:true,edges:8})
  }
 }
 assert.deepEqual(errors,[])
 fs.writeFileSync('docs/evidence/expense-browser.json',JSON.stringify({result:'passed',results,errors},null,2))
 console.log('PASS three reimbursement paths × desktop/390/320; semantic states, template validation, reverse reconstruction, controls, keyboard selection, scroll bounds')
}finally{await b.close()}
