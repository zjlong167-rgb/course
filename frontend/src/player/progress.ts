import type {Course} from './model'
export type Position={sceneId:string;timeMs:number}
export const progressKey=(slug:string)=>'course-learning:v1:'+slug
export const signature=(course:Course,id:string)=>JSON.stringify(course.chapters.flatMap(c=>c.scenes).find(s=>s.id===id))
export function restore(raw:string|null,course:Course,versionId:string){
 const first={sceneId:course.chapters[0]!.scenes[0]!.id,timeMs:0}
 if(!raw)return {position:first,reviewed:[] as string[],message:'尚无学习记录，从起点开始。'}
 try{
 const r=JSON.parse(raw)
 if(r.schema!==1||typeof r.versionId!=='string'||typeof r.sceneId!=='string'||!Number.isInteger(r.timeMs)||r.timeMs<0||typeof r.signature!=='string'||!Array.isArray(r.reviewed)||!r.reviewed.every((x:unknown)=>typeof x==='string'))throw Error()
 const scene=course.chapters.flatMap(c=>c.scenes).find(s=>s.id===r.sceneId)
 if(!scene||signature(course,r.sceneId)!==r.signature)return {position:first,reviewed:[] as string[],message:'课程结构或场景内容已变化，旧位置与复习标记已失效，从起点开始。'}
 if(r.timeMs>scene.steps.reduce((n,s)=>n+s.durationMs,0))throw Error()
 return {position:{sceneId:r.sceneId as string,timeMs:r.timeMs as number},reviewed:r.versionId===versionId?(r.reviewed as string[]).filter(id=>course.chapters.some(c=>c.scenes.some(s=>s.id===id))):[],message:r.versionId===versionId?'已恢复上次访问位置（暂停）。':'发布版本已变化：当前场景完全一致，保留位置；复习标记已清除。'}
 }catch{return {position:first,reviewed:[] as string[],message:'本地记录损坏，已忽略；从起点开始。'}}
}
