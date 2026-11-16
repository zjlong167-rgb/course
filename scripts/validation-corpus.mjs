import fs from 'node:fs'
import assert from 'node:assert/strict'
import {validateCourse} from '../contracts/validate.mjs'
const base=JSON.parse(fs.readFileSync(new URL('../samples/valid/tcp.json',import.meta.url)))
const cases=[]
function add(name,change,valid=false){const body=structuredClone(base);change(body);assert.equal(validateCourse(body).length===0,valid,name);cases.push({name,body,valid})}
for(const file of fs.readdirSync(new URL('../samples/valid/',import.meta.url))) {const body=JSON.parse(fs.readFileSync(new URL('../samples/valid/'+file,import.meta.url)));cases.push({name:file,body,valid:true})}
for(const file of fs.readdirSync(new URL('../samples/invalid/',import.meta.url))) {const body=JSON.parse(fs.readFileSync(new URL('../samples/invalid/'+file,import.meta.url)));cases.push({name:file,body,valid:false})}
const scene=b=>b.chapters[0].scenes[0],packet=b=>scene(b).objects.find(o=>o.content.packet)
add('unsupported version',b=>b.components[0].version='1.9.0')
add('duplicate component',b=>b.components.push(b.components[0]))
add('duplicate asset',b=>b.assets.push({id:'asset-1',purpose:'x'},{id:'asset-1',purpose:'x'}))
add('invalid id',b=>b.id='../bad')
add('chapter duplicate',b=>b.chapters[0].id=b.id)
add('object component',b=>scene(b).objects[0].component='formula')
add('missing component',b=>b.components=[])
add('visual object kind',b=>scene(b).objects[0].type='packet')
add('network version',b=>b.components.find(c=>c.type==='flow').version='1.0.0')
add('packet endpoint',b=>packet(b).content.packet.target='missing')
add('packet endpoint type',b=>scene(b).objects.find(o=>o.id===packet(b).content.packet.target).type='text')
add('ACK missing',b=>{const p=packet(b).content.packet;p.flags='ACK';delete p.ack})
add('packet object kind',b=>packet(b).type='node')
add('edge endpoint',b=>scene(b).objects.find(o=>o.type==='edge').content.target='missing')
add('action target',b=>scene(b).steps[0].actions[0].target='missing')
add('action overflow',b=>scene(b).steps[0].actions[0].atMs=86400000)
add('discrete duration',b=>{const a=scene(b).steps[0].actions.find(a=>a.type!=='move');a.durationMs=1})
add('formula missing tex',b=>{const o=scene(b).objects[0];o.type='formula';o.component='formula';delete o.content.visual})
add('geometry missing points',b=>{const o=scene(b).objects[0];o.type='geometry';o.component='geometry';delete o.content.visual})
add('image missing asset',b=>{const o=scene(b).objects[0];o.type='image';o.component='annotation';o.content={label:'x',assetId:'missing'}})
process.stdout.write(JSON.stringify(cases))
