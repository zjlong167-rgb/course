import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import {writeFileSync,readFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true,channel:process.env.PROTOTYPE_BROWSER_CHANNEL||'chrome'})
const page=await browser.newPage();const errors=[],warnings=[],results=[]
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)})
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')warnings.push(m.text())})
const root=page.locator('.shared-player')
const time=async()=>Number(await root.getAttribute('data-time'))
async function seek(t){await page.getByRole('slider',{name:'时间跳转'}).fill(String(t));await page.waitForTimeout(70);assert.equal(await time(),t);assert.equal(await root.getAttribute('data-playing'),'false')}
async function snapshot(){return page.evaluate(()=>({nodes:[...document.querySelectorAll('.vue-flow__node')].map(n=>({id:n.dataset.id,text:n.textContent,style:n.getAttribute('style')})),overlays:[...document.querySelectorAll('[data-object]')].map(n=>({id:n.getAttribute('data-object'),text:n.textContent,transform:n.getAttribute('transform'),style:n.getAttribute('style'),class:n.getAttribute('class')})),narration:document.querySelector('[data-testid=narration]').textContent,details:document.querySelector('[data-testid=details]')?.textContent}))}
try{
 await page.goto('http://127.0.0.1:5173/#/prototype');await root.waitFor()
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1100})
  for(const [id,title,object] of [['tcp','TCP 三次握手','client'],['expense','报销审批流程','bill'],['pythagoras','勾股定理','formula'],['production','生产加工流程','material']]){
   await page.locator('.sample-tabs').getByRole('button',{name:new RegExp(title)}).click();await page.waitForTimeout(180)
   const course=JSON.parse(readFileSync(`samples/valid/${id}.json`,'utf8')),steps=course.chapters[0].scenes[0].steps,total=steps.reduce((t,s)=>t+s.durationMs,0),boundary=steps[0].durationMs
   assert.equal(await root.getAttribute('data-course'),id)
   await page.getByRole('combobox',{name:'选择对象'}).selectOption(object)
   await seek(boundary+750);const expected=await snapshot()
   await seek(total);await seek(0);await seek(boundary+750);assert.deepEqual(await snapshot(),expected)
   await page.getByRole('button',{name:'回退',exact:true}).click();assert.equal(await time(),boundary)
   await page.getByRole('button',{name:'回退',exact:true}).click();assert.equal(await time(),0)
   await page.getByRole('button',{name:'下一步',exact:true}).click();assert.equal(await time(),boundary)
   await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(220)
   await page.getByRole('button',{name:'暂停',exact:true}).click();const paused=await time();assert(paused>boundary)
   await page.waitForTimeout(130);assert.equal(await time(),paused)
   await seek(total-10);await page.getByRole('button',{name:'播放',exact:true}).click();await page.waitForTimeout(150);assert.equal(await time(),total);assert.equal(await root.getAttribute('data-playing'),'false')
   await page.getByRole('button',{name:'重播',exact:true}).click();await page.waitForTimeout(90);assert(await time()<1500);await page.getByRole('button',{name:'暂停',exact:true}).click()
   await page.getByRole('button',{name:'重置',exact:true}).click();assert.equal(await time(),0)
   assert.equal(await page.getByRole('combobox',{name:'选择对象'}).inputValue(),object)
   await seek(4000)
   if(id==='tcp'){assert.equal(await page.locator('[data-link]').count(),3);assert(await page.locator('[data-link]').first().getAttribute('d'))}
   if(id==='pythagoras'){assert.equal(await page.locator('.object-overlay math').count(),1);assert.equal(await page.locator('.object-overlay annotation').textContent(),'a^2+b^2=c^2');assert.equal(await page.locator('.object-overlay polygon').count(),1)}
   if(id==='production'){const href=await page.locator('.object-overlay image').getAttribute('href');assert(await page.evaluate(async url=>{const img=new Image();img.src=url;await img.decode();return img.naturalWidth>0},href));assert.equal(await page.locator('[data-object="photo"]').getAttribute('class'),'overlay-item highlight')}
   if(id==='production'){
    await page.locator('.object-overlay image').click();assert.match(await page.locator('[data-testid=details]').textContent(),/工位示意图/)
   }else if(id==='pythagoras'){
    await page.locator('.object-overlay polygon').click();assert.match(await page.locator('[data-testid=details]').textContent(),/直角三角形/)
   }else if(id==='tcp'){
    await page.locator(`[data-device="${object}"]`).click();assert(await page.locator('[data-testid=details]').isVisible())
   }else{
    await page.locator(`.business-node[data-object="${object}"]`).click();assert(await page.locator('[data-testid=details]').isVisible())
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${id} ${width}`)
   if(width!==320)await page.screenshot({path:`docs/evidence/regression-${id}-${width}.png`,fullPage:true})
   results.push({course:id,width,timeMs:await time(),controls:'passed',sameTimeDomAndDetails:'passed'})
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[])
 writeFileSync('docs/evidence/regression-browser.json',JSON.stringify({result:'passed',browser:await browser.version(),pageErrors:errors,consoleWarnings:warnings,results},null,2)+'\n')
 console.log('PASS S02 browser: four courses × three widths; controls, reverse DOM state, details, SVG/KaTeX/image/Flow; 8 screenshots')
}finally{await browser.close()}
