import {randomId} from '../id.ts'
import type {Course,Scene,SceneObject,Point} from '../player/model'
export const kinds:Record<string,string>={node:'流程 / 设备',packet:'报文 / 物料',edge:'连线',formula:'公式',geometry:'几何',text:'文字',image:'图片'}
export const uid=(prefix:string)=>prefix+'-'+randomId()
export function object(type:string,assetId?:string):SceneObject {
 const component=({node:'flow',packet:'flow',edge:'flow',formula:'formula',geometry:'geometry',text:'annotation',image:'annotation'} as Record<string,string>)[type]!
 return {id:uid(type),type,component,position:{x:100,y:100},size:{width:160,height:90},initial:{visible:true,highlight:false,status:'idle'},content:{label:kinds[type]!,...(type==='formula'?{tex:'a^2+b^2=c^2'}:{}),...(type==='geometry'?{points:[{x:0,y:0},{x:0,y:90},{x:160,y:90}]}:{}),...(type==='image'?{assetId}: {})},details:{}}
}
export function scene():Scene{return {id:uid('scene'),title:'新场景',canvas:{width:960,height:540},objects:[object('text')],steps:[{id:uid('step'),title:'初始展示',narration:'在此填写第一步的讲解。',durationMs:3000,actions:[]}]}}
export function ensureComponent(c:Course,o:SceneObject){if(!c.components.some(x=>x.type===o.component))c.components.push({type:o.component,version:o.component==='flow'?'1.1.0':'1.0.0'})}
// Vue Flow data is ephemeral. Write only known platform fields, never spread a node into a course.
export function toEditorFlow(s:Scene){return {nodes:s.objects.filter(o=>o.type!=='edge').map(o=>({id:o.id,type:'author',position:{...o.position},style:{width:o.size.width+'px',height:o.size.height+'px'},data:{object:o}})),edges:s.objects.filter(o=>o.type==='edge').map(o=>({id:o.id,source:o.content.source!,target:o.content.target!,label:o.content.label}))}}
export function writePosition(s:Scene,id:string,p:Point){const o=s.objects.find(o=>o.id===id);if(o)o.position={x:Math.round(p.x*100)/100,y:Math.round(p.y*100)/100}}
export function blockers(s:Scene,id:string){return [...s.objects.filter(o=>o.id!==id&&(o.content.source===id||o.content.target===id||o.content.packet?.source===id||o.content.packet?.target===id)).map(o=>'对象 '+o.content.label+' ('+o.id+')'),...s.steps.flatMap(st=>st.actions.filter(a=>a.target===id).map(a=>'步骤 '+st.title+' / 动作 '+a.id))]}


