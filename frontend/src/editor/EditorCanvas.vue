<script setup lang="ts">
import {computed,ref,watch,nextTick} from 'vue'
import {VueFlow,Handle,Position,useVueFlow} from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import katex from 'katex'
import type {Scene,SceneObject} from '../player/model'
import {toEditorFlow} from './adapter'
const props=defineProps<{scene:Scene;selected:string}>()
const emit=defineEmits<{select:[id:string];move:[id:string,p:{x:number;y:number}];connect:[source:string,target:string]}>()
const flow=useVueFlow(),nodes=ref<any[]>([]),edges=ref<any[]>([])
watch(()=>props.scene,()=>{const f=toEditorFlow(props.scene);nodes.value=f.nodes;edges.value=f.edges},{immediate:true})
const zoom=computed(()=>Math.round(flow.viewport.value.zoom*100))
const tex=(o:SceneObject)=>katex.renderToString(o.content.tex||'',{throwOnError:false})
watch(()=>props.scene.id,async()=>{await nextTick();flow.fitView({padding:.2})})
</script>
<template><div class="author-canvas"><div class="canvas-tools"><button @click="flow.zoomOut()" aria-label="缩小画布">−</button><span>{{zoom}}%</span><button @click="flow.zoomIn()" aria-label="放大画布">＋</button><button @click="flow.fitView({padding:.2})">适应画布</button><span>拖动对象 · 空白拖动平移 · 滚轮缩放 · 从右端圆点连向左端</span></div>
<VueFlow v-model:nodes="nodes" v-model:edges="edges" :min-zoom=".1" :max-zoom="3" :delete-key-code="null" fit-view-on-init @node-click="emit('select',$event.node.id)" @edge-click="emit('select',$event.edge.id)" @node-drag-stop="emit('move',$event.node.id,$event.node.position)" @connect="c=>c.source&&c.target&&emit('connect',c.source,c.target)">
<template #node-author="{data,id}"><div class="author-object" :class="{chosen:selected===id,ghost:!data.object.initial.visible}" :data-object-id="id" :title="data.object.content.label"><Handle type="target" :position="Position.Left"/><small>{{data.object.type}} · {{data.object.initial.status}}</small><div v-if="data.object.type==='formula'" v-html="tex(data.object)"/><svg v-else-if="data.object.type==='geometry'" viewBox="0 0 160 90" preserveAspectRatio="none"><polygon :points="data.object.content.points?.map((p:any)=>`${p.x*160/data.object.size.width},${p.y*90/data.object.size.height}`).join(' ')" fill="#dcebe4" stroke="#326657"/></svg><img v-else-if="data.object.type==='image'" :src="'/api/v1/assets/'+data.object.content.assetId" alt=""><strong>{{data.object.content.label}}</strong><Handle type="source" :position="Position.Right"/></div></template>
</VueFlow></div></template>
<style scoped>.author-canvas{height:570px;background-color:#f3f6f4;background-image:radial-gradient(#cbd8d0 1px,transparent 1px);background-size:20px 20px;border:1px solid #c7d7ce;border-radius:8px;overflow:hidden}.canvas-tools{height:44px;display:flex;align-items:center;gap:8px;padding:6px;background:white;font-size:12px}.canvas-tools span:last-child{margin-left:auto}.vue-flow{height:calc(100% - 44px)}.author-object{width:100%;height:100%;border:2px solid #668b7b;border-radius:8px;background:white;padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;box-sizing:border-box}.author-object.chosen{border-color:#bc7d19;box-shadow:0 0 0 3px #eeb95555}.author-object.ghost{opacity:.55;border-style:dashed}.author-object small{font-size:10px;color:#577566}.author-object strong{font-size:13px}.author-object img,.author-object svg{max-height:60%;width:100%;object-fit:contain}.author-object :deep(.vue-flow__handle){width:11px;height:11px;background:#316853}</style>
