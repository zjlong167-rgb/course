import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const credentials=JSON.parse(fs.readFileSync('.local/s03-test-credentials.json','utf8').replace(/^\uFEFF/,''))
const browser=await chromium.launch({headless:true,channel:'chrome'})
const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[],results=[]
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)))
page.on('pageerror',e=>errors.push(e.message))
const base='http://127.0.0.1:5173',button=(p,n)=>p.getByRole('button',{name:n,exact:true})
const status=p=>p.locator('.studio-message')
const json=p=>p.getByLabel('课程 JSON',{exact:true})
async function settled(p){await p.waitForFunction(()=>![...document.querySelectorAll('button')].some(b=>b.textContent==='保存草稿'&&b.disabled))}
async function save(p){await button(p,'保存草稿').click();await p.waitForFunction(()=>document.querySelector('.studio-message')?.textContent.includes('已保存'))}
try {
 await page.goto(base+'/#/studio');await page.getByRole('textbox',{name:'账号',exact:true}).fill(credentials.username);await page.getByRole('textbox',{name:'密码',exact:true}).fill(credentials.password);await button(page,'登录').click();await button(page,'创建课程').waitFor()
 // real file upload; no production asset is served by a development alias.
 await page.getByLabel('上传资源',{exact:true}).setInputFiles({name:'station.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC1sAAAAASUVORK5CYII=','base64')})
 await page.waitForFunction(()=>document.querySelector('.studio-message')?.textContent.includes('资源已保存'))
 for(let i=0;i<4;i++){
  await page.getByRole('combobox',{name:'建课起点'}).selectOption(String(i));await button(page,'创建课程').click();await page.waitForFunction(()=>document.querySelector('.studio-message')?.textContent.includes('课程已创建'))
  const title='S03-'+Date.now()+'-'+i;await page.getByRole('textbox',{name:'课程标题',exact:true}).fill(title);await save(page)
  await button(page,'重新打开').click();await page.waitForFunction(()=>document.querySelector('.studio-message')?.textContent.includes('已从数据库'))
  assert.equal(await page.getByRole('textbox',{name:'课程标题',exact:true}).inputValue(),title)
  await button(page,'授权预览').click();await page.locator('.shared-player').waitFor();await settled(page)
  const root=page.locator('.shared-player');await page.getByRole('combobox',{name:'选择对象'}).selectOption({index:1})
  const speed=page.getByRole('combobox',{name:i===0?'播放速度':'播放倍速',exact:true});await speed.selectOption('2')
  await button(page,'播放').click();await page.waitForTimeout(250);await button(page,'暂停').click();assert(Number(await root.getAttribute('data-time'))>150)
  await button(page,'重置').click();assert.equal(await root.getAttribute('data-time'),'0')
  if(i===3){const src=await page.locator('image').getAttribute('href');const res=await context.request.get(base+src);assert.equal(res.status(),200);assert.equal(res.headers()['content-type'],'image/png')}
  results.push({course:i,createSaveReopenPreviewSpeed:'passed'})
 }
 // Editing during a pending save must remain dirty after the older request completes.
 await page.route('**/api/v1/courses/*/draft',async route=>{if(route.request().method()==='PUT'){const response=await route.fetch();await new Promise(r=>setTimeout(r,400));await route.fulfill({response})}else await route.continue()})
 await page.getByRole('textbox',{name:'课程标题',exact:true}).fill('已发送-'+Date.now());await button(page,'保存草稿').click();await page.getByRole('textbox',{name:'课程标题',exact:true}).fill('请求期间继续输入-'+Date.now());await page.waitForFunction(()=>document.querySelector('.studio-message')?.textContent.includes('已保存'));assert.match(await page.locator('.studio-toolbar').textContent(),/未保存/);await page.unroute('**/api/v1/courses/*/draft');await save(page);results.push({inFlightEdit:'later edits remain dirty and can be saved'})
 // Two tabs load same persisted revision; stale save must retain local content.
 const currentTitle=await page.getByRole('textbox',{name:'课程标题',exact:true}).inputValue()
 const second=await context.newPage();await second.goto(base+'/#/studio');await second.getByRole('button',{name:new RegExp(currentTitle)}).click();await json(second).waitFor({state:'attached'})
 await page.getByRole('textbox',{name:'课程标题',exact:true}).fill('服务器修改');await save(page)
 await second.getByRole('textbox',{name:'课程标题',exact:true}).fill('本地冲突保留');const local=await json(second).inputValue();await button(second,'保存草稿').click();await second.locator('.studio-conflict').waitFor();assert.equal(await json(second).inputValue(),local);assert.match(await second.locator('.studio-conflict').textContent(),/服务器修改/)
 await second.screenshot({path:'docs/evidence/s03-conflict.png',fullPage:true})
 await button(second,'已手工合并，采用最新修订').click();await save(second);await button(second,'重新打开').click();await settled(second);assert.equal(await second.getByRole('textbox',{name:'课程标题',exact:true}).inputValue(),'本地冲突保留')
 results.push({twoTabs:'409 retained local, compared latest, explicit merged save, reopen passed'})
 // Build a valid multi-chapter, multi-scene draft through the actual authoring surface.
 let body=JSON.parse(await json(second).inputValue());const original=body.chapters[0].scenes[0]
 function cloneScene(s,prefix){const copy=structuredClone(s),ids=new Map();for(const x of [copy,...copy.objects,...copy.steps,...copy.steps.flatMap(s=>s.actions)])ids.set(x.id,prefix+x.id);const walk=v=>typeof v==='string'?(ids.get(v)||v):Array.isArray(v)?v.map(walk):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)])):v;return walk(copy)}
 body.chapters[0].scenes.push(cloneScene(original,'second-'));body.chapters.push({id:'chapter-two',title:'第二章节',scenes:[cloneScene(original,'third-')]});await second.getByText('高级：JSON 检查与冲突手工合并',{exact:true}).click();await json(second).fill(JSON.stringify(body,null,2));await save(second);await button(second,'授权预览').click();await second.getByRole('combobox',{name:'章节 / 场景',exact:true}).waitFor();await second.getByRole('combobox',{name:'选择对象'}).selectOption({index:1});await second.getByRole('slider',{name:'时间跳转'}).fill('3000');await button(second,'播放').click()
 for(const option of ['1','2','0']){await second.getByRole('combobox',{name:'章节 / 场景',exact:true}).selectOption(option);await second.waitForTimeout(80);assert.equal(await second.locator('.shared-player').getAttribute('data-time'),'0');assert.equal(await second.locator('.shared-player').getAttribute('data-playing'),'false');assert.equal(await second.getByRole('combobox',{name:'选择对象'}).evaluate(e=>e.selectedIndex),0)}
 await second.screenshot({path:'docs/evidence/s03-studio.png',fullPage:true});results.push({navigation:'3 scenes / 2 chapters clear time, playing, selection'})
 await second.reload();await second.getByRole('button',{name:/本地冲突保留/}).last().click();await json(second).waitFor({state:'attached'});assert.equal(JSON.parse(await json(second).inputValue()).chapters.length,2)
 await button(second,'登出').click();await second.getByRole('textbox',{name:'账号',exact:true}).waitFor();assert.equal(await second.locator('.shared-player').count(),0)
 const unauth=await context.request.get(base+'/api/v1/courses/1/preview');assert.equal(unauth.status(),401)
 results.push({refreshLogout:'DB restored chapters; logout revokes preview'})
 await page.goto(base+'/#/prototype');await page.locator('.shared-player').waitFor();await page.getByRole('combobox',{name:'选择对象'}).selectOption('syn');await button(page,'播放').click();await page.waitForTimeout(120);await page.locator('.sample-tabs').getByRole('button',{name:/报销审批/}).click();await page.waitForTimeout(50);assert.equal(await page.locator('.shared-player').getAttribute('data-time'),'0');assert.equal(await page.getByRole('combobox',{name:'选择对象'}).evaluate(e=>e.selectedIndex),0);await page.locator('.sample-tabs').getByRole('button',{name:/TCP/}).click();assert.equal(await page.locator('.shared-player').getAttribute('data-playing'),'false');results.push({courseSwitch:'playing course changed; clock and selection cleared'})
 assert.deepEqual(errors,[])
 fs.writeFileSync('docs/evidence/s03-studio-browser.json',JSON.stringify({result:'passed',browser:await browser.version(),errors,results},null,2))
 console.log('PASS S03 actual browser authoring / persistence / assets / conflict / navigation / auth')
} finally {await browser.close()}
