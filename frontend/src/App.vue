<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import katex from 'katex'
const CourseCatalog = defineAsyncComponent(() => import('./player/CourseCatalog.vue'))
const PublishedCourse = defineAsyncComponent(() => import('./player/PublishedCourse.vue'))
const Studio = defineAsyncComponent(() => import('./Studio.vue'))
const PrototypeGallery = defineAsyncComponent(() => import('./player/PrototypeGallery.vue'))
const route = useRoute()
const page = computed(() => String(route.params.page || 'catalog'))
const pages = [['courses','课程列表'],['editor','章节与场景'],['objects','对象属性'],['steps','步骤与动作'],['preview','课程预览'],['versions','版本管理'],['formula','公式实验室'],['prototype','四类场景原型']]
const names = ['TCP 三次握手','报销审批流程','勾股定理','生产加工流程']
const formulas = [String.raw`(a+b)^2=4\cdot\frac{ab}{2}+c^2`,String.raw`a^2+2ab+b^2=2ab+c^2`,String.raw`a^2+b^2=c^2`,String.raw`3^2+4^2=25=5^2`]
const step = ref(0)
const rendered = computed(() => katex.renderToString(formulas[step.value], { throwOnError: true, trust: false, strict: 'error', output: 'htmlAndMathml', displayMode: true, maxExpand: 1000 }))
const feedback = ref('')
</script>

<template>
  <CourseCatalog v-if="page==='catalog'"/><Studio v-else-if="page==='studio'"/><PublishedCourse v-else-if="page==='published'" :slug="String(route.query.slug||'')"/><PrototypeGallery v-else-if="['prototype','learn'].includes(page)"/>
  <div v-else class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/courses"><b>课</b><span>课程工坊<small>COURSE STUDIO</small></span></a>
      <div class="space">作者工作空间 <span>01</span></div>
      <nav><a v-for="([key,label],i) in pages" :key="key" :href="`#/${key}`" :class="{active:page===key}"><span class="nav-icon">{{ ['▦','▤','◇','≡','▷','◷','ƒ','◈'][i] }}</span>{{ label }}</a></nav>
      <div class="sidebar-foot"><i></i> S01 · 契约与工程基础<small>可操作草图 / 非业务后台</small></div>
    </aside>
    <main>
      <header><span>工作空间 <em>/</em> {{ pages.find(p=>p[0]===page)?.[1] }}</span><span class="avatar">作</span></header>
      <section class="content">
        <div class="eyebrow">COURSE STUDIO <span>FOUNDATION / 01</span></div>
        <div class="heading"><div><h1>{{ pages.find(p=>p[0]===page)?.[1] }}</h1><p>{{ page==='prototype' ? '四类契约样例 / 同一逻辑时间 / 技术验证' : page==='courses' ? '把知识变成可以一步步探索的课程。' : '勾股定理 / 基础演示 / 场景 01' }}</p></div><span class="badge">{{page==='prototype'?'S02 场景原型':'S01 交互草图'}}</span></div>
        <template v-if="page==='courses'">
          <div class="metrics"><article><small>课程样例</small><strong>04</strong><span>四类内容，共用一份契约</span></article><article><small>格式版本</small><strong>1.0</strong><span>独立于画布实现</span></article><article><small>当前阶段</small><strong>契约</strong><span>草图操作不保存业务数据</span></article></div>
          <div class="toolbar"><h2>全部课程 <span>4</span></h2><div><button @click="feedback='选择模板：TCP / 审批 / 数学 / 工艺；后续编辑器阶段实现复制及独立 ID。'">从模板创建</button><button class="primary" @click="feedback='空白建课：标题 → 分类 → 新增章节 → 新增场景。后续阶段接入保存。'">＋ 空白建课</button></div></div>
          <p v-if="feedback" role="status" class="notice">{{ feedback }}</p>
          <div class="course-grid"><a v-for="(name,i) in names" :key="name" href="#/editor" class="course-card"><div :class="`cover cover-${i}`"><span>{{ ['↔','⇢','△','⚙'][i] }}</span><small>{{ ['NETWORK','WORKFLOW','MATHEMATICS','PRODUCTION'][i] }}</small></div><div class="card-body"><span class="tag">{{ ['网络协议','业务流程','数学知识','工艺流程'][i] }}</span><h3>{{ name }}</h3><p>基础演示 · 1 个场景 · 3 个步骤</p><footer><span>草稿 · 契约样例</span><b>进入编辑 ↗</b></footer></div></a></div>
        </template>
        <template v-else-if="page==='formula' || page==='preview'">
          <div class="lab"><article class="canvas-panel"><div class="panel-title"><span>场景画布</span><small>SVG + KaTeX / 自适应</small></div><svg viewBox="0 0 480 230" role="img" aria-label="直角三角形"><path d="M100 30 V200 H330 Z" fill="#d6ebe4" stroke="#31765e" stroke-width="3"/><path d="M100 182 H118 V200" fill="none" stroke="#31765e"/><text x="40" y="125">a = 3</text><text x="190" y="225">b = 4</text><text x="230" y="110">c = 5</text></svg><div class="formula-scroll" data-testid="formula" v-html="rendered"></div></article><article class="narration"><span class="tag">步骤 {{ step+1 }} / 4</span><h2>{{ ['面积分解','展开等式','消去相同项','代入验证'][step] }}</h2><p>{{ ['把四个全等直角三角形放入边长 a+b 的正方形，剩余部分面积是 c²。','展开左侧完全平方项，右侧四个三角形面积之和为 2ab。','两边同时消去 2ab，得到两直角边平方和等于斜边平方。','取 a=3、b=4，可得 c=5；公式原型只做作者预设推导。'][step] }}</p><div class="step-list"><button v-for="(_,i) in formulas" :key="i" :class="{selected:step===i}" @click="step=i">{{ String(i+1).padStart(2,'0') }} <span>{{ ['面积分解','展开等式','勾股定理','数值验证'][i] }}</span></button></div></article></div>
          <div class="controls"><span>分步公式验证</span><div><button :disabled="step===0" @click="step--">上一步</button><button class="primary" :disabled="step===3" @click="step++">下一步 →</button><button @click="step=0">重置</button></div></div><p class="muted">此页验证公式显示、预设步骤切换和手机布局。共享时钟、播放、暂停与状态重建在后续阶段实现。</p>
        </template>
        <template v-else-if="page==='versions'">
          <article class="panel"><h2>发布与版本历史</h2><p class="notice">草图：发布前显示格式、引用、资源、组件检查；发布及回滚需管理员权限。</p><table><thead><tr><th>版本</th><th>来源修订</th><th>操作人 / 时间</th><th>状态</th><th>操作</th></tr></thead><tbody><tr><td>v2</td><td>revision 8</td><td>示例作者 / 待接入</td><td>当前发布</td><td>预览</td></tr><tr><td>v1</td><td>revision 4</td><td>示例作者 / 待接入</td><td>历史快照</td><td>预览 / 回滚</td></tr></tbody></table><p>确认回滚弹窗需显示目标版本、影响范围与必填原因；成功后展示审计记录。以上数据仅示意。</p></article>
        </template>
        <template v-else>
          <div class="editor-grid"><article class="panel tree"><h2>章节结构</h2><p>▾ 基础演示</p><div class="tree-selected">◇ 场景 01 · 勾股定理</div><button @click="feedback='新增章节 / 场景入口草图'">＋ 新增</button><small>拖动调整顺序（待实现）</small></article><article class="panel editor-canvas"><div class="panel-title">{{ page==='steps'?'步骤与动作编排':'场景画布' }}<a href="#/preview">预览 ↗</a></div><div v-if="page==='steps'" class="actions"><h3>步骤 02 · 面积等式</h3><label>讲解<textarea readonly>同一大正方形：(a+b)² = 4×ab/2 + c²。</textarea></label><table><thead><tr><th>动作</th><th>目标</th><th>开始 / 持续</th></tr></thead><tbody><tr><td>显示</td><td>formula</td><td>0 / 0 ms</td></tr></tbody></table><button @click="feedback='动作表单：类型、目标、开始毫秒、持续毫秒、参数；校验错误定位到动作。'">＋ 添加动作</button></div><div v-else class="wire-canvas"><div>△<small>triangle · 直角三角形</small></div><div>a² + b² = c²<small>formula · 面积等式</small></div></div><div class="timeline">01 观察直角边 <b>02 面积等式</b> 03 整理结果</div></article><article class="panel properties"><h2>对象属性</h2><label>对象 ID<input value="triangle" readonly></label><label>组件<input value="geometry @ 1.0.0" readonly></label><label>位置 X / Y<input value="80 / 100" readonly></label><label>尺寸 W / H<input value="140 / 80" readonly></label><label>初始状态<input value="显示 · idle" readonly></label><p>资源 / 标注 / 详情</p><button class="primary" @click="feedback='保存草图：请求携带 revision；冲突保留本地内容，允许比较后重新保存。'">保存草稿</button><small>未保存提示 · revision 1</small></article></div><p v-if="feedback" class="notice" role="status">{{ feedback }}</p>
        </template>
        <footer class="page-foot">S01 / 课程平台基础设计 <span>所有示例内容待课程作者最终确认</span></footer>
      </section>
    </main>
  </div>
</template>
