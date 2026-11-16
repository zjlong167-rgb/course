<script setup lang="ts">
import {randomId} from '../id'
import {onMounted, ref} from 'vue'
import type {Course} from '../player/model'

const props = defineProps<{
  id:string; revision:string; admin:boolean; dirty:boolean; busy:boolean
  api:(path:string, options?:RequestInit)=>Promise<any>
  run:(action:()=>Promise<void>)=>Promise<void>
  check:()=>void
}>()
const emit=defineEmits<{
  preview:[course:Course,label:string,assets:string]
  invalid:[e:unknown]
}>()
type Version={versionId:string;versionNo:string;revision:string;publishedAt:string}
type Operation={operationId:string;kind:string;actorId:string;at:string;fromVersionId:string|null;toVersionId:string;reason:string}
const versions=ref<Version[]>([]),operations=ref<Operation[]>([]),current=ref(''),slug=ref('')
const selection=ref(''),reason=ref(''),notice=ref('')
const path='/courses/'+props.id
async function refresh(){
 const d=await props.api(path+'/versions')
 versions.value=d.versions;operations.value=d.operations;current.value=d.currentVersionId;slug.value=d.slug
}
onMounted(()=>refresh().catch(e=>{notice.value=e.message}))
let pending:{signature:string;key:string}|undefined
function act(kind:'publish'|'rollback'){
 props.run(async()=>{
  if(kind==='publish')props.check()
  const body=JSON.stringify(kind==='publish'?{revision:props.revision}:{versionId:selection.value,reason:reason.value.trim()})
  const signature=kind+body
  if(!pending||pending.signature!==signature)pending={signature,key:randomId()}
  try{
   const result=await props.api(path+'/'+kind,{method:'POST',headers:{'Idempotency-Key':pending.key},body})
   await refresh();pending=undefined;selection.value='';reason.value=''
   notice.value=(kind==='publish'?'已发布':'已回滚至')+'版本 #'+result.versionId
  }catch(e){emit('invalid',e);throw e}
 })
}
function preview(v:Version){
 props.run(async()=>{
  const base=path+'/versions/'+v.versionId
  const d=await props.api(base)
  emit('preview',d.body,'历史版本 v'+v.versionNo,'/api/v1'+base+'/assets/')
 })
}
</script>
<template>
 <details class="versions"><summary>发布与版本</summary>
 <p v-if="admin"><button :disabled="busy||dirty" @click="act('publish')">发布已保存修订 {{revision}}</button> <span v-if="dirty">请先保存当前修改。</span></p>
 <p role="status">{{notice}}</p>
 <a v-if="current" :href="'#/published?slug='+slug" target="_blank" rel="noopener">打开公开课程</a>
 <p v-if="!versions.length">暂无发布版本</p>
 <ul><li v-for="v in versions" :key="v.versionId">v{{v.versionNo}} · 修订 {{v.revision}} · {{v.publishedAt}} {{current===v.versionId?' · 当前公开版本':''}}
 <button :disabled="busy" @click="preview(v)">预览 v{{v.versionNo}}</button></li></ul>
 <form v-if="admin && versions.length>1" @submit.prevent="act('rollback')">
 <label>回滚目标<select v-model="selection" required><option value="">选择历史版本</option><option v-for="v in versions.filter(v=>v.versionId!==current)" :value="v.versionId" :key="v.versionId">v{{v.versionNo}} · 修订 {{v.revision}}</option></select></label>
 <label>回滚原因<input v-model="reason" required maxlength="500"></label>
 <button :disabled="busy||!selection||!reason.trim()">确认回滚</button></form>
 <details v-if="operations.length"><summary>操作记录</summary><ol><li v-for="op in operations" :key="op.operationId">{{op.at}} · 账号 {{op.actorId}} · {{op.kind==='publish'?'发布':'回滚'}} · #{{op.fromVersionId||'—'}} → #{{op.toVersionId}} {{op.reason}}</li></ol></details>
 </details>
</template>
<style scoped>.versions{margin:16px 0;padding:14px;border:1px solid #b9c9c2;border-radius:6px}.versions summary{cursor:pointer}.versions li{margin:8px 0}</style>
