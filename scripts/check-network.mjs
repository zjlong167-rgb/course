import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {validateCourse} from '../contracts/validate.mjs'
import {rebuild,LogicalClock} from '../frontend/src/player/engine.ts'
import {packetTimeline,packetPhase,isNetworkScene} from '../frontend/src/player/network.ts'
const course=JSON.parse(readFileSync('samples/valid/tcp.json','utf8')),scene=course.chapters[0].scenes[0]
assert.deepEqual(validateCourse(course),[]);assert(isNetworkScene(scene))
const rows=packetTimeline(scene)
assert.deepEqual(rows.map(p=>[p.sentAt,p.arrivedAt]),[[0,4100],[6000,10100],[12000,16100]])
assert.equal(packetPhase(rows[1],5999),'pending');assert.equal(packetPhase(rows[1],6000),'sending');assert.equal(packetPhase(rows[1],10100),'received')
for(const [time,client,server] of [[0,'SYN-SENT','LISTEN'],[4099,'SYN-SENT','LISTEN'],[4100,'SYN-SENT','SYN-RECEIVED'],[10100,'ESTABLISHED','SYN-RECEIVED'],[16100,'ESTABLISHED','ESTABLISHED'],[18000,'ESTABLISHED','ESTABLISHED']]){
 const state=rebuild(scene,time).states;assert.equal(state.client.status,client);assert.equal(state.server.status,server)
}
for(const [time,x,y] of [[800,129,344],[1900,404,254],[3000,614,359],[4100,809,144]]){const p=rebuild(scene,time).states.syn.position;assert.deepEqual(p,{x,y})}
const r=rebuild(scene,4800);assert.equal(r.states.syn.visible,false);assert.equal(packetPhase(rows[0],4800),'received')
const clock=new LogicalClock(18000);clock.play();clock.tick(100);clock.tick(1100);assert.equal(clock.timeMs,1000);clock.setSpeed(2);clock.tick(1200);clock.tick(1700);assert.equal(clock.timeMs,2000);clock.setSpeed(.5);clock.tick(2200);clock.tick(3200);assert.equal(clock.timeMs,2500);clock.pause();clock.setSpeed(1.5);clock.tick(50000);assert.equal(clock.timeMs,2500);assert.throws(()=>clock.setSpeed(3))
const mutations=[
 c=>c.chapters[0].scenes[0].objects.find(o=>o.id==='syn').content.packet.source='missing',
 c=>c.chapters[0].scenes[0].objects.find(o=>o.id==='syn').content.packet.targetPort=65536,
 c=>delete c.chapters[0].scenes[0].objects.find(o=>o.id==='synack').content.packet.ack,
 c=>c.chapters[0].scenes[0].objects[0].content.visual='script',
 c=>c.components[0].version='1.0.0',
 c=>delete c.chapters[0].scenes[0].objects[0].content.address,
 c=>c.chapters[0].scenes[0].objects.find(o=>o.id==='syn').type='node'
]
for(const mutate of mutations){const invalid=structuredClone(course);mutate(invalid);assert(validateCourse(invalid).length)}
writeFileSync('docs/evidence/ux-network-engine.json',JSON.stringify({result:'passed',packetTimeline:rows.map(r=>({id:r.object.id,sentAt:r.sentAt,arrivedAt:r.arrivedAt})),checks:['schema and 7 illegal network mutations','3 route waypoints and source at exact times','two-end handshake state at 6 boundaries','packet table phase survives hide and reverse seek','0.5/1/1.5/2 speed validation and clock baseline','component flow@1.1.0 required for network metadata']},null,2)+'\n')
console.log('PASS network: contract, route, packet timeline, TCP state boundaries, speed')
