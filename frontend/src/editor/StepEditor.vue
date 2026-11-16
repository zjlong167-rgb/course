<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { Step, Scene, Action } from '../player/model'
import { uid } from './adapter'
const props=defineProps<{scene:Scene}>()
const emit=defineEmits<{change:[Step[]]}>()
const index=ref(0), ai=ref(0), notice=ref(''), panel=ref<HTMLElement>()
const step=computed(()=>props.scene.steps[index.value]), action=computed(()=>step.value?.actions[ai.value])
const kinds:Record<string,string>={show:'显示',hide:'隐藏',highlight:'高亮',move:'移动',setState:'修改状态'}
function value(e:Event){return (e.target as HTMLInputElement).value}
function edit(fn:(steps:Step[],s:Step,a:Action)=>void){
 const steps:Step[]=JSON.parse(JSON.stringify(props.scene.steps))
 fn(steps,steps[index.value],steps[index.value]?.actions[ai.value])
 emit('change',steps);notice.value=''
}
function addStep(){edit(steps=>steps.push({id:uid('step'),title:'新步骤',narration:'在此填写讲解。',durationMs:3000,actions:[]}));index.value=props.scene.steps.length;ai.value=0}
function delStep(){
 if(props.scene.steps.length===1){notice.value='场景至少保留一个步骤';return}
 if(!confirm('删除「'+step.value!.title+'」及其中 '+step.value!.actions.length+' 个动作？'))return
 edit(steps=>steps.splice(index.value,1));index.value=Math.max(0,index.value-1);ai.value=0
}
function reorder(which:'step'|'action',delta:number){
 const selected=which==='step'?index:ai,i=selected.value
 edit((steps,s)=>{const list=which==='step'?steps:s.actions;[list[i],list[i+delta]]=[list[i+delta],list[i]]})
 selected.value+=delta;notice.value=which==='step'?'步骤和所属动作已一起移动。':'动作顺序已更新；同一时刻靠后的动作优先。'
}
function addAction(){edit((_,s)=>s.actions.push({id:uid('action'),type:'show',target:props.scene.objects[0].id,atMs:0,durationMs:0,params:{}}));ai.value=step.value!.actions.length}
function delAction(){if(!confirm('删除当前动作？'))return;edit((_,s)=>s.actions.splice(ai.value,1));ai.value=Math.max(0,ai.value-1)}
function typeChange(e:Event){
 const t=value(e),a=action.value!
 if((a.durationMs||Object.keys(a.params).length)&&!confirm('更换类型将重置此动作的持续时间及参数。继续？')){(e.target as HTMLSelectElement).value=a.type;return}
 edit((_,__,a)=>{a.type=t;a.durationMs=0;a.params=t==='move'?{x:props.scene.objects.find(o=>o.id===a.target)?.position.x??0,y:props.scene.objects.find(o=>o.id===a.target)?.position.y??0}:t==='highlight'?{value:true}:t==='setState'?{value:'ready'}:{}})
}
function time(e:Event,key:'step'|'atMs'|'durationMs'){
 const input=e.target as HTMLInputElement,n=input.valueAsNumber,s=step.value!,a=action.value
 let why=''
 if(!Number.isInteger(n)||n<(key==='step'?1:0)||n>86400000)why='时间须为范围内的整数毫秒（最多 86400000）。'
 else if(key==='step'){const conflict=s.actions.find(a=>a.atMs+a.durationMs>n);if(conflict)why='不能缩短：动作 '+(s.actions.indexOf(conflict)+1)+' 在 '+(conflict.atMs+conflict.durationMs)+' ms 结束。请先调整该动作。'}
 else if(n+(key==='atMs'?a!.durationMs:a!.atMs)>s.durationMs)why='动作结束时间超过本步骤，请先延长步骤或缩短动作。'
 if(why){notice.value=why;input.value=String(key==='step'?s.durationMs:a![key]);return}
 edit((_,s,a)=>{if(key==='step')s.durationMs=n;else a[key]=n})
}
async function locate(i:number,j:number,field:string){
 index.value=i;ai.value=j;await nextTick()
 const input=Array.from(panel.value?.querySelectorAll<HTMLElement>('[data-field]')??[]).find(el=>el.dataset.field===field)
 ;(input??panel.value)?.focus();panel.value?.scrollIntoView({block:'center'})
}
defineExpose({locate})
</script>
<template><section class="step-composer" ref="panel" tabindex="-1"><h2>步骤编排</h2>
<div class="step-toolbar"><label>教学步骤<select aria-label="教学步骤" v-model="index" @change="ai=0;notice=''"><option v-for="(s,i) in scene.steps" :key="s.id" :value="i">{{i+1}}. {{s.title}} · {{s.durationMs}} ms</option></select></label>
<button @click="addStep">新增步骤</button><button :disabled="!index" @click="reorder('step',-1)">步骤上移</button><button :disabled="index>=scene.steps.length-1" @click="reorder('step',1)">步骤下移</button><button @click="delStep">删除步骤</button></div>
<template v-if="step"><div class="step-fields"><label>步骤标题<input data-field="title" :value="step.title" @input="edit((_,s)=>s.title=value($event))"></label><label>步骤时长（ms）<input data-field="stepDuration" type="number" :value="step.durationMs" @change="time($event,'step')"></label></div>
<label>步骤讲解<textarea data-field="narration" :value="step.narration" @input="edit((_,s)=>s.narration=value($event))"/></label>
<h3>动作序列</h3><div class="step-toolbar"><label v-if="step.actions.length">编辑动作<select aria-label="编辑动作" v-model="ai"><option v-for="(a,i) in step.actions" :value="i" :key="a.id">{{i+1}}. {{kinds[a.type]}} · {{scene.objects.find(o=>o.id===a.target)?.content.label || '目标缺失'}} · {{a.atMs}} ms</option></select></label><span v-else>此步骤只展示画面和讲解。</span><button @click="addAction">新增动作</button><template v-if="action"><button :disabled="!ai" @click="reorder('action',-1)">动作上移</button><button :disabled="ai>=step.actions.length-1" @click="reorder('action',1)">动作下移</button><button @click="delAction">删除动作</button></template></div>
<div class="step-fields" v-if="action"><label>动作目标<select aria-label="动作目标" data-field="target" :value="action.target" @change="edit((_,__,a)=>a.target=value($event))"><option v-for="o in scene.objects" :value="o.id">{{o.content.label}}</option></select></label>
<label>动作类型<select aria-label="动作类型" data-field="type" :value="action.type" @change="typeChange"><option v-for="(label,k) in kinds" :value="k">{{label}}</option></select></label>
<label>开始时间（ms）<input data-field="atMs" type="number" :value="action.atMs" @change="time($event,'atMs')"></label><label>持续时间（ms）<input data-field="durationMs" type="number" :disabled="action.type!=='move' && !action.durationMs" :value="action.durationMs" @change="time($event,'durationMs')"></label>
<template v-if="action.type==='move'"><label v-for="k in (['x','y'] as const)">终点 {{k}}<input :data-field="k" type="number" :value="action.params[k]" @input="edit((_,__,a)=>a.params[k]=($event.target as HTMLInputElement).valueAsNumber)"></label></template>
<label v-if="action.type==='highlight'">高亮效果<select aria-label="高亮效果" data-field="value" :value="String(action.params.value)" @change="edit((_,__,a)=>a.params.value=value($event)==='true')"><option value="true">开启</option><option value="false">关闭</option></select></label>
<label v-if="action.type==='setState'">目标状态<input data-field="value" :value="action.params.value" @input="edit((_,__,a)=>a.params.value=value($event))"></label></div></template>
<p role="status">{{notice}}</p></section></template>
<style scoped>.step-composer{background:#f8fbf9;color:#243e33;margin:20px 0;padding:18px;border:1px solid #c9d8ce;border-radius:8px}.step-toolbar,.step-fields{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.step-toolbar label{min-width:210px}.step-fields label{flex:1;min-width:130px}.step-composer textarea{min-height:74px!important}.step-composer p{color:#754813}</style>
