<script setup lang="ts">
import {computed,ref} from 'vue'
import type {Course,Scene,ObjectState} from './model'
import {packetTimeline,packetPhase,phaseLabel,packetSummary} from './network'
import NetworkCanvas from './NetworkCanvas.vue'
import UiIcon from './UiIcon.vue'
const props=defineProps<{course:Course;scene:Scene;states:Record<string,ObjectState>;time:number;stepIndex:number;selected:string|null;playing:boolean;speed:number;total:number;offsets:number[]}>()
const emit=defineEmits<{seek:[time:number];select:[id:string|null];pick:[id:string,time:number];toggle:[];back:[];next:[];reset:[];replay:[];speed:[value:number]}>()
const view=ref('network')
const packets=computed(()=>packetTimeline(props.scene))
const current=computed(()=>packets.value.find(p=>p.stepIndex===props.stepIndex))
const selectedId=computed(()=>props.selected??current.value?.object.id??null)
const selectedObject=computed(()=>props.scene.objects.find(o=>o.id===selectedId.value))
const selectedPacket=computed(()=>packets.value.find(p=>p.object.id===selectedId.value))
const selectedState=computed(()=>selectedId.value?props.states[selectedId.value]:undefined)
const step=computed(()=>props.scene.steps[props.stepIndex]!)
const reached=computed(()=>packets.value.filter(p=>packetPhase(p,props.time)==='received').length)
function chooseStep(i:number){const row=packets.value.find(p=>p.stepIndex===i);if(row)emit('pick',row.object.id,props.offsets[i]!);else emit('seek',props.offsets[i]!)}
const seconds=(t:number)=>(t/1000).toFixed(2)
</script>
<template>
 <div class="network-lesson">
  <aside class="lesson-nav" aria-label="课程步骤">
   <div class="lesson-nav-heading"><span class="section-kicker">NETWORK FUNDAMENTALS</span><h1>{{course.title}}</h1><p>三个报文，建立一次可靠连接。</p></div>
   <div class="lesson-section-label">课程章节 <span>01</span></div>
   <div class="lesson-chapter"><span class="chapter-icon"><UiIcon name="arrow"/></span><div><strong>打开连接</strong><small>TCP · 三次握手</small></div><span class="chapter-count">3</span></div>
   <ol class="lesson-step-list"><li v-for="(s,i) in scene.steps" :key="s.id" :class="{active:i===stepIndex,complete:time>=offsets[i]!+s.durationMs}"><button :aria-current="i===stepIndex?'step':undefined" @click="chooseStep(i)"><span class="step-dot">{{time>=offsets[i]!+s.durationMs?'✓':i+1}}</span><span><strong>{{s.title}}</strong><small>{{packets.find(p=>p.stepIndex===i)?.fields.flags}}</small></span><span v-if="i===stepIndex" class="step-caret">›</span></button></li></ol>
   <div class="lesson-goal"><span class="goal-icon"><UiIcon name="target"/></span><h3>这一课，你会理解</h3><p>SYN 为什么占用序列号？<br>ACK 确认的到底是什么？<br>两端何时进入连接状态？</p></div>
   <div class="lesson-progress"><div><span>报文到达</span><b>{{reached}} / {{packets.length}}</b></div><div class="lesson-progress-track"><i :style="{width:reached/packets.length*100+'%'}"></i></div><small>{{time===total?'连接已建立，试着回看每一步。':'按自己的节奏，逐步探索。'}}</small></div>
  </aside>
  <div class="mobile-step-narration"><span>STEP {{stepIndex+1}} / {{scene.steps.length}}</span><p>{{step.narration}}</p></div>
  <section class="network-board" aria-label="网络演示">
   <div class="board-toolbar"><div class="view-switch" role="group" aria-label="画布视图"><button :aria-pressed="view==='network'" :class="{active:view==='network'}" @click="view='network'"><UiIcon name="network"/>网络</button><button :aria-pressed="view==='sequence'" :class="{active:view==='sequence'}" @click="view='sequence'"><UiIcon name="sequence"/>时序</button></div><span class="board-live"><i :class="{running:playing}"></i>{{playing?'正在演示':time===total?'演示完成':'自由探索'}}</span></div>
   <div class="network-canvas-host"><NetworkCanvas :scene="scene" :states="states" :packets="packets" :time="time" :selected="selectedId" :view="view" :playing="playing" @select="emit('select',$event)" @packet="(id,t)=>emit('pick',id,t)"/></div>
   <div class="canvas-caption"><span class="canvas-caption-index">{{String(stepIndex+1).padStart(2,'0')}}</span><div><strong>{{step.title}}</strong><span>{{current?.fields.flags}}<template v-if="current"> · {{current.source.content.label}} → {{current.target.content.label}}</template></span></div><span class="canvas-status">{{current?phaseLabel(packetPhase(current,time)):''}}</span></div>
   <div class="canvas-footnote"><span class="mobile-pan-hint">左右滑动画布 · 点击设备查看详情</span><span class="desktop-canvas-hint">点击设备或报文，探索其中的细节</span><span>教学时间 · 非真实链路时延</span></div>
  </section>
  <aside class="network-inspector" aria-label="讲解与报文详情">
   <div class="inspector-header"><span>跟随报文，理解连接</span><span class="lesson-layer">L4 传输层</span></div>
   <section class="teaching-note"><span class="section-kicker">STEP {{String(stepIndex+1).padStart(2,'0')}} / {{String(scene.steps.length).padStart(2,'0')}}</span><h2>{{step.title}}</h2><p data-testid="narration">{{step.narration}}</p>
    <div v-if="current" class="sequence-equation"><span>{{current.fields.ack===undefined?'初始序列号':'发送序列号 SEQ'}}<b>{{current.fields.seq}}</b></span><span class="equation-arrow">→</span><span>{{current.fields.ack===undefined?'对端将确认':'确认号 ACK'}}<b>{{current.fields.ack??current.fields.seq+1}}</b></span></div>
   </section>
   <section class="packet-inspector"><div class="detail-heading"><h3>{{selectedPacket?'报文详情':'设备详情'}}</h3><span v-if="selectedPacket" class="detail-protocol">{{selectedPacket.fields.protocol}}</span></div>
    <label class="object-picker"><span class="sr-only">选择对象</span><select aria-label="选择对象" :value="selectedId??''" @change="emit('select',($event.target as HTMLSelectElement).value||null)"><option value="">跟随当前步骤</option><option v-for="o in scene.objects.filter(o=>o.type!=='edge')" :key="o.id" :value="o.id">{{o.content.label}}</option></select></label>
    <div v-if="selectedObject&&selectedState" data-testid="details" class="learning-details">
     <template v-if="selectedPacket"><div class="packet-flags"><span>{{selectedPacket.fields.flags}}</span><small :data-detail-phase="packetPhase(selectedPacket,time)">{{phaseLabel(packetPhase(selectedPacket,time))}}</small></div><dl class="packet-fields"><dt>源地址</dt><dd>{{selectedPacket.source.content.address}}<small>:{{selectedPacket.fields.sourcePort}}</small></dd><dt>目的地址</dt><dd>{{selectedPacket.target.content.address}}<small>:{{selectedPacket.fields.targetPort}}</small></dd><dt>序列号 <code>SEQ</code></dt><dd>{{selectedPacket.fields.seq}}</dd><dt>确认号 <code>ACK</code></dt><dd>{{selectedPacket.fields.ack??'—'}}</dd><dt>帧大小</dt><dd>{{selectedPacket.fields.bytes}} B</dd></dl></template>
     <template v-else><h4>{{selectedObject.content.label}}</h4><dl class="packet-fields"><dt>地址</dt><dd>{{selectedObject.content.address}}</dd><dt>当前状态</dt><dd>{{selectedState.status}}</dd></dl></template>
     <details class="field-explanation"><summary>为什么这样设计？</summary><p v-for="(value,key) in selectedObject.details" :key="key"><b>{{key}}</b>{{value}}</p></details>
    </div>
   </section>
  </aside>
  <section class="packet-console" aria-label="数据包流">
   <div class="console-toolbar"><div class="console-title"><h2>数据包流</h2><span><i></i> TCP <b>{{packets.length}}</b></span></div><div class="transport-controls"><label><span class="sr-only">播放速度</span><select aria-label="播放速度" :value="speed" @change="emit('speed',Number(($event.target as HTMLSelectElement).value))"><option v-for="rate in [0.5,1,1.5,2]" :key="rate" :value="rate">{{rate}}×</option></select></label><button aria-label="回退" title="回退 · ←" @click="emit('back')"><UiIcon name="back"/></button><button class="play-button" @click="emit('toggle')"><UiIcon :name="playing?'pause':'play'"/>{{playing?'暂停':'播放'}}</button><button title="下一步 · →" @click="emit('next')">下一步</button><button @click="emit('reset')"><UiIcon name="reset"/>重置</button><button title="从头播放" @click="emit('replay')">重播</button></div></div>
   <div class="lesson-scrubber"><output data-testid="time">{{seconds(time)}} / {{seconds(total)}} s</output><input aria-label="时间跳转" type="range" min="0" :max="total" :value="time" :style="{'--progress':time/total*100+'%'}" @input="emit('seek',Number(($event.target as HTMLInputElement).value))"><span class="keyboard-tip">空格 播放 / 暂停</span></div>
   <div class="packet-table-scroll"><table class="packet-table"><thead><tr><th>序号</th><th>教学时间</th><th>源地址</th><th>目的地址</th><th>协议</th><th>报文信息</th><th>大小</th><th>状态</th></tr></thead><tbody><tr v-for="(row,i) in packets" :key="row.object.id" :data-row="row.object.id" :data-phase="packetPhase(row,time)" :class="[packetPhase(row,time),{selected:selectedId===row.object.id}]" :aria-selected="selectedId===row.object.id" @click="emit('pick',row.object.id,row.sentAt)"><td><button :aria-label="`查看 ${row.fields.flags} 报文`" @click.stop="emit('pick',row.object.id,row.sentAt)">{{String(i+1).padStart(2,'0')}}</button></td><td>{{seconds(row.sentAt)}} s</td><td>{{row.source.content.address}}</td><td>{{row.target.content.address}}</td><td><span class="protocol-pill">{{row.fields.protocol}}</span></td><td class="packet-info-cell">{{packetSummary(row)}}</td><td>{{row.fields.bytes}} B</td><td><span class="phase-indicator"></span>{{phaseLabel(packetPhase(row,time))}}</td></tr></tbody></table></div>
   <div class="console-footer"><span><i class="legend-dot sending"></i>传输中 <i class="legend-dot received"></i>已到达 <i class="legend-dot pending"></i>待发送</span><span>点击任一报文，回到它出发的时刻</span></div>
  </section>
 </div>
</template>
