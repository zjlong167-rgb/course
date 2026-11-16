<script setup lang="ts">
defineProps<{kind:string}>()
</script>
<template>
 <svg viewBox="0 0 160 150" fill="none" aria-hidden="true" class="device-glyph">
  <ellipse cx="82" cy="133" rx="65" ry="13" fill="currentColor" opacity=".09"/>
  <g stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round">
   <template v-if="kind==='laptop'">
    <path d="M24 30 101 10 105 91 28 114Z" fill="#f0f4ff"/><path d="m32 37 61-17 3 62-62 19Z" fill="white"/>
    <path d="m28 114 77-23 44 29-79 25-49-26Z" fill="#e0e9ff"/><path d="m21 119 49 26 79-25v6l-79 24-49-26Z" fill="#9ebaf1"/>
    <path d="m43 111 57-16 28 20-58 17Z" fill="white"/><path d="m51 112 54-15m-44 21 53-16m-44 22 53-16m-60-4 22 17m-11-20 22 17m-10-20 22 17" stroke-width="1" opacity=".5"/>
    <path d="m37 43 51-14v8l-51 14Z" fill="#d5e2fc" stroke="none"/><path d="m40 47 46-13m-46 24 29-8m-28 19 41-12m-41 23 24-7" stroke-width="4" opacity=".25"/>
   </template>
   <template v-else-if="kind==='server'">
    <path d="m45 17 57-12 36 25-58 16Z" fill="#eef3ff"/><path d="m45 17 35 29v89l-35-29Z" fill="#d7e3ff"/><path d="m80 46 58-16v89l-58 16Z" fill="white"/>
    <path d="m87 55 44-13v18L87 73Zm0 28 44-13v18l-44 13Zm0 28 44-13v16l-44 13Z" fill="#e7eeff"/>
    <path d="m95 60 19-6m-19 34 19-6m-19 32 19-6"/><path d="m53 34 17 14v67l-17-14Z" fill="#a9bff0"/>
    <path d="m116 47 11-3m-11 31 11-3m-11 31 11-3" stroke-width=".8" opacity=".5"/><circle cx="123" cy="53" r="2" fill="#26ad82" stroke="none"/><circle cx="123" cy="81" r="2" fill="#26ad82" stroke="none"/>
   </template>
   <template v-else-if="kind==='router'">
    <path d="m17 77 65-31 63 34-65 33Z" fill="#f7f9ff"/><path d="m17 77 63 36v29l-63-36Z" fill="#dce7ff"/><path d="m80 113 65-33v29l-65 33Z" fill="#f0f4ff"/>
    <path d="M45 61V20m0 0-1-8" stroke-width="4"/><circle cx="45" cy="10" r="4" fill="white"/>
    <path d="m27 91 13 7v10l-13-7Zm20 11 13 7v9l-13-7Z" fill="white"/><path d="m93 117 37-18v8l-37 18Z" fill="#a9bff0"/>
    <path d="m67 68 15-7 14 8-15 8Z" fill="#dce7ff"/>
   </template>
   <template v-else>
    <path d="M39 118C5 116 8 77 34 72c-4-27 25-40 45-26 12-28 49-19 50 9 31 0 39 45 10 56-10 24-38 27-54 12-17 13-36 9-46-5Z" fill="white"/>
    <circle cx="83" cy="86" r="24" fill="#edf3ff"/><ellipse cx="83" cy="86" rx="10" ry="24"/><path d="M59 86h48m-44-12h40m-40 24h40"/>
   </template>
  </g>
 </svg>
</template>
