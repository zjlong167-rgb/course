<script setup lang="ts">
import {computed,useId} from 'vue'
import type {Scene,SceneObject,ObjectState} from './model'
const props=defineProps<{scene:Scene;states:Record<string,ObjectState>;selected:string|null}>()
const emit=defineEmits<{select:[id:string]}>()
const marker=useId().replace(/:/g,'')
const nodes=computed(()=>props.scene.objects.filter(o=>o.component==='flow' && o.type!=='edge' && props.states[o.id]?.visible))
const edges=computed(()=>props.scene.objects.filter(o=>o.type==='edge' && props.states[o.id]?.visible && props.states[o.content.source!]?.visible && props.states[o.content.target!]?.visible))
const status=(s:string)=>({paid:'已支付',idle:'待处理',submitted:'已提交'}[s]??s)
function position(o:SceneObject){return props.states[o.id]!.position}
function route(o:SceneObject){
 const a=props.scene.objects.find(n=>n.id===o.content.source)!,b=props.scene.objects.find(n=>n.id===o.content.target)!
 const p=position(a),q=position(b),vertical=Math.abs(q.y-p.y)>Math.abs(q.x-p.x)*.5
 const forward=vertical?q.y>p.y:q.x>p.x
 const x1=p.x+(vertical?a.size.width/2:forward?a.size.width:0),y1=p.y+(vertical?forward?a.size.height:0:a.size.height/2)
 const x2=q.x+(vertical?b.size.width/2:forward?0:b.size.width),y2=q.y+(vertical?forward?0:b.size.height:b.size.height/2)
 return {d:vertical?`M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`:`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`,x:(x1+x2)/2,y:(y1+y2)/2-12}
}
</script>
<template>
 <svg class="business-flow" :viewBox="`0 0 ${scene.canvas.width} ${scene.canvas.height}`" aria-label="审批流程图，点击角色、单据或连线查看详情">
  <defs><marker :id="marker" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="context-stroke"/></marker></defs>
  <g v-for="o in edges" :key="o.id" class="business-edge" :class="{active:states[o.id]!.highlight,selected:selected===o.id}" :data-edge="o.id" role="button" tabindex="0" :aria-label="o.content.label" @click="emit('select',o.id)" @keydown.enter="emit('select',o.id)" @keydown.space.prevent="emit('select',o.id)">
   <path class="edge-hit" :d="route(o).d"/><path class="edge-line" :d="route(o).d" :marker-end="`url(#${marker})`"/>
   <text :x="route(o).x" :y="route(o).y" text-anchor="middle">{{o.content.label}}</text>
  </g>
  <g v-for="o in nodes" :key="o.id" :data-object="o.id" :transform="`translate(${position(o).x},${position(o).y})`" class="business-node" :class="{active:states[o.id]!.highlight,selected:selected===o.id,document:o.type==='packet'}" role="button" tabindex="0" :aria-label="o.content.label" @click="emit('select',o.id)" @keydown.enter="emit('select',o.id)" @keydown.space.prevent="emit('select',o.id)">
   <rect class="node-card" :width="o.size.width" :height="o.size.height" rx="12"/>
   <rect x="15" y="17" width="5" height="18" rx="2" class="node-accent"/>
   <text x="30" y="31" class="node-label">{{o.content.label}}</text>
   <text x="16" :y="o.size.height-17" class="node-status">{{status(states[o.id]!.status)}}</text>
   <circle v-if="states[o.id]!.highlight" :cx="o.size.width-17" :cy="o.size.height-22" r="4" class="active-dot"/>
  </g>
 </svg>
</template>
<style scoped>
.business-flow{width:100%;height:100%;background:radial-gradient(ellipse at 50% 45%,#fff,#f6f9fd);font-family:inherit}.business-edge,.business-node{cursor:pointer;outline:none}.edge-line{stroke:#bfcbdd;stroke-width:2;fill:none}.edge-hit{stroke:transparent;stroke-width:20;fill:none}.business-edge text{font-size:12px;fill:#607897;paint-order:stroke;stroke:#f8fafd;stroke-width:6px;stroke-linejoin:round}.business-edge.active .edge-line{stroke:#2766da;stroke-width:3}.business-edge.active text{fill:#2256b1;font-weight:600}.business-edge.selected .edge-line,.business-edge:focus-visible .edge-line{stroke:#bf7a0c;stroke-width:4}.node-card{fill:white;stroke:#d9e3f1;stroke-width:1.5;filter:drop-shadow(0 4px 7px #1e48700b)}.node-label{fill:#24446d;font-size:16px;font-weight:650}.node-status{fill:#788ba5;font-size:13px}.node-accent{fill:#c1cfe3}.business-node.active .node-card{fill:#edf4ff;stroke:#5d8de6;stroke-width:2}.business-node.active .node-status{fill:#245fc6}.business-node.active .node-accent,.active-dot{fill:#3269d1}.business-node.document .node-card{fill:#173e75;stroke:#173e75}.business-node.document .node-label{fill:white;font-size:14px}.business-node.document .node-status{fill:#bfd8ff;font-size:12px}.business-node.document .node-accent{fill:#7eacf8}.business-node.selected .node-card,.business-node:focus-visible .node-card{stroke:#ce8d23;stroke-width:3}
</style>
