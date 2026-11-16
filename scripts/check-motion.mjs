import assert from 'node:assert/strict'
import {readFileSync,writeFileSync} from 'node:fs'
import {rebuild} from '../frontend/src/player/engine.ts'
import {packetTimeline} from '../frontend/src/player/network.ts'
import {laneGeometry,networkMotion,sequenceMotion} from '../frontend/src/player/motion.ts'
const scene=JSON.parse(readFileSync('samples/valid/tcp.json','utf8')).chapters[0].scenes[0],rows=packetTimeline(scene),state=rebuild(scene,2600).states
const client=scene.objects.find(o=>o.id==='client'),router=scene.objects.find(o=>o.id==='router')
const a=laneGeometry(client,router,state),b=laneGeometry(router,client,state)
assert.notDeepEqual(a.from,b.to);assert.notDeepEqual(a.to,b.from)
const cross=(p,q)=>p.x*q.y-p.y*q.x;const pa={x:a.to.x-a.from.x,y:a.to.y-a.from.y},pb={x:b.to.x-b.from.x,y:b.to.y-b.from.y};assert(Math.abs(cross(pa,pb))<1e-6);assert(pa.x*pb.x+pa.y*pb.y<0)
for(const [time,source,target] of [[1200,'client','router'],[2600,'router','internet'],[3500,'internet','server'],[7200,'server','internet'],[8600,'internet','router'],[9500,'router','client']]){const r=time<6000?rows[0]:rows[1];const m=networkMotion(scene,r,rebuild(scene,time).states,time);assert.equal(m.source,source);assert.equal(m.target,target)}
for(const [time,p] of [[0,0],[800,0],[1625,.25],[2450,.5],[3275,.75],[4100,1]]){const s=sequenceMotion(rows[0],0,time,'client');assert.equal(s.progress,p);assert.equal(s.head.x,240+520*p);assert.equal(s.head.y,150+52*p)}
const returning=sequenceMotion(rows[1],1,8450,'client');assert.equal(returning.progress,.5);assert.equal(returning.head.x,500);assert(returning.to.x<returning.from.x);assert(returning.to.y>returning.from.y)
assert.equal(sequenceMotion(rows[2],2,11999,'client').started,false);assert.equal(sequenceMotion(rows[2],2,12000,'client').started,true)
writeFileSync('docs/evidence/motion-unit.json',JSON.stringify({result:'passed',checks:['distinct parallel opposite lanes','six directed hop identities','0/25/50/75/100 percent diagonal trace','reverse-direction descending trace','pending/started boundary']},null,2)+'\n')
console.log('PASS motion geometry and timeline')
