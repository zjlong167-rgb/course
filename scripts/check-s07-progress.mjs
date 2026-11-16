import assert from 'node:assert/strict'
import fs from 'node:fs'
import {restore,signature} from '../frontend/src/player/progress.ts'
const course=JSON.parse(fs.readFileSync('samples/valid/tcp.json','utf8')),id=course.chapters[0].scenes[0].id
const record={schema:1,versionId:'1',sceneId:id,timeMs:1500,signature:signature(course,id),reviewed:[id],updatedAt:new Date().toISOString()},raw=JSON.stringify(record)
assert.equal(restore(raw,course,'1').position.timeMs,1500)
assert.deepEqual(restore(raw,course,'2').reviewed,[])
assert.equal(restore(raw,course,'2').position.timeMs,1500)
for(const mutate of [c=>c.chapters[0].scenes[0].id='new-scene',c=>c.chapters[0].scenes[0].objects[0].id='new-object',c=>c.chapters[0].scenes[0].steps[0].id='new-step',c=>c.chapters[0].scenes[0].steps[0].durationMs+=10,c=>c.chapters[0].scenes[0].steps[0].narration+='changed']){const c=structuredClone(course);mutate(c);assert.equal(restore(raw,c,'2').position.timeMs,0)}
for(const invalid of ['{bad','null','{}',JSON.stringify({...record,timeMs:-1}),JSON.stringify({...record,timeMs:999999}),JSON.stringify({...record,timeMs:1.5}),JSON.stringify({...record,reviewed:[null]})])assert.equal(restore(invalid,course,'1').position.timeMs,0)
assert.equal(restore(null,course,'1').position.timeMs,0)
fs.writeFileSync('docs/evidence/s07-progress.json',JSON.stringify({result:'passed',cases:16,rules:['same version restore','unchanged scene migrate across publish or rollback, clear review flags','scene/object/step/content/duration changed invalidate','malformed records ignored']},null,2))
console.log('PASS progress migration and malformed storage')
