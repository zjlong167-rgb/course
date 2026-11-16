import assert from 'node:assert/strict'
import fs from 'node:fs'
import {instantiate} from '../frontend/src/editor/templates.ts'
import {validateCourse} from '../contracts/validate.mjs'
const read=n=>JSON.parse(fs.readFileSync('samples/valid/'+n+'.json'))
function entities(c){return [c,...c.chapters.flatMap(ch=>[ch,...ch.scenes.flatMap(s=>[s,...s.objects,...s.steps.flatMap(st=>[st,...st.actions])])])]}
for(const name of ['tcp','expense','pythagoras','production']){
 const src=read(name),args=[src,'asset-123'],a=instantiate(...args),b=instantiate(...args)
 const entitiesA=entities(a),entitiesSrc=entities(src)
 const ids=[...entitiesA,...entitiesSrc,...entities(b)].map(e=>e.id)
 assert.equal(new Set(ids).size,ids.length)
 assert.deepEqual(validateCourse(a),[])
 const map=new Map(entitiesSrc.map((e,i)=>[e.id,entitiesA[i].id]))
 const s=a.chapters[0].scenes[0],original=src.chapters[0].scenes[0]
 for(const [i,o] of s.objects.entries()){
   const old=original.objects[i].content
   for(const key of ['source','target']){
     if(old[key])assert.equal(o.content[key],map.get(old[key]))
     if(old.packet)assert.equal(o.content.packet[key],map.get(old.packet[key]))
   }
 }
 for(const [i,step] of s.steps.entries())for(const [j,action] of step.actions.entries())
   assert.equal(action.target,map.get(original.steps[i].actions[j].target))
 const before=JSON.stringify(b)
 s.objects[0].content.label='changed'
 assert.equal(JSON.stringify(b),before);assert.deepEqual(src,read(name))
}
assert.throws(()=>instantiate(read('production')),/图片/)
assert.deepEqual(validateCourse(instantiate()),[])
const c=instantiate(read('tcp')),a=c.chapters[0].scenes[0].steps[0].actions[0]
a.target='unknown';assert(validateCourse(c).some(e=>e.startsWith('/chapters/0/scenes/0/steps/0/actions/0/target:')))
a.type='move';a.params={x:100001,y:0};assert(validateCourse(c).some(e=>e.startsWith('/chapters/0/scenes/0/steps/0/actions/0/params/x:')))
console.log('PASS blank, four isolated templates, all entity IDs and exact endpoints/targets, production resource requirement, parameter and reference pointers')
