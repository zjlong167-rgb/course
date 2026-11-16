<script setup lang="ts">
import {computed,ref} from 'vue'
import {useRoute} from 'vue-router'
import type {Course} from './model'
import SharedPlayer from './SharedPlayer.vue'
import UiIcon from './UiIcon.vue'
import tcp from '../../../samples/valid/tcp.json'
import expense from '../../../samples/valid/expense.json'
import math from '../../../samples/valid/pythagoras.json'
import production from '../../../samples/valid/production.json'
import './learning.css'
import './polish.css'
import station from '../../../samples/assets/station.svg?url'
const courses=[tcp,expense,math,production] as Course[]
const route=useRoute()
const index=ref(Math.max(0,courses.findIndex(c=>c.id===route.query.course)))
const course=computed(()=>courses[index.value]!)
// Prototype asset provider; S03 replaces this mapping with an asset API resolver.
const assets:Readonly<Record<string,string>>={'station-image':station}
const resolveAsset=(id:string)=>assets[id]
const immersive=ref(false)
async function fullscreen(){if(!document.fullscreenElement){await document.documentElement.requestFullscreen();immersive.value=true}else{await document.exitFullscreen();immersive.value=false}}
</script>
<template><div class="learning-app"><header class="learning-header"><a href="#/prototype" class="learning-brand" aria-label="课程探索首页"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 3 16 9-16 9L4 12Z" fill="currentColor"/><path d="m4 16 14 8v14L4 30Zm18 8 14-8v14l-14 8Z" fill="currentColor" opacity=".65"/></svg><span>COURSE <b>EXPLORER</b><small>让知识的运行过程，看得见</small></span></a><div class="learning-header-divider"></div><div v-if="index===0" class="osi-context"><div><span>OSI 参考模型</span><b>传输层</b></div><div class="osi-layers" aria-label="OSI 七层模型，当前传输层第4层"><span v-for="layer in 7" :key="layer" :class="{active:layer===4}">{{layer}}</span></div></div><div v-else class="header-course-context"><span>{{['网络协议','业务流程','数学知识','工艺流程'][index]}}</span><strong>{{course.title}}</strong></div><div class="learning-header-actions"><a href="#/studio">作者工作台 <UiIcon name="external"/></a><button @click="fullscreen" aria-label="切换全屏" title="切换全屏"><UiIcon name="fullscreen"/></button><span class="language-label">简体中文</span></div></header><div class="learning-subheader"><div class="sample-tabs" aria-label="样例课程"><button v-for="(c,i) in courses" :key="c.id" :class="{selected:index===i}" :aria-pressed="index===i" @click="index=i"><UiIcon :name="['arrow','flow','triangle','production'][i]!"/>{{c.title}}</button></div><span class="learning-subheader-note">互动课程 / 按自己的节奏学习</span></div><div class="learning-content" :class="{generic:index!==0}"><SharedPlayer :key="course.id" :course="course" :resolve-asset="resolveAsset"/></div></div></template>
