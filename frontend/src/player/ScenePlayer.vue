<script setup lang="ts">
import {computed,onBeforeUnmount,onMounted,ref,shallowRef,watch} from 'vue'
import {VueFlow,Handle,Position} from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import katex from 'katex'
import NetworkLesson from './NetworkLesson.vue'
import BusinessFlow from './BusinessFlow.vue'
import {isNetworkScene} from './network'
import './learning.css'
import './business.css'
import type {Course,SceneObject} from './model'
import {rebuild,duration,starts,LogicalClock} from './engine'
import {assertRegistered,formulaTex,toFlow} from './registry'
const props=defineProps<{course:Course;resolveAsset:(id:string)=>string|undefined;initialTime?:number}>()
const emit=defineEmits<{position:[time:number]}>()
assertRegistered(props.course)
const scene=props.course.chapters[0]!.scenes[0]!
const clock=new LogicalClock(duration(scene))
const time=ref(0),playing=ref(false),selected=ref<string|null>(null),speed=ref(1)
const network=isNetworkScene(scene)
const business=props.course.category==='business' && scene.objects.some(o=>o.type==='edge')
const frame=computed(()=>rebuild(scene,time.value))
const flow=computed(()=>toFlow(scene.objects,frame.value.states))
const overlays=scene.objects.filter(o=>o.component!=='flow')
const step=computed(()=>scene.steps[frame.value.stepIndex]!)
const detail=computed(()=>scene.objects.find(o=>o.id===selected.value))
const detailState=computed(()=>selected.value?frame.value.states[selected.value]:undefined)
const offsets=starts(scene)
function sync(){time.value=Math.round(clock.timeMs);playing.value=clock.playing}
clock.seek(props.initialTime??0);sync()
watch(time,t=>emit('position',t))
function seek(t:number){clock.seek(t);sync()}
function toggle(){if(clock.playing)clock.pause();else clock.play();sync()}
function back(){const i=frame.value.stepIndex;seek(time.value===offsets[i]?offsets[Math.max(0,i-1)]!:offsets[i]!)}
function next(){seek(offsets[frame.value.stepIndex+1]??duration(scene))}
function replay(){seek(0);clock.play();sync()}
function changeSpeed(value:number){clock.setSpeed(value);speed.value=value;sync()}
function pick(id:string,t:number){selected.value=id;seek(t)}
function keyboard(event:KeyboardEvent){if(event.altKey||event.ctrlKey||event.metaKey||(event.target as Element)?.closest('button,input,select,textarea,a,[role="button"],[contenteditable]'))return;if(event.code==='Space'){event.preventDefault();toggle()}else if(event.key==='ArrowRight'){event.preventDefault();next()}else if(event.key==='ArrowLeft'){event.preventDefault();back()}else if(event.key==='Home'){event.preventDefault();seek(0)}}
function tex(o:SceneObject){return katex.renderToString(formulaTex(o,frame.value.states[o.id]!),{throwOnError:false,trust:false,strict:'error',output:'htmlAndMathml',maxExpand:1000})}
function points(o:SceneObject){const p=o.content.points!;const minX=Math.min(...p.map(v=>v.x)),minY=Math.min(...p.map(v=>v.y));const w=Math.max(...p.map(v=>v.x))-minX||1,h=Math.max(...p.map(v=>v.y))-minY||1;return p.map(v=>`${(v.x-minX)/w*o.size.width},${(v.y-minY)/h*o.size.height}`).join(' ')}
const assetError=shallowRef('')
const scrollHost=ref<HTMLElement|null>(null), scale=ref(1)
let resize:ResizeObserver|undefined
let raf=0
function loop(now:number){if(!document.hidden){clock.tick(now);sync()}raf=requestAnimationFrame(loop)}
function visibility(){clock.suspend()}
onMounted(()=>{raf=requestAnimationFrame(loop);document.addEventListener('visibilitychange',visibility);document.addEventListener('keydown',keyboard);resize=new ResizeObserver(entries=>{scale.value=Math.min(1,Math.max(business?0.85:0.6,entries[0]!.contentRect.width/scene.canvas.width))});if(scrollHost.value)resize.observe(scrollHost.value)})
onBeforeUnmount(()=>{resize?.disconnect();cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',keyboard)})
</script>
<template>
 <section class="shared-player" :data-course="course.id" :data-time="time" :data-playing="playing" :class="{'network-player':network,'business-player':business}">
  <NetworkLesson v-if="network" :course="course" :scene="scene" :states="frame.states" :time="time" :step-index="frame.stepIndex" :selected="selected" :playing="playing" :speed="speed" :total="duration(scene)" :offsets="offsets" @seek="seek" @select="selected=$event" @pick="pick" @toggle="toggle" @back="back" @next="next" @reset="seek(0)" @replay="replay" @speed="changeSpeed"/>
  <template v-else>
  <div class="player-intro"><span class="tag">{{business?'业务流程 / 跟随单据，理解每一次流转':'共享播放器 · 格式 '+course.formatVersion}}</span><h2>{{course.title}}</h2><p>{{course.summary}}</p></div>
  <div v-if="business" class="business-context"><div><span>当前演示路径</span><strong>{{scene.title}}</strong></div><p><i></i> 蓝色：当前处理角色与路径 <b>■</b> 深色：流转中的单据</p><small>预设路径演示 · 切换上方场景查看其他路径 · 小屏可左右滑动画布</small></div>
  <div class="player-layout">
   <div ref="scrollHost" class="stage-scroll"><div :style="{width:scene.canvas.width*scale+'px',height:scene.canvas.height*scale+'px'}"><div class="player-stage" :style="{width:scene.canvas.width+'px',height:scene.canvas.height+'px',transform:`scale(${scale})`,transformOrigin:'top left'}">
    <BusinessFlow v-if="business" :scene="scene" :states="frame.states" :selected="selected" @select="selected=$event"/>
    <VueFlow v-else :id="course.id" :nodes="flow.nodes" :edges="flow.edges" :default-viewport="{x:0,y:0,zoom:1}" :min-zoom="1" :max-zoom="1" :nodes-draggable="false" :nodes-connectable="false" :pan-on-drag="false" :zoom-on-scroll="false" :zoom-on-double-click="false" :zoom-on-pinch="false" :prevent-scrolling="false" @node-click="selected=$event.node.id" @edge-click="selected=$event.edge.id">
     <template #node-course="{data}"><div class="flow-object" :class="{highlight:data.state.highlight,packet:data.kind==='packet'}"><Handle type="target" :position="Position.Left"/><strong>{{data.label}}</strong><small>{{data.state.status}}</small><Handle type="source" :position="Position.Right"/></div></template>
    </VueFlow>
    <svg class="object-overlay" :viewBox="`0 0 ${scene.canvas.width} ${scene.canvas.height}`" aria-label="公式、几何和图片标注">
     <g v-for="o in overlays" :key="o.id" v-show="frame.states[o.id]!.visible" :data-object="o.id" :transform="`translate(${frame.states[o.id]!.position.x},${frame.states[o.id]!.position.y})`" class="overlay-item" :class="{highlight:frame.states[o.id]!.highlight}" role="button" tabindex="0" :aria-label="o.content.label" @click="selected=o.id" @keydown.enter="selected=o.id" @keydown.space.prevent="selected=o.id">
      <template v-if="o.type==='geometry'"><polygon :points="points(o)"/><text :y="o.size.height+25">{{o.content.label}}</text></template>
      <foreignObject v-else-if="o.type==='formula'" :width="o.size.width" :height="o.size.height"><div class="rendered-formula" v-html="tex(o)"></div></foreignObject>
      <template v-else-if="o.type==='image'"><image :href="resolveAsset(o.content.assetId!)" :width="o.size.width" :height="o.size.height" @error="assetError='图片加载失败'"/><rect :width="o.size.width" :height="o.size.height" fill="none"/><text :y="o.size.height+23">{{o.content.label}}</text></template>
      <text v-else y="20">{{o.content.label}}</text>
     </g>
    </svg>
   </div></div></div>
   <aside class="player-info"><span class="tag">步骤 {{frame.stepIndex+1}} / {{scene.steps.length}}</span><h3>{{step.title}}</h3><p data-testid="narration">{{step.narration}}</p><div class="player-steps"><button v-for="(s,i) in scene.steps" :key="s.id" :class="{selected:i===frame.stepIndex}" @click="seek(offsets[i]!)">{{i+1}} · {{s.title}}</button></div>
    <section v-if="overlays.some(o=>o.type==='formula' && frame.states[o.id]!.visible)" class="formula-reading" aria-label="当前公式"><h3>当前公式</h3><div v-for="o in overlays.filter(o=>o.type==='formula' && frame.states[o.id]!.visible)" :key="o.id" class="formula-reading-scroll" v-html="tex(o)"></div></section><h3>对象详情</h3><label>选择对象<select aria-label="选择对象" v-model="selected"><option :value="null">请选择</option><option v-for="o in scene.objects" :key="o.id" :value="o.id">{{o.content.label}}</option></select></label>
    <div v-if="detail && detailState" data-testid="details"><h4>{{detail.content.label}}</h4><dl><template v-for="(value,key) in detail.details" :key="key"><dt>{{key}}</dt><dd>{{value}}</dd></template><dt>当前状态</dt><dd>{{business ? ({paid:'已支付',idle:'待处理',submitted:'已提交'}[detailState.status] ?? detailState.status) : detailState.status}}</dd><template v-if="!business"><dt>可见 / 高亮</dt><dd>{{detailState.visible}} / {{detailState.highlight}}</dd><dt>位置</dt><dd>{{Math.round(detailState.position.x)}}, {{Math.round(detailState.position.y)}}</dd></template></dl></div><p v-else>点击画布或选择对象，查看当前时间的状态。</p>
   </aside>
  </div>
  <div class="player-controls"><button @click="back">回退</button><button class="primary" @click="toggle">{{playing?'暂停':'播放'}}</button><button @click="next">下一步</button><button @click="seek(0)">重置</button><button @click="replay">重播</button><label>倍速<select aria-label="播放倍速" :value="speed" @change="changeSpeed(Number(($event.target as HTMLSelectElement).value))"><option v-for="v in [0.5,1,1.5,2]" :value="v">{{v}}×</option></select></label><output data-testid="time">{{time}} / {{duration(scene)}} ms</output><label class="seek-label">时间跳转<input aria-label="时间跳转" type="range" min="0" :max="duration(scene)" :value="time" @input="seek(Number(($event.target as HTMLInputElement).value))"></label></div>
  <p v-if="assetError" role="alert">{{assetError}}</p><p class="muted">小屏可横向浏览画布 · {{business?'金额、授权额度和审批规则为教学示例，以企业制度为准':'内容及正式素材待作者确认'}}</p>
  </template>
 </section>
</template>
