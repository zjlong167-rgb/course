import type { Course } from '../player/model'
import { scene, uid } from './adapter.ts'

export function instantiate(source?: Course, imageId?: string): Course {
  if (!source) return {
    formatVersion:'1.0.0', id:uid('course'), title:'未命名课程', summary:'请填写课程简介', category:'business',
    assets:[], components:[{type:'annotation',version:'1.0.0'}],
    chapters:[{id:uid('chapter'),title:'第一章',scenes:[scene()]}]
  }
  const c=structuredClone(source)
  c.id=uid('course')
  for(const ch of c.chapters){
    ch.id=uid('chapter')
    for(const s of ch.scenes){
      s.id=uid('scene')
      const ids=new Map(s.objects.map(o=>[o.id,uid(o.type)]))
      for(const o of s.objects){
        o.id=ids.get(o.id)!
        for(const endpoints of [o.content,o.content.packet]){
          if(endpoints?.source) endpoints.source=ids.get(endpoints.source)!
          if(endpoints?.target) endpoints.target=ids.get(endpoints.target)!
        }
        if(o.content.assetId==='station-image') o.content.assetId=imageId
      }
      for(const step of s.steps){
        step.id=uid('step')
        for(const a of step.actions){a.id=uid('action');a.target=ids.get(a.target)!}
      }
    }
  }
  for(const asset of c.assets) if(asset.id==='station-image'){
    if(!imageId) throw new Error('生产课程请先上传工位图片（PNG、JPEG 或 WebP）')
    asset.id=imageId
  }
  return c
}
