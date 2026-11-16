<script setup lang="ts">
import {ref,watch,onBeforeUnmount,onMounted,onErrorCaptured} from 'vue'
import SharedPlayer from './SharedPlayer.vue'
import type {Course} from './model'
import {assertRegistered} from './registry'
import {progressKey,restore,signature,type Position} from './progress'
import './student.css'
import './polish.css'
const props=defineProps<{slug:string}>()
const course=ref<Course|null>(null),assetBase=ref(''),error=ref(''),loading=ref(false),version=ref(''),notice=ref(''),storageError=ref(''),reviewed=ref<string[]>([]),position=ref<Position>(),initial=ref<Position>(),generation=ref(0)
let timer:ReturnType<typeof setTimeout>|undefined,dirty=false,activeSlug=''
function save(){clearTimeout(timer);timer=undefined;if(!dirty||!course.value||!position.value)return;dirty=false;try{localStorage.setItem(progressKey(activeSlug),JSON.stringify({schema:1,versionId:version.value,...position.value,signature:signature(course.value,position.value.sceneId),reviewed:reviewed.value,updatedAt:new Date().toISOString()}));storageError.value=''}catch{storageError.value='本地存储不可用，学习位置暂时无法保存。'}}
function update(p:Position){position.value=p;dirty=true;if(!timer)timer=setTimeout(save,500)}
function navigate(id:string){save();initial.value={sceneId:id,timeMs:0};generation.value++;update(initial.value)}
function clear(){clearTimeout(timer);timer=undefined;dirty=false;try{localStorage.removeItem(progressKey(activeSlug));storageError.value=''}catch{storageError.value='本地存储不可用，无法清除磁盘记录。'}reviewed.value=[];initial.value={sceneId:course.value!.chapters[0]!.scenes[0]!.id,timeMs:0};position.value=initial.value;generation.value++;notice.value=storageError.value?'当前会话已重置，磁盘记录未能清除。':'已清除学习记录，从起点暂停。'}
function mark(){const id=position.value?.sceneId;if(!id)return;reviewed.value=reviewed.value.includes(id)?reviewed.value.filter(x=>x!==id):[...reviewed.value,id];dirty=true;save()}
let request:AbortController|undefined
async function load(){save();request?.abort();const abort=new AbortController();request=abort;course.value=null;error.value='';loading.value=true;storageError.value='';const slug=props.slug,base='/api/v1/public/courses/'+encodeURIComponent(slug);try{if(!slug)throw Error('缺少课程标识，请从目录选择课程。');const res=await fetch(base,{signal:abort.signal,cache:'no-cache',credentials:'omit'});if(!res.ok)throw Error(res.status===404?'课程未发布或不存在，请返回目录选择。':'暂时无法读取课程，请重试。');const d=await res.json();if(abort.signal.aborted)return;assertRegistered(d.body);if(!d.body.chapters?.length||!d.body.chapters.every((c:any)=>c.scenes?.length&&c.scenes.every((s:any)=>s.steps?.length)))throw Error('课程暂无可播放的场景。');let raw=null;try{raw=localStorage.getItem(progressKey(slug))}catch{storageError.value='本地存储不可用，本次学习不会持久保存。'}const r=restore(raw,d.body,d.versionId);initial.value=r.position;position.value=r.position;reviewed.value=r.reviewed;notice.value=r.message;version.value=d.versionId;activeSlug=slug;assetBase.value=base+'/versions/'+d.versionId+'/assets/';generation.value++;course.value=d.body}catch(e){if(!abort.signal.aborted)error.value=(e as Error).message}finally{if(!abort.signal.aborted)loading.value=false}}
watch(()=>props.slug,load,{immediate:true})
onErrorCaptured(()=>{error.value='课程无法播放，请刷新或返回目录。';course.value=null;return false})
onMounted(()=>window.addEventListener('pagehide',save))
onBeforeUnmount(()=>{save();request?.abort();window.removeEventListener('pagehide',save)})
</script>
<template><main class="student-site learning-app"><header class="student-header"><a href="#/catalog" class="student-brand">← 课程目录</a><button @click="load">刷新当前发布版本</button></header><p v-if="loading" class="student-state" role="status">正在加载课程…</p><div v-else-if="error" class="student-state" role="alert">{{error}}<button @click="load">重试</button></div><template v-else-if="course"><section class="student-detail"><small>{{course.category}} · 发布快照 #{{version}}</small><h1>{{course.title}}</h1><p>{{course.summary}}</p><details><summary>章节与场景目录</summary><div v-for="chapter in course.chapters" :key="chapter.id"><h2>{{chapter.title}}</h2><button v-for="scene in chapter.scenes" :key="scene.id" @click="navigate(scene.id)">{{scene.title}} · {{scene.steps.length}} 步</button></div></details><div class="student-progress"><p role="status">{{notice}}</p><p v-if="storageError" role="alert">{{storageError}}</p><p>自动保存访问位置；跳转或播放到末尾不代表学完。已复习 {{reviewed.length}} 个场景（由你主动标记，仅保存在本浏览器）。</p><button @click="mark">{{reviewed.includes(position?.sceneId||'')?'取消本场景已复习':'标记本场景已复习'}}</button><button @click="clear">清除本课程学习记录</button></div></section><SharedPlayer :key="generation" :course="course" :initial-position="initial" :resolve-asset="id=>assetBase+id" @position="update"/></template></main></template>
