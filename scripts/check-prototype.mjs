import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
mkdirSync('docs/evidence',{recursive:true})
const browser=await chromium.launch({headless:true,...(process.env.PROTOTYPE_BROWSER_CHANNEL ? {channel:process.env.PROTOTYPE_BROWSER_CHANNEL} : {})})
const page=await browser.newPage()
const errors=[]; page.on('pageerror',e=>errors.push(e.message))
const evidence=[]
try {
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000})
  for(const name of ['courses','editor','objects','steps','preview','versions','formula']) {
   await page.goto(`http://127.0.0.1:5173/#/${name}`)
   await page.locator('h1').waitFor()
   await page.evaluate(()=>document.fonts.ready)
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflows at ${width}`)
   if(name==='formula') {
    for(let i=0;i<4;i++) {
     await page.getByRole('button',{name:['01 面积分解','02 展开等式','03 勾股定理','04 数值验证'][i]}).click()
     assert.equal(await page.locator('.katex').count(),1)
     assert.equal(await page.locator('math').count(),1)
     assert.equal(await page.locator('.katex-error').count(),0)
     const annotation=await page.locator('annotation').textContent()
     evidence.push({width,step:i+1,tex:annotation})
    }
    await page.getByRole('button',{name:'重置',exact:true}).click()
    assert.match(await page.locator('annotation').textContent(),/a\+b/)
   }
   if(width!==320) await page.screenshot({path:`docs/evidence/${name}-${width}.png`,fullPage:true})
  }
 }
 assert.deepEqual(errors,[])
 writeFileSync('docs/evidence/prototype-results.json',JSON.stringify({browser:await browser.version(),viewports:[1440,390,320],pages:7,formulaChecks:evidence,pageErrors:errors,result:'passed'},null,2)+'\n')
 console.log('PASS: 7 pages × 3 widths; 12 formula states, MathML, reset, no overflow or page errors; 14 screenshots')
} finally {await browser.close()}
