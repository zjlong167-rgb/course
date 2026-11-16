import {request} from 'playwright'
import fs from 'node:fs'
import assert from 'node:assert/strict'
const credentials=JSON.parse(fs.readFileSync('.local/s03-test-credentials.json','utf8').replace(/^\uFEFF/,'')),baseURL='http://127.0.0.1:8080/api/v1'
const client=await request.newContext({baseURL}),anon=await request.newContext({baseURL})
try{
const url=p=>baseURL+p
const login=await client.post(url('/auth/login'),{data:credentials});assert.equal(login.status(),200);const csrf=(await login.json()).csrfToken,headers={'X-CSRF-Token':csrf}
if(process.argv.includes('--restore')){
 const saved=JSON.parse(fs.readFileSync('.local/s03-snapshot.json','utf8'));const res=await client.get(url('/courses/'+saved.id+'/draft'));assert.equal(res.status(),200);assert.deepEqual(await res.json(),saved.draft);const resource=await client.get(url('/assets/'+saved.asset));assert.equal(resource.status(),200);assert.equal((await resource.body()).toString('base64'),saved.bytes)
 fs.writeFileSync('docs/evidence/s03-restart.json',JSON.stringify({result:'passed',courseId:saved.id,revision:saved.draft.revision,bodyRestored:true,assetBytesRestored:true},null,2));console.log('PASS persisted body/revision/asset bytes after API restart')
}else{
 const courses=(await (await client.get(url('/courses'))).json()).courses;const id=courses.at(-1).id;const draft=await (await client.get(url('/courses/'+id+'/draft'))).json();const asset=draft.body.assets[0].id
 for(const p of ['/courses','/courses/'+id+'/draft','/courses/'+id+'/preview','/assets/'+asset])assert.equal((await anon.get(url(p))).status(),401,p)
 for(const [method,p,data] of [['post','/courses',{body:draft.body}],['put','/courses/'+id+'/draft',draft],['post','/courses/'+id+'/validate',{body:draft.body}]])assert.equal((await anon[method](url(p),{data})).status(),401,p)
 assert.equal((await client.put(url('/courses/'+id+'/draft'),{data:draft})).status(),403)
 const bad=structuredClone(draft);bad.body.assets[0].id='asset-999999999';assert.equal((await client.put(url('/courses/'+id+'/draft'),{headers,data:bad})).status(),422)
 assert.equal((await client.post(url('/assets'),{headers,multipart:{file:{name:'fake.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"/>')}}})).status(),422)
 assert.equal((await client.post(url('/assets'),{headers,multipart:{file:{name:'big.png',mimeType:'image/png',buffer:Buffer.alloc(10*1024*1024+1)}}})).status(),413)
 const res=await client.get(url('/assets/'+asset));assert.equal(res.status(),200);assert.equal(res.headers()['x-content-type-options'],'nosniff');assert.equal(res.headers()['cache-control'],'private, no-store');const bytes=(await res.body()).toString('base64')
 assert.equal((await client.get(url('/courses/'+id+'/preview'))).headers()['cache-control'],'private, no-store')
 const after=await (await client.get(url('/courses/'+id+'/draft'))).json();assert.deepEqual(after,draft)
 fs.writeFileSync('.local/s03-snapshot.json',JSON.stringify({id,draft,asset,bytes}));fs.writeFileSync('docs/evidence/s03-api.json',JSON.stringify({result:'passed',anonymousReadsAndWrites:'401',csrf:'403',invalidResource:'422 and draft unchanged',spoofedType:'422',oversize:'413',assetHeaders:'nosniff + private no-store',preview:'private no-store',courseId:id},null,2));console.log('PASS real HTTP auth, resource references, invalid MIME, upload limit, no-store')
}
}finally{await client.dispose();await anon.dispose()}
