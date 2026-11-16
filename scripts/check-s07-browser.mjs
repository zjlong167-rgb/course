import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const origin=process.env.BROWSER_BASE_URL||'http://127.0.0.1:5173',api=origin+'/api/v1'
const browser=await chromium.launch({channel:'chrome'}),admin=await browser.newContext(),ctx=await browser.newContext()
const p=await ctx.newPage(),errors=[],checks=[],courses=[]
p.on('pageerror',e=>errors.push(String(e)))
const json=async(r,status=200)=>{assert.equal(r.status(),status,await r.text());return r.json()}
const player=p.locator('.shared-player'),button=n=>p.getByRole('button',{name:n,exact:true}),time=async()=>Number(await player.getAttribute('data-time'))
const open=async(c)=>{await p.goto(origin+'/#/published?slug='+c.slug);await player.waitFor()}
const seek=async n=>{await p.getByRole('slider',{name:'时间跳转'}).fill(String(n));await p.waitForFunction(t=>document.querySelector('.shared-player')?.getAttribute('data-time')===String(t),n)}
const saved=async c=>{await p.waitForFunction(key=>localStorage.getItem(key)!==null,'course-learning:v1:'+c.slug);return p.evaluate(key=>JSON.parse(localStorage.getItem(key)),'course-learning:v1:'+c.slug)}
try{
const login=await json(await admin.request.post(api+'/auth/login',{data:JSON.parse(fs.readFileSync('.local/s03-test-credentials.json','utf8').replace(/^\uFEFF/,''))})),headers={'X-CSRF-Token':login.csrfToken}
const asset=(await json(await admin.request.post(api+'/assets',{headers,multipart:{file:{name:'station.png',mimeType:'image/png',buffer:fs.readFileSync('samples/assets/station.png')}}}),201)).id
for(const name of ['tcp','expense','pythagoras','production']){
 const body=JSON.parse(fs.readFileSync('samples/valid/'+name+'.json','utf8').replaceAll('station-image',asset));body.title='S07 '+body.title+' '+Date.now()
 if(name==='tcp'){
 const scene=structuredClone(body.chapters[0].scenes[0]);function rename(value){if(!value||typeof value!=='object')return;for(const [k,v] of Object.entries(value)){if(['id','target','source'].includes(k)&&typeof v==='string')value[k]='extra-'+v;else rename(v)}}rename(scene);body.chapters[0].scenes.push(scene)
 }
 const {id}=await json(await admin.request.post(api+'/courses',{headers,data:{body}}),201)
 const path=api+'/courses/'+id
 const version=(await json(await admin.request.post(path+'/publish',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{revision:'1'}}))).versionId
 const {slug}=await json(await admin.request.get(path+'/versions'))
 courses.push({name,id,slug,body,version,path})
}
fs.writeFileSync('docs/evidence/s07-courses.json',JSON.stringify(courses.map(({body,path,...x})=>x),null,2))
for(const c of courses){
 await p.goto(origin+'/#/catalog');await p.getByLabel('课程分类').selectOption(c.body.category);await p.getByLabel('搜索课程').fill(c.body.title)
 await p.getByRole('link',{name:new RegExp(c.body.title)}).click();await player.waitFor();assert.equal(await time(),0)
 await button('播放').click();await p.waitForTimeout(250);await button('暂停').click();assert.ok(await time()>0)
 await p.getByRole('combobox',{name:c.name==='tcp'?'播放速度':'播放倍速',exact:true}).selectOption('2')
 await button('下一步').click();assert.ok(await time()>0);await button('回退').click()
 await seek(1234);await button('标记本场景已复习').click();await p.reload();await player.waitFor();assert.equal(await time(),1234);assert.equal(await player.getAttribute('data-playing'),'false');assert.ok(await button('取消本场景已复习').isVisible())
 const picker=p.getByRole('combobox',{name:'选择对象',exact:true});await picker.selectOption(c.body.chapters[0].scenes[0].objects.find(o=>o.type!=='edge').id);await p.getByTestId('details').waitFor()
 for(const width of [1440,900,390,320]){await p.setViewportSize({width,height:900});await p.waitForTimeout(120);assert.ok(await p.getByTestId('narration').first().isVisible());assert.ok(await button('下一步').isVisible());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+c.name+' '+width);await p.screenshot({path:`docs/evidence/s07-${c.name}-${width}.png`,fullPage:true})}
 await button('重置').click();assert.equal(await time(),0)
 await seek(1234);await p.waitForTimeout(550);await saved(c)
 checks.push(c.name+': catalog/category/detail/controls/details/restore/4 viewports')
}
const c=courses[0];await open(c);assert.equal(await time(),1234)
await p.getByLabel('章节 / 场景').selectOption('1');assert.equal(await time(),0);assert.equal(await player.getAttribute('data-playing'),'false');await seek(2222);await p.waitForTimeout(550);await p.reload();await player.waitFor();assert.equal(await time(),2222)
await p.getByLabel('章节 / 场景').selectOption('0');assert.equal(await time(),0)
await seek(1234);await p.waitForTimeout(550)
// Actual metadata-only republish keeps scene byte structure. Draft metadata must stay private.
let updated=structuredClone(c.body);updated.title+=' 第二版'
await json(await admin.request.put(c.path+'/draft',{headers,data:{revision:'1',body:updated}}))
await p.reload();await player.waitFor();assert.equal(await p.locator('.student-detail h1').textContent(),c.body.title)
await json(await admin.request.post(c.path+'/publish',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{revision:'2'}}))
await button('刷新当前发布版本').click();await player.waitFor();assert.equal(await time(),1234);assert.ok((await p.locator('.student-progress').textContent()).includes('发布版本已变化'))
await seek(1400);await p.waitForTimeout(550)
await json(await admin.request.post(c.path+'/rollback',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{versionId:c.version,reason:'S07 进度回滚验收'}}))
await button('刷新当前发布版本').click();await player.waitFor();assert.equal(await time(),1400)
updated.chapters[0].scenes[0].objects[0].id='changed-device';// replace references too
updated=JSON.parse(JSON.stringify(updated).replaceAll('"'+c.body.chapters[0].scenes[0].objects[0].id+'"','"changed-device"'))
await json(await admin.request.put(c.path+'/draft',{headers,data:{revision:'2',body:updated}}))
await json(await admin.request.post(c.path+'/publish',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{revision:'3'}}))
await button('刷新当前发布版本').click();await player.waitFor();assert.equal(await time(),0);assert.ok((await p.locator('.student-progress').textContent()).includes('已失效'))
await seek(999);await p.waitForTimeout(550)
await json(await admin.request.post(c.path+'/rollback',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{versionId:c.version,reason:'S07 恢复原版'}}))
await button('刷新当前发布版本').click();await player.waitFor();assert.equal(await time(),0)
checks.push('scene navigation; real republish metadata migration, draft isolation, rollback, object ID invalidation, changed-content rollback invalidation')
await button('清除本课程学习记录').click();await p.waitForTimeout(600);assert.equal(await p.evaluate(k=>localStorage.getItem(k),'course-learning:v1:'+c.slug),null)
await p.evaluate(k=>localStorage.setItem(k,'{bad'),'course-learning:v1:'+c.slug);await p.reload();await player.waitFor();assert.equal(await time(),0);assert.ok((await p.locator('.student-progress').textContent()).includes('记录损坏'))
assert.equal((await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),'course-learning:v1:'+courses[1].slug)).timeMs,1234)
const blocked=await browser.newContext();await blocked.addInitScript(({production})=>{for(const key of ['getItem','setItem','removeItem']){const original=Storage.prototype[key];Storage.prototype[key]=function(...args){if(production||String(args[0]).startsWith('course-learning:'))throw Error('blocked');return original.apply(this,args)}}},{production:origin.includes(':5174')});const bp=await blocked.newPage();await bp.goto(origin+'/#/published?slug='+c.slug);await bp.locator('.shared-player').waitFor();assert.ok((await bp.locator('.student-progress').textContent()).includes('存储不可用'));await bp.getByRole('button',{name:'下一步',exact:true}).click();await bp.waitForTimeout(600);await blocked.close()
// Deterministic error injection around actual published routes, no fake successful courses.
await p.route('**/api/v1/public/courses',r=>r.fulfill({status:503,body:'{}'}));await p.goto(origin+'/#/catalog');await p.getByRole('alert').waitFor();await p.unroute('**/api/v1/public/courses');await button('重试').click();await p.locator('.student-card').first().waitFor()
await p.getByLabel('搜索课程').fill('no-match-unique');await p.getByText('没有符合条件的课程，请调整搜索或分类。').waitFor()
await p.route('**/api/v1/public/courses',r=>r.fulfill({json:{courses:[]}}));await button('刷新目录').click();await p.getByText('暂无已发布课程，请稍后再来。').waitFor();await p.unroute('**/api/v1/public/courses')
await p.goto(origin+'/#/published?slug=does-not-exist');await p.getByRole('alert').waitFor()
await p.route('**/api/v1/public/courses/'+c.slug,r=>r.fulfill({status:503,body:'{}'}));await p.goto(origin+'/#/published?slug='+c.slug);await p.getByRole('alert').waitFor();await p.unroute('**/api/v1/public/courses/'+c.slug);await button('重试').click();await player.waitFor()
const prod=courses[3];await p.route('**/api/v1/public/courses/'+prod.slug+'/versions/*/assets/*',r=>r.abort());await open(prod);await p.getByRole('alert').waitFor();assert.ok((await p.getByRole('alert').textContent()).includes('图片加载失败'))
checks.push('clear; damaged and denied storage; cross-course isolation; catalog empty/failure/no-match; 404 and course failure/retry; resource failure')
assert.deepEqual(errors,[])
fs.writeFileSync('docs/evidence/s07-browser.json',JSON.stringify({result:'passed',browser:await browser.version(),viewportSimulation:true,realDevice:false,courses:courses.map(({name,id,slug})=>({name,id,slug})),checks,errors},null,2))
console.log('PASS',checks)
}finally{await browser.close()}
