import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {rebuild,LogicalClock,duration} from '../frontend/src/player/engine.ts'
import {assertRegistered,toFlow,formulaTex} from '../frontend/src/player/registry.ts'
const json=p=>JSON.parse(readFileSync(p,'utf8'))
const fixture=json('contracts/playback-cases.json')
const initial={visible:true,highlight:false,status:'idle'}
const object={id:'p',type:'node',component:'flow',position:{x:0,y:0},size:{width:100,height:60},initial,content:{label:'P'},details:{}}
const scene={id:'test',title:'test',canvas:{width:960,height:540},objects:[object],steps:fixture.steps.map((s,i)=>({...s,id:`s${i}`,title:'s',narration:'n',actions:s.actions.map((a,j)=>({...a,id:`a${i}-${j}`,target:'p'}))}))}
let checks=0
for(const expected of fixture.expected){const result=rebuild(scene,expected.timeMs);assert.equal(result.states.p.position.x,expected.x);assert.equal(result.states.p.visible,expected.visible);assert.equal(result.states.p.status,expected.status);assert.equal(result.stepIndex,expected.stepIndex);checks++}
for(const order of fixture.seekOrders)for(const t of order)assert.deepEqual(rebuild(scene,t),rebuild(structuredClone(scene),t))
assert.equal(rebuild(scene,-100).timeMs,0);assert.equal(rebuild(scene,99999).timeMs,2000)
for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>rebuild(scene,value))
const overlap=structuredClone(scene)
overlap.steps[0].actions.push({id:'snap',target:'p',type:'move',atMs:800,durationMs:0,params:{x:9,y:7}},{id:'high',target:'p',type:'highlight',atMs:800,durationMs:0,params:{value:true}})
overlap.steps[1].actions.push({id:'last',target:'p',type:'setState',atMs:0,durationMs:0,params:{value:'last'}},{id:'low',target:'p',type:'highlight',atMs:0,durationMs:0,params:{value:false}})
assert.deepEqual(rebuild(overlap,1500).states.p,{position:{x:9,y:7},visible:true,highlight:false,status:'last'})
// Previous step end before next step at 0, even with a move at the boundary.
overlap.steps[0].actions.push({id:'end',target:'p',type:'setState',atMs:1000,durationMs:0,params:{value:'previous'}})
assert.equal(rebuild(overlap,1000).states.p.status,'last')
assert.equal(rebuild(overlap,800).states.p.visible,false)
const clock=new LogicalClock(2000);clock.play();clock.tick(100);clock.tick(850);assert.equal(clock.timeMs,750);assert.deepEqual(rebuild(scene,clock.timeMs),rebuild(scene,750));clock.pause();clock.tick(9999);assert.equal(clock.timeMs,750);clock.play();clock.tick(10000);clock.tick(10250);assert.equal(clock.timeMs,1000);clock.suspend();clock.tick(50000);assert.equal(clock.timeMs,1000);clock.tick(51000);assert.equal(clock.timeMs,2000);assert.equal(clock.playing,false);clock.play();assert.equal(clock.timeMs,0);clock.seek(750);assert.equal(clock.playing,false)
const results=[]
for(const name of ['tcp','expense','pythagoras','production']){
 const course=json(`samples/valid/${name}.json`);assertRegistered(course);const s=course.chapters[0].scenes[0],before=JSON.stringify(course)
 const snapshots=[]
 for(let t=0;t<=duration(s);t+=125){snapshots.push(rebuild(s,t));checks++}
 for(const snapshot of snapshots.toReversed()){const r=rebuild(s,snapshot.timeMs);assert.deepEqual(r,snapshot);for(const state of Object.values(r.states)){state.position.x=-999;state.status='mutated'}assert.deepEqual(rebuild(s,snapshot.timeMs),snapshot)}
 assert.equal(JSON.stringify(course),before)
 const atEnd=rebuild(s,duration(s));const flow=toFlow(s.objects,atEnd.states);for(const n of flow.nodes){n.position.x=-1}assert.deepEqual(rebuild(s,duration(s)),atEnd)
 if(name==='tcp')assert.equal(atEnd.states.client.status,'ESTABLISHED')
 if(name==='expense')assert.equal(atEnd.states.bill.status,'paid')
 if(name==='production')assert.equal(atEnd.states.material.status,'qualified')
 if(name==='pythagoras')assert.equal(formulaTex(s.objects[1],atEnd.states.formula),'a^2+b^2=c^2')
 results.push({course:name,snapshots:snapshots.length,reverseSeekAndIsolation:'passed'})
 const bad=structuredClone(course);bad.components[0].version='1.0.1';assert.throws(()=>assertRegistered(bad))
}
const custom=structuredClone(scene);custom.steps[0].actions=[{id:'custom',target:'p',type:'probe',atMs:0,durationMs:0,params:{}}];assert.throws(()=>rebuild(custom,0));assert.equal(rebuild(custom,0,new Map([['flow:probe',(s)=>({...s,status:'extension'})]])).states.p.status,'extension')
writeFileSync(process.env.PLAYER_EVIDENCE||'docs/evidence/player-current.json',JSON.stringify({result:'passed',fixtureChecks:5,snapshotChecks:checks,coverage:['overlapping moves','same-time precedence','step boundary','hidden movement','instant move','highlight cancellation','finite/clamped seek','clock pause/resume/visibility/end/replay','input and output isolation','exact component versions','extension rejection and dispatch'],courses:results},null,2)+'\n')
console.log(`PASS player: S01 fixtures, edge cases, logical clock, registry, ${checks} snapshots`)
