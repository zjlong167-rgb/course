import type {Point,Scene,ObjectState,SceneObject} from './model.ts'
import type {PacketRow} from './network.ts'
import {center} from './network.ts'
const mix=(a:number,b:number,p:number)=>a+(b-a)*p
export const progress=(start:number,end:number,time:number)=>end<=start?(time>=end?1:0):Math.max(0,Math.min(1,(time-start)/(end-start)))
export function laneGeometry(a:SceneObject,b:SceneObject,states:Record<string,ObjectState>){
 const p=center(a,states[a.id]!),q=center(b,states[b.id]!),dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy)||1
 const nx=-dy/length*10,ny=dx/length*10,cutA=Math.min(length*.28,a.size.width*.52),cutB=Math.min(length*.28,b.size.width*.52)
 const from={x:p.x+dx/length*cutA+nx,y:p.y+dy/length*cutA+ny},to={x:q.x-dx/length*cutB+nx,y:q.y-dy/length*cutB+ny}
 return {from,to,d:`M${from.x} ${from.y} L${to.x} ${to.y}`}
}
export function networkMotion(scene:Scene,row:PacketRow,states:Record<string,ObjectState>,time:number){
 const moves=row.moves,move=moves.find(m=>time<m.start+m.durationMs)??moves.at(-1)
 if(!move)return {position:center(row.object,states[row.object.id]!),source:row.fields.source,target:row.fields.target}
 const index=moves.indexOf(move),initial=row.object.position,previous=index===0?initial:{x:moves[index-1]!.params.x!,y:moves[index-1]!.params.y!}
 const dx=move.params.x!-previous.x,dy=move.params.y!-previous.y,length=Math.hypot(dx,dy)||1
 const position=center(row.object,states[row.object.id]!)
 const nearest=(p:Point)=>scene.objects.filter(o=>o.content.visual).reduce((best,o)=>{const q=center(o,states[o.id]!),r=center(best,states[best.id]!);return Math.hypot(p.x-q.x,p.y-q.y)<Math.hypot(p.x-r.x,p.y-r.y)?o:best})
 const half={x:row.object.size.width/2,y:row.object.size.height/2}
 return {position:{x:position.x-dy/length*10,y:position.y+dx/length*10},source:nearest({x:previous.x+half.x,y:previous.y+half.y}).id,target:nearest({x:move.params.x!+half.x,y:move.params.y!+half.y}).id}
}
export function sequenceMotion(row:PacketRow,index:number,time:number,firstEndpoint:string){
 const from={x:row.fields.source===firstEndpoint?240:760,y:150+index*108},to={x:row.fields.source===firstEndpoint?760:240,y:202+index*108}
 const p=progress(row.moves[0]?.start??row.sentAt,row.arrivedAt,time)
 return {from,to,head:{x:mix(from.x,to.x,p),y:mix(from.y,to.y,p)},progress:p,started:time>=row.sentAt,arrived:time>=row.arrivedAt}
}
