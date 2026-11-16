import type {Course,SceneObject,ObjectState} from './model.ts'
const registry:Readonly<Record<string,readonly string[]>>=Object.freeze({'flow@1.0.0':['node','edge','packet'],'flow@1.1.0':['node','edge','packet'],'formula@1.0.0':['formula'],'geometry@1.0.0':['geometry'],'annotation@1.0.0':['text','image']})
export function assertRegistered(course:Course) {
 if(course.formatVersion!=='1.0.0')throw new Error('Unsupported course format')
 for(const c of course.components)if(!registry[`${c.type}@${c.version}`])throw new Error(`Unsupported component: ${c.type}@${c.version}`)
 for(const chapter of course.chapters)for(const scene of chapter.scenes)for(const o of scene.objects){const ref=course.components.find(c=>c.type===o.component);if(!ref||!registry[`${ref.type}@${ref.version}`]?.includes(o.type))throw new Error(`Unregistered object: ${o.id}`)}
}
export function formulaTex(o:SceneObject,s:ObjectState){return o.content.states?.[s.status]??o.content.tex??''}
// Only this adapter knows Vue Flow's node/edge representation; fresh data each evaluation.
export function toFlow(objects:SceneObject[],states:Record<string,ObjectState>){
 return {
 nodes:objects.filter(o=>o.component==='flow'&&o.type!=='edge').map(o=>({id:o.id,type:'course',position:{...states[o.id]!.position},hidden:!states[o.id]!.visible,draggable:false,connectable:false,selectable:true,style:{width:`${o.size.width}px`,height:`${o.size.height}px`},data:{label:o.content.label,state:states[o.id],kind:o.type}})),
 edges:objects.filter(o=>o.type==='edge').map(o=>({id:o.id,source:o.content.source!,target:o.content.target!,label:o.content.label,hidden:!states[o.id]!.visible||!states[o.content.source!]!.visible||!states[o.content.target!]!.visible,animated:false,style:{stroke:states[o.id]!.highlight?'#d18416':'#638779',strokeWidth:states[o.id]!.highlight?4:2}}))
 }
}
