<script setup lang="ts">
import {computed,useId,ref} from 'vue'
import DeviceGlyph from './DeviceGlyph.vue'
import './motion.css'
import {center,packetPhase,packetSummary} from './network'
import {laneGeometry,networkMotion,sequenceMotion} from './motion'
import type {PacketRow} from './network'
import type {Scene,ObjectState} from './model'
const props=defineProps<{scene:Scene;states:Record<string,ObjectState>;packets:PacketRow[];time:number;selected:string|null;view:string;playing:boolean}>()
const emit=defineEmits<{select:[id:string];packet:[id:string,time:number]}>()
const uid=useId().replaceAll(':','')
const nodes=computed(()=>props.scene.objects.filter(o=>o.content.visual))
const edges=computed(()=>props.scene.objects.filter(o=>o.type==='edge'))
const endpoints=computed(()=>props.packets.length?[props.packets[0]!.source,props.packets[0]!.target]:[])
const hover=ref<string|null>(null)
const current=computed(()=>props.packets.find(p=>props.time>=p.sentAt&&props.time<p.arrivedAt))
const packetPositions=computed(()=>Object.fromEntries(props.packets.map(row=>[row.object.id,networkMotion(props.scene,row,props.states,props.time)])))
const lanes=computed(()=>edges.value.flatMap(edge=>[false,true].map(reverse=>{
 const source=reverse?edge.content.target!:edge.content.source!,target=reverse?edge.content.source!:edge.content.target!
 const a=props.scene.objects.find(o=>o.id===source)!,b=props.scene.objects.find(o=>o.id===target)!
 const moving=current.value&&packetPositions.value[current.value.object.id]
 return {id:`${source}>${target}`,edgeId:edge.id,reverse,...laneGeometry(a,b,props.states),active:moving?.source===source&&moving?.target===target}
})))
const sequences=computed(()=>props.packets.map((row,i)=>({row,...sequenceMotion(row,i,props.time,endpoints.value[0]!.id)})))
const cursor=computed(()=>{const s=sequences.value.find(s=>props.time>=s.row.sentAt&&props.time<s.row.sentAt+props.scene.steps[s.row.stepIndex]!.durationMs)??sequences.value.at(-1);return s?.head.y??130})
</script>
<template>
 <svg v-if="view==='network'" class="network-svg" :viewBox="`0 0 ${scene.canvas.width} ${scene.canvas.height}`" role="img" aria-label="交互网络拓扑" :class="{playing}">
  <defs><pattern :id="uid+'grid'" width="80" height="44" patternUnits="userSpaceOnUse"><path d="M0 22 40 0 80 22 40 44Z" fill="none" stroke="#e8edf8" stroke-width=".8"/></pattern><marker :id="uid+'arrow'" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="m0 0 10 5-10 5" fill="#8da7df"/></marker></defs>
  <defs><marker v-for="[key,color] in [['idle','#a3b6d8'],['out','#275dcb'],['back','#168e82']]" :key="key" :id="uid+key" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9Z" :fill="color"/></marker></defs>
  <text x="32" y="35" class="diagram-coordinate">NETWORK TOPOLOGY / 01</text>
  <rect width="100%" height="100%" :fill="`url(#${uid}grid)`"/>
  <g class="directional-lanes"><g v-for="lane in lanes" :key="lane.id" :class="['directed-lane',{active:lane.active,returning:lane.reverse}]" :data-lane="lane.id">
   <path :data-link="lane.reverse?undefined:lane.edgeId" :d="lane.d" fill="none" :marker-end="`url(#${uid}${lane.active?(lane.reverse?'back':'out'):'idle'})`" class="lane-track"/>
   <path v-if="lane.active" :d="lane.d" class="lane-flow" :style="{strokeDashoffset:String(-time/55)}"/>
  </g></g>
  <g v-for="o in nodes" :key="o.id" v-show="states[o.id]!.visible" :data-device="o.id" :data-status="states[o.id]!.status" :transform="`translate(${states[o.id]!.position.x},${states[o.id]!.position.y})`" class="network-device" :class="{focused:selected===o.id,highlight:states[o.id]!.highlight}" role="button" tabindex="0" :aria-label="o.content.label" @click="emit('select',o.id)" @keydown.enter="emit('select',o.id)" @keydown.space.prevent="emit('select',o.id)">
   <ellipse :cx="o.size.width/2" :cy="o.size.height*.85" :rx="o.size.width*.57" :ry="o.size.height*.27" class="device-focus"/>
   <DeviceGlyph :kind="o.content.visual!" :x="-o.size.width*.15" :y="-o.size.height*.25" :width="o.size.width*1.3" :height="o.size.height*1.3"/>
   <text :x="o.size.width/2" :y="o.size.height+20" class="device-name">{{o.content.label}}</text><text :x="o.size.width/2" :y="o.size.height+40" class="device-address">{{o.content.address}}</text>
   <g v-if="['laptop','server'].includes(o.content.visual!)" :transform="`translate(${o.size.width/2-70},${o.size.height+51})`"><rect width="140" height="25" rx="12" :class="{established:states[o.id]!.status==='ESTABLISHED'}" class="state-badge"/><text x="70" y="17" class="device-state">{{states[o.id]!.status}}</text></g>
  </g>
  <g v-for="row in packets" :key="row.object.id" v-show="states[row.object.id]!.visible" :data-packet="row.object.id" :data-phase="packetPhase(row,time)" :transform="`translate(${packetPositions[row.object.id]!.position.x},${packetPositions[row.object.id]!.position.y})`" class="network-packet" :class="{returning:row.fields.flags.includes('SYN, ACK')}" role="button" tabindex="0" :aria-label="`${row.fields.flags} 报文`" @click="emit('select',row.object.id)" @keydown.enter="emit('select',row.object.id)">
   <circle r="30" class="packet-halo"/><circle r="22" class="packet-orbit"/><rect x="-18" y="-12" width="36" height="25" rx="6" class="packet-envelope"/><path d="m-15-8 15 11 15-11" fill="none" stroke="white" stroke-width="2"/><rect x="-72" y="-49" width="144" height="27" rx="5" class="packet-label-bg"/><text y="-31" text-anchor="middle" class="packet-label">{{row.fields.flags}} · Seq {{row.fields.seq}}</text>
  </g>
  <g transform="translate(30 532)" class="lane-legend"><path d="M0 0h24m-5-4 5 4-5 4"/><text x="32" y="4">客户端 → 服务端</text><path d="M238 0h-24m5-4-5 4 5 4" class="returning"/><text x="246" y="4">服务端 → 客户端</text></g>
 </svg>
 <svg v-else class="sequence-svg" viewBox="0 0 960 560" role="img" aria-label="TCP 报文时序图">
  <defs><marker :id="uid+'seq'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="m1 1 8 4-8 4Z" fill="context-stroke"/></marker></defs>
  <text x="34" y="113" class="sequence-axis-label">时间 ↓</text>
  <g v-for="(o,i) in endpoints" :key="o.id"><rect :x="i===0?150:670" y="18" width="180" height="67" rx="6" fill="#f2f6ff"/><text :x="i===0?240:760" y="44" text-anchor="middle" class="sequence-title">{{o.content.label}}</text><text :x="i===0?240:760" y="64" text-anchor="middle" class="device-address">{{o.content.address}}</text><path :d="`M${i===0?240:760} 96 V482`" class="sequence-lifeline"/><text :x="i===0?240:760" y="504" text-anchor="middle" class="sequence-end-state">{{states[o.id]!.status}}</text></g>
  <g class="sequence-now" :transform="`translate(0,${cursor})`"><path d="M126 0H895"/><rect x="23" y="-12" width="92" height="24" rx="4"/><text x="69" y="4" text-anchor="middle">{{(time/1000).toFixed(2)}} s</text></g>
  <g v-for="(entry,i) in sequences" :key="entry.row.object.id" :data-sequence="entry.row.object.id" :data-progress="entry.progress" :data-phase="packetPhase(entry.row,time)" :class="['sequence-packet','animated-sequence',packetPhase(entry.row,time),{focused:selected===entry.row.object.id,hovered:hover===entry.row.object.id,returning:entry.row.fields.source!==endpoints[0]?.id}]" role="button" tabindex="0" :aria-label="`${entry.row.fields.flags} 时序`" @mouseenter="hover=entry.row.object.id" @mouseleave="hover=null" @click="emit('packet',entry.row.object.id,entry.row.sentAt)" @keydown.enter="emit('packet',entry.row.object.id,entry.row.sentAt)" @keydown.space.prevent="emit('packet',entry.row.object.id,entry.row.sentAt)">
   <rect x="130" :y="entry.from.y-31" width="735" height="99" rx="5" class="sequence-hit"/>
   <text x="138" :y="entry.from.y-20" class="sequence-step-label">{{String(i+1).padStart(2,'0')}} · {{scene.steps[entry.row.stepIndex]?.title}}</text>
   <path :d="`M130 ${entry.from.y-10}H865`" class="sequence-step-rule"/>
   <template v-if="entry.started">
    <circle :cx="entry.from.x" :cy="entry.from.y" r="3.5" class="sequence-origin"/>
    <path v-if="entry.progress>0" :d="`M${entry.from.x} ${entry.from.y}L${entry.head.x} ${entry.head.y}`" :marker-end="`url(#${uid}seq)`" class="sequence-trace"/>
    <g :transform="`translate(${entry.head.x},${entry.head.y})`" class="sequence-traveler"><circle v-if="!entry.arrived" r="10" class="traveler-glow"/><circle :r="entry.arrived?4:5"/><circle v-if="entry.arrived" r="10" class="arrival-ring"/></g>
    <g :transform="`translate(${(entry.from.x+entry.to.x)/2},${(entry.from.y+entry.to.y)/2-13})`" class="sequence-message-label"><rect x="-136" y="-17" width="272" height="25" rx="4"/><text text-anchor="middle" y="0">{{entry.row.fields.flags}} · Seq={{entry.row.fields.seq}} {{entry.row.fields.ack===undefined?'':`Ack=${entry.row.fields.ack}`}}</text></g>
    <text :x="entry.to.x+(entry.to.x>entry.from.x?13:-13)" :y="entry.to.y+4" :text-anchor="entry.to.x>entry.from.x?'start':'end'" class="sequence-delivery">{{entry.arrived?'已到达':Math.round(entry.progress*100)+'%'}}</text>
   </template>
   <text v-else x="500" :y="entry.from.y+20" text-anchor="middle" class="sequence-waiting">等待第 {{i+1}} 个报文发送</text>
   <title>{{packetSummary(entry.row)}} · {{entry.row.source.content.label}} → {{entry.row.target.content.label}}</title>
  </g>
  <text x="500" y="546" text-anchor="middle" class="sequence-note">时间向下流动 · 箭头从发送端延伸至接收端 · 点击回看该报文</text>
 </svg>
</template>
