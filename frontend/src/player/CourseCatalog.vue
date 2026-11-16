<script setup lang="ts">
import {computed,onMounted,ref} from 'vue'
import './student.css'
type Item={slug:string;versionId:string;title:string;summary:string;category:string}
const courses=ref<Item[]>([]),loading=ref(true),error=ref(''),category=ref(''),query=ref('')
const categories=computed(()=>[...new Set(courses.value.map(c=>c.category))])
const labels:Record<string,string>={network:'网络协议',business:'业务流程',math:'数学知识',manufacturing:'工艺流程',production:'工艺流程'}
const filtered=computed(()=>courses.value.filter(c=>(!category.value||c.category===category.value)&&(!query.value||c.title.includes(query.value)||c.summary.includes(query.value))))
async function load(){loading.value=true;error.value='';try{const r=await fetch('/api/v1/public/courses',{cache:'no-cache',credentials:'omit'});if(!r.ok)throw Error();courses.value=(await r.json()).courses}catch{error.value='课程目录暂时无法加载，请重试。'}finally{loading.value=false}}
onMounted(load)
</script>
<template><main class="student-site"><header class="student-header"><a href="#/catalog" class="student-brand">课程探索</a><a href="#/studio">作者工作台</a></header><section class="student-hero"><small>EXPLORE · LEARN · REVISIT</small><h1>一步一步，看懂知识如何发生。</h1><p>探索交互课程，按自己的节奏学习。无需登录。</p></section><section class="student-catalog"><div class="student-filters"><label>搜索课程<input v-model="query" type="search" placeholder="标题或简介"></label><label>课程分类<select v-model="category"><option value="">全部分类</option><option v-for="c in categories" :key="c" :value="c">{{labels[c]||c}}</option></select></label><button @click="load">刷新目录</button></div><p v-if="loading" role="status">正在加载已发布课程…</p><div v-else-if="error" role="alert">{{error}}<button @click="load">重试</button></div><p v-else-if="!filtered.length" role="status">{{courses.length?'没有符合条件的课程，请调整搜索或分类。':'暂无已发布课程，请稍后再来。'}}</p><div v-else class="student-grid"><a v-for="c in filtered" :key="c.slug" class="student-card" :href="'#/published?slug='+encodeURIComponent(c.slug)"><span class="student-category">{{labels[c.category]||c.category}}</span><h2>{{c.title}}</h2><p>{{c.summary}}</p><footer>查看课程与开始学习 →</footer></a></div></section></main></template>
