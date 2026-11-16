import fs from 'node:fs';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';import {chromium} from 'playwright';import {rebuild} from '../frontend/src/player/engine.ts'
const source=JSON.parse(fs.readFileSync('samples/valid/minimal.json')),scene=source.chapters[0].scenes[0],initial=scene.objects[0]
scene.objects=Array.from({length:200},(_,i)=>({...structuredClone(initial),id:'o'+i}));scene.steps=[{id:'stress',title:'stress',narration:'压力用例',durationMs:10000,actions:Array.from({length:1000},(_,i)=>({id:'a'+i,type:'move',target:'o'+i%200,atMs:Math.floor(i/200)*1000,durationMs:1000,params:{x:i,y:i%300}}))}]
const times=[];for(let i=0;i<300;i++){let t=(i*7919)%10001,start=performance.now(),actual=rebuild(scene,t);times.push(performance.now()-start);if(i%25===0)assert.deepEqual(actual,rebuild(scene,t))}times.sort((a,b)=>a-b)
const courses=JSON.parse(fs.readFileSync('docs/evidence/s07-courses.json')),checks=[]
for(const channel of ['chrome','msedge']){
 const b=await chromium.launch({channel});const p=await b.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)))
 for(const c of courses){await p.goto('http://127.0.0.1:5174/#/published?slug='+c.slug);const player=p.locator('.shared-player');await player.waitFor();const seek=p.getByRole('slider',{name:'时间跳转'});const max=Number(await seek.getAttribute('max'))
 for(let i=0;i<30;i++){const t=(i*7919)%(max+1);await seek.fill(String(t));await p.waitForFunction(t=>document.querySelector('.shared-player').dataset.time===String(t),t)}
 await p.setViewportSize({width:390,height:844});assert.ok(await p.getByTestId('narration').first().isVisible());assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`docs/evidence/s08-${channel}-${c.name}.png`,fullPage:true});await p.setViewportSize({width:1440,height:900});checks.push({channel,version:await b.version(),course:c.name,seeks:30,mobile:'simulated viewport only'})}
 assert.deepEqual(errors,[]);await b.close()
}
fs.writeFileSync('docs/evidence/s08-quality.json',JSON.stringify({checks,stress:{objects:200,actions:1000,seeks:300,p50Ms:times[150],p95Ms:times[285],maxMs:times[299],scope:'pure rebuild CPU; not device frame rate'}},null,2));console.log('PASS desktop Chrome/Edge, 240 browser seeks, 300 complex rebuilds')
