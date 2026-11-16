import type {Scene,ObjectState,SceneObject} from './model.ts'
import {starts} from './engine.ts'
export const isNetworkScene=(scene:Scene)=>scene.objects.some(o=>o.content.visual)
export const center=(o:SceneObject,s:ObjectState)=>({x:s.position.x+o.size.width/2,y:s.position.y+o.size.height/2})
export function packetTimeline(scene:Scene){
 const offsets=starts(scene)
 return scene.objects.filter(o=>o.type==='packet'&&o.content.packet).map(object=>{
  const actions=scene.steps.flatMap((s,i)=>s.actions.filter(a=>a.target===object.id).map(a=>({...a,start:offsets[i]!+a.atMs})))
  const sentAt=actions.filter(a=>a.type==='show').reduce((t,a)=>Math.min(t,a.start),Infinity)
  const arrivedAt=actions.filter(a=>a.type==='move').reduce((t,a)=>Math.max(t,a.start+a.durationMs),sentAt)
  const stepIndex=Math.max(0,offsets.findLastIndex(t=>t<=sentAt))
  const fields=object.content.packet!
  const source=scene.objects.find(o=>o.id===fields.source)!, target=scene.objects.find(o=>o.id===fields.target)!
  return {object,fields,sentAt,arrivedAt,stepIndex,source,target,moves:actions.filter(a=>a.type==='move').sort((a,b)=>a.start-b.start)}
 }).sort((a,b)=>a.sentAt-b.sentAt)
}
export type PacketRow=ReturnType<typeof packetTimeline>[number]
export const packetPhase=(row:PacketRow,time:number)=>time<row.sentAt?'pending':time<row.arrivedAt?'sending':'received'
export const phaseLabel=(phase:string)=>({pending:'待发送',sending:'传输中',received:'已到达'}[phase]??phase)
export const packetSummary=(row:PacketRow)=>`${row.fields.sourcePort} → ${row.fields.targetPort} [${row.fields.flags}] Seq=${row.fields.seq}${row.fields.ack===undefined?'':` Ack=${row.fields.ack}`}`
