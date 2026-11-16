<script setup lang="ts">
import {ref,computed,watch,nextTick,onMounted,onBeforeUnmount} from 'vue'
import {instantiate} from './editor/templates'
import VersionPanel from './editor/VersionPanel.vue'
import CourseEditor from './editor/CourseEditor.vue'
import {useRouter} from 'vue-router'
import SharedPlayer from './player/SharedPlayer.vue'
import type {Course} from './player/model'
// @ts-expect-error The shared executable contract is JavaScript, used by Node and Vite.
import {validateCourse} from '../../contracts/validate.mjs'
import tcp from '../../samples/valid/tcp.json'
import expense from '../../samples/valid/expense.json'
import math from '../../samples/valid/pythagoras.json'
import production from '../../samples/valid/production.json'
const templates=[tcp,expense,math,production]
const user=ref<{id:string;role:string;csrfToken:string}|null>(null),username=ref(''),password=ref(''),message=ref(''),busy=ref(false)
const courses=ref<{id:string;title:string;category:string}[]>([]),courseId=ref(''),revision=ref(''),text=ref(''),baseline=ref(''),preview=ref<Course|null>(null),previewKey=ref(0),editorKey=ref(0)
const remote=ref<{body:Course;revision:string}|null>(null),uploaded=ref(''),templateIndex=ref(-1), uploadedImage=ref('')
const courseSearch=ref('')
const filteredCourses=computed(()=>courses.value.filter(c=>(c.title+' '+c.category+' '+c.id).toLowerCase().includes(courseSearch.value.toLowerCase())))
const dirty=computed(()=>text.value!==baseline.value)
const parsed=computed(()=>{try{return JSON.parse(text.value) as Course}catch{return null}})
const title=computed({get:()=>parsed.value?.title??'',set:(v:string)=>{if(parsed.value){text.value=JSON.stringify({...parsed.value,title:v},null,2)}}})
async function api(path:string,options:RequestInit={}){const headers=new Headers(options.headers);if(!(options.body instanceof FormData))headers.set('Content-Type','application/json');if(user.value)headers.set('X-CSRF-Token',user.value.csrfToken);const res=await fetch('/api/v1'+path,{...options,headers});const data=res.status===204?{}:await res.json();if(!res.ok){if(res.status===401){user.value=null;preview.value=null};throw Object.assign(new Error(data.error?.message||'请求失败'),{status:res.status,data})}return data}
async function run(fn:()=>Promise<void>){busy.value=true;message.value='';try{await fn()}catch(e){message.value=(e as Error).message}finally{busy.value=false}}
async function list(){let after='';courses.value=[];for(;;){const data=await api('/courses'+(after?'?after='+after:''));courses.value.push(...data.courses);if(data.courses.length<50)break;after=data.courses.at(-1).id}}
async function login(){await run(async()=>{user.value=await api('/auth/login',{method:'POST',body:JSON.stringify({username:username.value,password:password.value})});password.value='';await list()})}
async function logout(){await run(async()=>{await api('/auth/logout',{method:'POST'});user.value=null;preview.value=null;message.value='已登出；未保存文本仍留在此页面'})}
async function open(id:string){if(dirty.value&&!confirm('当前内容尚未保存，确定重新加载吗？可先下载本地副本。'))return;await run(async()=>{const d=await api('/courses/'+id+'/draft');courseId.value=id;editorKey.value++;revision.value=d.revision;text.value=JSON.stringify(d.body,null,2);baseline.value=text.value;remote.value=null;preview.value=null;message.value='已从数据库重新打开'})}
async function create(){if(dirty.value&&!confirm('当前内容未保存，确定放弃并创建课程？'))return;await run(async()=>{const body=instantiate(templates[templateIndex.value] as Course|undefined,uploadedImage.value)
const result=await api('/courses',{method:'POST',body:JSON.stringify({body})});await list();const d=await api('/courses/'+result.id+'/draft');courseId.value=result.id;editorKey.value++;revision.value=d.revision;text.value=JSON.stringify(d.body,null,2);baseline.value=text.value;remote.value=null;preview.value=null;message.value='课程已创建并持久化'})}
async function save(){await run(async()=>{if(!parsed.value)throw new Error('JSON 格式错误');const submittedText=text.value,submittedBody=parsed.value;const errors=validateCourse(submittedBody);if(errors.length){setIssues(errors);throw new Error('请定位并修正以下课程问题')};try{const d=await api('/courses/'+courseId.value+'/draft',{method:'PUT',body:JSON.stringify({revision:revision.value,body:submittedBody})});revision.value=d.revision;baseline.value=submittedText;remote.value=null;preview.value=null;await list();message.value='已保存 · 修订 '+d.revision}catch(e){if(text.value===submittedText)serverIssues(e);if((e as {status:number}).status===409){remote.value=await api('/courses/'+courseId.value+'/draft')}throw e}})}
function download(){const u=URL.createObjectURL(new Blob([text.value],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='course-local.json';a.click();URL.revokeObjectURL(u)}
const previewAssets=ref('/api/v1/assets/')
async function versionPreview(course:Course,label:string,assets:string){previewAssets.value=assets;preview.value=course;previewKey.value++;previewSource.value=label;await revealPreview()}
const editor=ref<InstanceType<typeof CourseEditor>>(),previewSource=ref('')
type Issue={path:string;message:string}
const issues=ref<Issue[]>([])
watch(text,()=>{issues.value=[]})
function setIssues(errors:string[]){issues.value=errors.filter(e=>!e.endsWith('must match "then" schema')).map(e=>{const i=e.indexOf(': ');return {path:e.slice(0,i),message:e.slice(i+2)}})}
function serverIssues(e:unknown){const error=(e as {data?:{error?:{issues?:Issue[],message:string}}}).data?.error
 if(error?.issues){
   // Older API instances return one root issue for a nested schema violation.
   if(error.issues.some(i=>i.path==='/') && parsed.value && validateCourse(parsed.value).length)setIssues(validateCourse(parsed.value))
   else issues.value=error.issues
 }else if(error?.message.startsWith('/'))setIssues([error.message])}
function check(){if(!parsed.value)throw new Error('JSON 格式错误，请在高级面板修正。');setIssues(validateCourse(parsed.value));if(issues.value.length)throw new Error('请定位并修正以下课程问题')}
const editable=computed(()=>{
 const c=parsed.value
 if(!c||!Array.isArray(c.assets)||!Array.isArray(c.components)||!Array.isArray(c.chapters)||!c.chapters.length)return false
 return c.chapters.every(ch=>Array.isArray(ch?.scenes)&&ch.scenes.length&&ch.scenes.every(s=>
   s?.canvas && Array.isArray(s.objects)&&s.objects.length&&s.objects.every(o=>o?.content&&o.initial&&o.position&&o.size&&o.details)
   && Array.isArray(s.steps)&&s.steps.length&&s.steps.every(t=>Array.isArray(t?.actions)&&t.actions.every(a=>a?.params))
 ))
})
function locate(path:string){
 if(path==='/title'){document.querySelector<HTMLElement>('[aria-label="课程标题"]')?.focus();return}
 if(editor.value&&path.includes('/chapters/')){editor.value.locate(path);return}
 const details=document.querySelector<HTMLDetailsElement>('.advanced-json');if(details){details.open=true;details.querySelector('textarea')?.focus()}
}
function repairHint(issue:Issue){
 const m=issue.message
 if(m.includes('missing target'))return '请选择本场景中存在的动作目标。'
 if(m.includes('exceeds step'))return '请调整开始或持续时间，或延长步骤。'
 if(m.includes('missing endpoint')||m.includes('missing network endpoint'))return '请重新选择两端对象；报文端点需要设备外观及地址。'
 if(issue.path.includes('/params/') && /[xy]$/.test(issue.path))return '移动终点须为 -100000 到 100000 之间的数。'
 if(m.includes('duplicate id'))return '此 ID 已被使用，请在高级面板修正重复 ID 并核对引用。'
 return m
}
function describe(path:string){
 const names:Record<string,string>={chapters:'章',scenes:'场景',objects:'对象',steps:'步骤',actions:'动作',assets:'资源',components:'组件'}
 return path.replace(/\/(chapters|scenes|objects|steps|actions|assets|components)\/(\d+)/g,(_,key,i)=>' / '+names[key]+' '+(Number(i)+1)).replace(/^ \/ /,'')||'课程'
}
function validateServer(){run(async()=>{const submitted=text.value;if(!parsed.value)throw new Error('JSON 格式错误');try{await api('/courses/'+courseId.value+'/validate',{method:'POST',body:JSON.stringify({body:parsed.value})});message.value=submitted===text.value?'服务器校验通过':'已校验先前快照；当前内容已修改'}catch(e){if(submitted===text.value)serverIssues(e);throw e}})}
function localPreview(){run(async()=>{check();previewAssets.value='/api/v1/assets/';preview.value=JSON.parse(text.value);previewKey.value++;previewSource.value='本地编辑快照（不保存）';await revealPreview()})}
async function revealPreview(){await nextTick();document.querySelector('.studio-preview')?.scrollIntoView({block:'start'})}
async function showPreview(){await run(async()=>{const d=await api('/courses/'+courseId.value+'/preview');previewAssets.value='/api/v1/assets/';preview.value=d.body;previewKey.value++;previewSource.value='服务器草稿 · 修订 '+d.revision;await revealPreview();message.value='预览服务器已保存修订 '+d.revision+(dirty.value?'；本地尚有未保存内容':'')})}
async function upload(event:Event){const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;await run(async()=>{const form=new FormData();form.append('file',file);const d=await api('/assets',{method:'POST',body:form});uploaded.value=d.id;if(file.type.startsWith('image/'))uploadedImage.value=d.id;if(parsed.value){const c=JSON.parse(text.value);c.assets.push({id:d.id,purpose:file.name});text.value=JSON.stringify(c,null,2)};message.value='资源已保存：'+d.id})}
function unload(e:BeforeUnloadEvent){if(dirty.value){e.preventDefault();e.returnValue=''}}
onMounted(()=>{window.addEventListener('beforeunload',unload);run(async()=>{try{user.value=await api('/auth/me');await list()}catch{message.value='登录后管理私有草稿'}})})
const removeRouteGuard=useRouter().beforeEach((to,from)=>to.fullPath===from.fullPath||!dirty.value||confirm('当前内容未保存，确定离开课程工作台？'))
onBeforeUnmount(()=>{removeRouteGuard();window.removeEventListener('beforeunload',unload)})
</script>
<template><main class="studio"><header><a href="#/prototype">← 学习样例</a><h1>课程工作台</h1><span>课程编辑与步骤编排</span><button v-if="user" @click="logout" :disabled="busy">登出</button></header>
<p role="status" class="studio-message">{{message}}</p>
<form v-if="!user" @submit.prevent="login" class="studio-login"><h2>后台登录</h2><label>账号<input aria-label="账号" v-model="username" autocomplete="username" required></label><label>密码<input aria-label="密码" type="password" v-model="password" autocomplete="current-password" required></label><button class="primary" :disabled="busy">登录</button><p>初始账号由部署环境配置，无默认生产密码。</p></form>
<template v-else><p>账号 {{user.id}} · {{user.role}}</p><div class="studio-columns"><aside><h2>我的课程</h2><button @click="run(list)" :disabled="busy">刷新列表</button><input aria-label="搜索课程" v-model="courseSearch" placeholder="搜索课程名称 / 分类 / ID"><div class="course-list"><button v-for="c in filteredCourses" :key="c.id" @click="open(c.id)" :disabled="busy">{{c.title}} · #{{c.id}}</button></div><hr><label>建课起点<select aria-label="建课起点" v-model="templateIndex"><option :value="-1">空白课程</option><option v-for="(t,i) in templates" :value="i">{{t.title}}</option></select></label><label>上传资源<input type="file" aria-label="上传资源" accept="image/png,image/jpeg,image/webp,application/pdf" @change="upload" :disabled="busy"></label><p>{{uploaded}}</p><button @click="create" :disabled="busy || dirty">创建课程</button><small>模板复制布局和分镜；生产模板需先上传工位图片。</small></aside>
<section v-if="courseId"><div class="studio-toolbar"><strong>课程 #{{courseId}} / 修订 {{revision}} {{dirty?'· 未保存':''}}</strong><button @click="save" :disabled="busy">保存草稿</button><button @click="open(courseId)" :disabled="busy">重新打开</button><button @click="validateServer" :disabled="busy">服务器校验</button><button @click="localPreview" :disabled="busy">预览本地编辑</button><button @click="showPreview" :disabled="busy">授权预览</button><button @click="download">下载本地副本</button></div><VersionPanel :key="courseId" :id="courseId" :revision="revision" :admin="user.role==='admin'" :dirty="dirty" :busy="busy" :api="api" :run="run" :check="check" @invalid="serverIssues" @preview="versionPreview"/><div v-if="issues.length" class="studio-conflict" role="alert"><b>需要修正的字段</b><div v-for="issue in issues"><button @click="locate(issue.path)">定位：{{describe(issue.path)}}</button> {{repairHint(issue)}}</div></div><label>课程标题<input aria-label="课程标题" v-model="title"></label><CourseEditor v-if="parsed && editable" ref="editor" :key="editorKey" :course="parsed" @change="text=JSON.stringify($event,null,2)" @message="message=$event"/><details class="advanced-json"><summary>高级：JSON 检查与冲突手工合并</summary><label>课程 JSON<textarea aria-label="课程 JSON" spellcheck="false" v-model="text"></textarea></label></details>
<div v-if="remote" role="alert" class="studio-conflict"><h3>保存冲突：服务器修订 {{remote.revision}}</h3><p>本地内容仍在上方。比较下方服务器内容并在上方手工合并；也可下载本地副本后重新打开。</p><details open><summary>服务器最新内容</summary><pre>{{JSON.stringify(remote.body,null,2)}}</pre></details><button @click="revision=remote.revision;remote=null;message='已采用最新修订为合并基线，请检查并再次保存'">已手工合并，采用最新修订</button></div>
</section><p v-else>选择课程，或创建课程。</p></div><section v-if="preview" class="studio-preview"><h2>课程预览</h2><p>{{previewSource}} · 再次预览可载入最新内容</p><SharedPlayer :key="previewKey" :course="preview" :resolve-asset="id=>previewAssets+id"/></section></template></main></template>
<style scoped>
.studio{max-width:1900px;margin:auto;padding:24px;color:#233642}.studio header,.studio-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.studio header h1{margin-right:auto}.studio-message{white-space:pre-wrap;min-height:24px;color:#315f51}.studio-login{max-width:420px;margin:50px auto}.studio :deep(label){display:block;margin:12px 0}.studio :deep(input),.studio :deep(select){display:block;width:100%;padding:10px;border:1px solid #b9c9c2;border-radius:6px}.studio-columns{display:grid;grid-template-columns:210px minmax(0,1fr);gap:24px}.studio-columns aside{background:#eef3ef;padding:16px}.studio-columns aside button{display:block;margin:10px 0;width:100%;text-align:left}.studio :deep(textarea){width:100%;min-height:400px;font:13px/1.5 Consolas,monospace;padding:12px;border:1px solid #b9c9c2}.studio pre{max-height:300px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}.studio-conflict{padding:16px;background:#fff1d8}.studio-preview{margin-top:24px;border-top:1px solid #ccc}.course-list{max-height:420px;overflow:auto}.studio :deep(.course-info textarea),.studio :deep(.properties textarea){min-height:70px}.studio small{display:block;line-height:1.7}@media(max-width:700px){.studio-columns{grid-template-columns:1fr}.studio{padding:12px}}
</style>

