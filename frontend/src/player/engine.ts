import type { Action, ObjectState, Point, Scene } from './model.ts'
export type Extension = (state:ObjectState, action:Action, progress:number)=>ObjectState
export const starts = (scene:Scene) => { let t=0; return scene.steps.map(s=>{const start=t;t+=s.durationMs;return start}) }
export const duration = (scene:Scene) => scene.steps.reduce((t,s)=>t+s.durationMs,0)
export function clampTime(scene:Scene,t:number) { if(!Number.isFinite(t)) throw new Error('Time must be finite'); return Math.max(0,Math.min(duration(scene),Math.round(t))) }
const lerp=(a:Point,b:Point,p:number):Point=>({x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p})
// Each move captures the previous winning move at its own start, never at seek time.
export function rebuild(scene:Scene, requested:number, extensions:ReadonlyMap<string,Extension>=new Map()) {
 const timeMs=clampTime(scene,requested), offsets=starts(scene)
 const states:Record<string,ObjectState>=Object.fromEntries(scene.objects.map(o=>[o.id,{...o.initial,position:{...o.position}}]))
 const moves:Record<string,{from:Point;to:Point;start:number;duration:number}>={}
 const positionAt=(id:string,t:number)=> {const m=moves[id];return m?lerp(m.from,m.to,m.duration===0?1:Math.min(1,Math.max(0,(t-m.start)/m.duration))):states[id]!.position}
 const actions=scene.steps.flatMap((s,si)=>s.actions.map((a,ai)=>({a,start:offsets[si]!+a.atMs,si,ai}))).sort((a,b)=>a.start-b.start||a.si-b.si||a.ai-b.ai)
 for(const {a,start} of actions) {
  if(start>timeMs) break
  const state=states[a.target]; if(!state) throw new Error(`Missing target: ${a.target}`)
  switch(a.type) {
   case 'move': moves[a.target]={from:{...positionAt(a.target,start)},to:{x:a.params.x!,y:a.params.y!},start,duration:a.durationMs};break
   case 'show':state.visible=true;break
   case 'hide':state.visible=false;break
   case 'highlight':state.highlight=a.params.value as boolean;break
   case 'setState':state.status=a.params.value as string;break
   default: {const extension=extensions.get(`${scene.objects.find(o=>o.id===a.target)!.component}:${a.type}`);if(!extension) throw new Error(`Unsupported action: ${a.type}`);states[a.target]=extension(structuredClone(state),a,a.durationMs===0?1:Math.min(1,(timeMs-start)/a.durationMs))}
  }
 }
 for(const id of Object.keys(states)) states[id]!.position={...positionAt(id,timeMs)}
 const stepIndex=Math.max(0,offsets.findLastIndex(t=>t<=timeMs))
 return {timeMs,stepIndex,states}
}
// Pure logical clock also used by RAF; pause/resume drops stale wall-time baselines.
export class LogicalClock {
 timeMs=0; playing=false; speed=1; private wall:number|null=null
 readonly end:number
 constructor(end:number) {this.end=end}
 pause(){this.playing=false;this.wall=null}
 seek(t:number){if(!Number.isFinite(t))throw new Error('Time must be finite');this.pause();this.timeMs=Math.round(Math.max(0,Math.min(this.end,t)))}
 play(){if(this.timeMs>=this.end)this.timeMs=0;this.playing=true;this.wall=null}
 tick(wall:number){if(!this.playing)return; if(this.wall!==null)this.timeMs=Math.min(this.end,this.timeMs+Math.max(0,wall-this.wall)*this.speed);this.wall=wall;if(this.timeMs>=this.end)this.pause()}
 setSpeed(speed:number){if(![0.5,1,1.5,2].includes(speed))throw new Error('Unsupported playback speed');this.speed=speed;this.wall=null}
 suspend(){this.wall=null}
}
