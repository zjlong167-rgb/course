import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const origin=process.env.BROWSER_BASE_URL || 'http://127.0.0.1:5173'
const api=origin+'/api/v1'
const credentials=JSON.parse(fs.readFileSync('.local/s03-test-credentials.json','utf8').replace(/^\uFEFF/,''))
const browser=await chromium.launch({channel:'chrome'})
const studio=await browser.newContext(),publicSite=await browser.newContext()
const p=await studio.newPage(),learner=await publicSite.newPage(),errors=[]
for(const page of [p,learner]) page.on('pageerror',e=>errors.push(String(e)))
const btn=name=>p.getByRole('button',{name,exact:true})
const snapshot=async(res,status=200)=>{assert.equal(res.status(),status,await res.text());return res.json()}
const station=fs.readFileSync('samples/assets/station.png')
try{
 const login=await snapshot(await studio.request.post(api+'/auth/login',{data:credentials}))
 const headers={'X-CSRF-Token':login.csrfToken}
 async function upload(){return (await snapshot(await studio.request.post(api+'/assets',{headers,multipart:{file:{name:'station.png',mimeType:'image/png',buffer:station}}}),201)).id}
 const old=await upload(),replacement=await upload(),privateAsset=await upload()
 const body=JSON.parse(fs.readFileSync('samples/valid/production.json','utf8').replaceAll('station-image',old))
 body.title='S06 工位 · '+Date.now()
 const {id}=await snapshot(await studio.request.post(api+'/courses',{data:{body},headers}),201)
 const path=api+'/courses/'+id
 const history=()=>studio.request.get(path+'/versions').then(r=>snapshot(r))
 const {slug}=await history()
 const pub=api+'/public/courses/'+slug
 const catalog=async()=>(await snapshot(await publicSite.request.get(api+'/public/courses'))).courses.find(c=>c.slug===slug)
 assert.equal(await catalog(),undefined)
 assert.equal((await publicSite.request.get(pub)).status(),404)
 assert.equal((await publicSite.request.get(path+'/versions')).status(),401)
 assert.equal((await publicSite.request.get(path+'/draft')).status(),401)
 await p.goto(origin+'/#/studio')
 await btn(body.title+' · #'+id).click()
 await p.getByText('发布与版本',{exact:true}).click()
 const keys=[]
 const publishURL=path+'/publish'
 await p.route(publishURL,async route=>{
  keys.push(route.request().headers()['idempotency-key'])
  if(keys.length===1){
   // Commit on the real server, then lose its response on the way to the tab.
   assert.equal((await route.fetch()).status(),200)
   await route.abort('failed')
  }else await route.continue()
 })
 await btn('发布已保存修订 1').click()
 await p.waitForFunction(()=>document.querySelector('.studio-message')?.textContent.includes('fetch'))
 await btn('发布已保存修订 1').click()
 await p.getByText(/已发布版本 #/).waitFor()
 assert.equal(keys.length,2);assert.equal(keys[0],keys[1])
 await p.unroute(publishURL)
 const first=(await history()).currentVersionId
 const other=await snapshot(await studio.request.post(api+'/courses',{headers,data:{body}}),201)
 const cross=await studio.request.post(api+'/courses/'+other.id+'/rollback',{headers:{...headers,'Idempotency-Key':crypto.randomUUID()},data:{versionId:first,reason:'跨课引用检查'}})
 assert.equal(cross.status(),404)
 const initial=await publicSite.request.get(pub),etag=initial.headers().etag
 assert.equal(etag,'"'+first+'"');assert.equal(initial.headers()['cache-control'],'no-cache')
 assert.deepEqual((await snapshot(initial)).body,body)
 assert.equal((await publicSite.request.get(pub,{headers:{'If-None-Match':etag}})).status(),304)
 const updated=JSON.parse(JSON.stringify(body).replaceAll(old,replacement))
 updated.title+=' · 第二版';updated.summary='新说明';updated.category='business'
 await snapshot(await studio.request.put(path+'/draft',{headers,data:{revision:'1',body:updated}}))
 assert.deepEqual((await snapshot(await publicSite.request.get(pub))).body,body)
 assert.equal((await catalog()).title,body.title)
 await btn('重新打开').click()
 await btn('发布已保存修订 2').click()
 await btn('预览 v2').waitFor()
 const second=(await history()).currentVersionId
 assert.notEqual(second,first)
 const newRes=await publicSite.request.get(pub,{headers:{'If-None-Match':etag}})
 assert.deepEqual((await snapshot(newRes)).body,updated)
 const meta=await catalog();for(const k of ['title','summary','category'])assert.equal(meta[k],updated[k])
 const asset=(ver,ref)=>pub+'/versions/'+ver+'/assets/'+ref
 for(const url of [asset(first,old),asset(second,old),asset(second,privateAsset)])assert.equal((await publicSite.request.get(url)).status(),404)
 const image=await publicSite.request.get(asset(second,replacement))
 assert.equal(image.headers()['cache-control'],'private, no-store');assert.deepEqual(await image.body(),station)
 await btn('预览 v1').click()
 await p.locator('.studio-preview .shared-player').waitFor()
 const href=await p.locator('.studio-preview image').first().getAttribute('href')
 assert.ok(href.endsWith('/versions/'+first+'/assets/'+old));assert.deepEqual(await (await studio.request.get(origin+href)).body(),station)
 assert.equal((await publicSite.request.get(origin+href)).status(),401)
 await p.getByLabel('回滚目标').selectOption(first);await p.getByLabel('回滚原因').fill('恢复首版工位素材')
 await btn('确认回滚').click();await p.getByText('已回滚至版本 #'+first).waitFor()
 const final=await history();assert.equal(final.currentVersionId,first);assert.equal(final.versions.length,2);assert.equal(final.operations.length,3)
 assert.equal(final.operations.at(-1).reason,'恢复首版工位素材')
 assert.deepEqual(await snapshot(await studio.request.get(path+'/draft')),{body:updated,revision:'2'})
 const restored=await publicSite.request.get(pub,{headers:{'If-None-Match':newRes.headers().etag}})
 assert.deepEqual((await snapshot(restored)).body,body);assert.equal((await catalog()).title,body.title)
 const pageUrl=await p.getByRole('link',{name:'打开公开课程'}).getAttribute('href')
 const loaded=learner.waitForResponse(r=>r.url()===asset(first,old)&&r.status()===200)
 await learner.goto(origin+'/'+pageUrl);await learner.locator('.shared-player').waitFor();await loaded
 await learner.getByRole('button',{name:'下一步',exact:true}).click();assert.ok(Number(await learner.locator('.shared-player').getAttribute('data-time'))>0)
 assert.deepEqual(errors,[])
 const evidence={result:'passed',browser:await browser.version(),id,slug,first,second,finalPointer:first,draftRevision:'2',auditEntries:3,lostResponseRetried:true,crossCourseRollback:404,errors}
 fs.writeFileSync('docs/evidence/s06-browser.json',JSON.stringify(evidence,null,2)+'\n')
 console.log('PASS publish/republish/history/rollback, cache, metadata, protected resources and anonymous playback',id)
}finally{await browser.close()}

