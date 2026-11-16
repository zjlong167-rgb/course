<script setup lang="ts">
defineProps<{name:string}>()
const paths:Record<string,string>={network:'M4 4h5v5H4zM15 15h5v5h-5zM15 4h5v5h-5zM9 6.5h6M6.5 9v8.5H15',sequence:'M5 3v18M19 3v18M5 8h14m-4-3 4 3-4 3M19 16H5m4-3-4 3 4 3',play:'m8 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',back:'M9 5 3 11l6 6M4 11h10a6 6 0 0 1 6 6',next:'m9 5 7 7-7 7M20 5v14',reset:'M3 10a9 9 0 1 1 1 8M3 4v6h6',fullscreen:'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5',arrow:'M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4',flow:'M3 12h18m-5-5 5 5-5 5M3 5v14',triangle:'M12 3 22 21H2Z',production:'M4 21V10l6 4V8l7 4V3h4v18Z',target:'M21 12a9 9 0 1 1-9-9M12 7a5 5 0 1 0 5 5M12 12l8-8m-1-3v4h4',check:'m5 12 4 4L19 6',chevron:'m9 5 7 7-7 7',external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7'}
</script>
<template><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]??paths.network"/></svg></template>
