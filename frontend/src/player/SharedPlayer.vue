<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import ScenePlayer from './ScenePlayer.vue'
import type {Course} from './model'
export type PlayerPosition={sceneId:string;timeMs:number}
const props=defineProps<{course:Course;resolveAsset:(id:string)=>string|undefined;initialPosition?:PlayerPosition}>()
const emit=defineEmits<{position:[position:PlayerPosition]}>()
const scenes=computed(()=>props.course.chapters.flatMap(chapter=>chapter.scenes.map(scene=>({chapter,scene}))))
const index=ref(Math.max(0,scenes.value.findIndex(x=>x.scene.id===props.initialPosition?.sceneId))),generation=ref(0)
watch(()=>props.course,()=>{index.value=0;generation.value++})
watch(index,()=>{generation.value++;emit('position',{sceneId:scenes.value[index.value]!.scene.id,timeMs:0})})
const current=computed(()=>scenes.value[index.value])
const view=computed(()=>current.value?({...props.course,chapters:[{...current.value.chapter,scenes:[current.value.scene]}]}):props.course)
</script>
<template><template v-if="current"><nav v-if="scenes.length>1" class="scene-navigation"><label>章节 / 场景<select aria-label="章节 / 场景" v-model="index"><option v-for="(item,i) in scenes" :value="i" :key="item.scene.id">{{item.chapter.title}} / {{item.scene.title}}</option></select></label><span>切换后暂停并从 0ms 开始</span></nav><ScenePlayer :key="`${generation}:${current.scene.id}`" :course="view" :resolve-asset="resolveAsset" :initial-time="generation===0 && current.scene.id===initialPosition?.sceneId ? initialPosition.timeMs : 0" @position="emit('position',{sceneId:current!.scene.id,timeMs:$event})"/></template><p v-else role="status">课程暂无场景。</p></template>
