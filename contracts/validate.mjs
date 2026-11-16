import Ajv2020 from 'ajv/dist/2020.js'
import schema from './course-v1.schema.json' with { type: 'json' }
const structural = new Ajv2020({ allErrors: true, strict: true }).compile(schema)
export function validateCourse(course) {
  if (!structural(course)) return structural.errors.filter(e=>e.keyword!=='if').map(e => {
    const key=e.params.missingProperty ?? e.params.additionalProperty
    const field=key===undefined?'':'/'+key.replace(/~/g,'~0').replace(/\//g,'~1')
    return `${e.instancePath}${field}: ${e.message}`
  })
  const errors = [], ids = new Set(), assets = new Set(course.assets.map(a => a.id))
  const components = new Set(course.components.map(c => c.type))
  for(const [i,c] of course.components.entries()) if(c.version!=='1.0.0' && !(c.type==='flow'&&c.version==='1.1.0')) errors.push(`/components/${i}/version: unsupported component version`)
  const id = (value, path) => { if(ids.has(value)) errors.push(`${path}: duplicate id ${value}`); ids.add(value) }
  id(course.id, '/id')
  for (const [name, list, key] of [['assets',course.assets,'id'],['components',course.components,'type']]) {
    if(new Set(list.map(x=>x[key])).size !== list.length) errors.push(`/${name}: duplicate reference`)
  }
  for (const [ci,chapter] of course.chapters.entries()) {
    const cp=`/chapters/${ci}`
    id(chapter.id, cp+'/id')
    for (const [si,scene] of chapter.scenes.entries()) {
      const sp=cp+`/scenes/${si}`
      id(scene.id, sp+'/id'); const targets = new Set(scene.objects.map(o=>o.id))
      for(const [oi,o] of scene.objects.entries()) {
        const op=sp+`/objects/${oi}`
        id(o.id, op+'/id')
        if(!components.has(o.component)) errors.push(`${op}/component: missing component`)
        const expected = {node:'flow',edge:'flow',packet:'flow',formula:'formula',geometry:'geometry',text:'annotation',image:'annotation'}[o.type]
        if(o.component!==expected) errors.push(`${op}/component: incompatible component`)
        if(o.type==='formula' && !o.content.tex) errors.push(`${op}/content/tex: missing tex`)
        if(o.type==='geometry' && !o.content.points) errors.push(`${op}/content/points: missing points`)
        if(o.type==='image' && !assets.has(o.content.assetId)) errors.push(`${op}/content/assetId: missing asset`)
        if(o.content.visual || o.content.packet) {
          if(o.component!=='flow' || course.components.find(c=>c.type==='flow')?.version!=='1.1.0') errors.push(`${op}: network content requires flow@1.1.0`)
          if(o.content.visual && o.type!=='node') errors.push(`${op}: visual requires node`)
          if(o.content.packet) {
            const p=o.content.packet
            if(o.type!=='packet') errors.push(`${op}: packet fields require packet object`)
            for(const key of ['source','target']) if(!scene.objects.some(n=>n.id===p[key]&&n.type==='node'&&n.content.visual&&n.content.address)) errors.push(`${op}/content/packet/${key}: missing network endpoint ${p[key]}`)
            if(p.flags.includes('ACK') && p.ack===undefined) errors.push(`${op}/content/packet/ack: ACK flag requires ack`)
          }
        }
        if(o.type==='edge') for(const key of ['source','target']) if(!targets.has(o.content[key])) errors.push(`${op}/content/${key}: missing endpoint`)
      }
      for(const [ti,s] of scene.steps.entries()) {
        const tp=sp+`/steps/${ti}`
        id(s.id,tp+'/id')
        for(const [ai,a] of s.actions.entries()) {
          const ap=tp+`/actions/${ai}`
          id(a.id, ap+'/id')
          if(!targets.has(a.target)) errors.push(`${ap}/target: missing target`)
          if(a.atMs+a.durationMs>s.durationMs) errors.push(`${ap}/atMs: exceeds step`)
          if(a.type!=='move' && a.durationMs!==0) errors.push(`${ap}/durationMs: discrete action duration must be zero`)
        }
      }
    }
  }
  return errors
}
