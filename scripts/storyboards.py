import json
from pathlib import Path

goals = {'tcp':'识别 SYN、SYN+ACK、ACK 的方向与确认号，理解握手状态；不模拟拥塞、重传或超时。','expense':'理解申请、主管审批、财务核验；固定 800 元且审批通过路径，驳回只作详情说明。','pythagoras':'从面积分解得到勾股定理，区分直角边和斜边；不提供参数仿真。','production':'理解切割、钻孔、检验的工位与物料变化；不是设备操作或安全培训教材。'}
for path in Path('samples/valid').glob('*.json'):
 if path.stem=='minimal':continue
 c=json.loads(path.read_text(encoding='utf-8')); sc=c['chapters'][0]['scenes'][0]
 lines=[f'# {c["title"]}分镜（S01-01）','',f'教学目标与边界：{goals[c["id"]]}','',f'契约样例：`samples/valid/{path.name}`。第一章「基础演示」，场景 01「{sc["title"]}」，960×540 逻辑画布，3 步共 6 秒。内容为开发样例，待作者教学校对。','','## 对象与初始画面','','| 对象 ID / 类型 | 初始位置与尺寸 | 初始状态 | 内容 / 详情 |','| --- | --- | --- | --- |']
 state={}
 for o in sc['objects']:
  state[o['id']]={**o['position'],**o['initial']}
  lines.append(f'| {o["id"]} / {o["type"]} | ({o["position"]["x"]},{o["position"]["y"]}), {o["size"]["width"]}×{o["size"]["height"]} | {json.dumps(o["initial"],ensure_ascii=False)} | {json.dumps(o["content"],ensure_ascii=False)}；详情：{o["details"]["说明"]} |')
 lines += ['','## 逐步分镜','']
 for i,s in enumerate(sc['steps']):
  lines += [f'### {i+1}. {s["title"]}（场景 {i*2000}–{(i+1)*2000}ms）','',f'讲解：{s["narration"]}','','| 动作 | 目标 | 步内开始 / 持续 ms | 参数 |','| --- | --- | --- | --- |']
  for a in s['actions']:
   lines.append(f'| {a["type"]} | {a["target"]} | {a["atMs"]} / {a["durationMs"]} | {json.dumps(a["params"],ensure_ascii=False)} |')
  # These storyboards have no overlapping moves; expected end state is editorial evidence, not a runtime evaluator.
  for a in sorted(s['actions'],key=lambda a:a['atMs']):
   t=state[a['target']]
   if a['type']=='move':t.update(a['params'])
   elif a['type'] in ['show','hide']:t['visible']=a['type']=='show'
   elif a['type']=='setState':t['status']=a['params']['value']
   elif a['type']=='highlight':t['highlight']=a['params']['value']
  touched=list(dict.fromkeys(a['target'] for a in s['actions']))
  lines += ['', '预期步末画面（边界下一步动作之前）：'+'；'.join(f'{t}：{json.dumps(state[t],ensure_ascii=False)}' for t in touched)+'。','', '详情联动：选择动作目标时显示该对象静态说明及上述 status；步骤讲解切换到本步文字。','']
 if c['id']=='tcp':lines+=['字段详情：SYN(seq=100,ack未置位)、SYN+ACK(seq=300,ack=101)、ACK(seq=101,ack=301)。示例初始序号用于教学，不代表生产系统固定值。','']
 if c['id']=='pythagoras':lines+=['公式实验室补充展示四个推导画面：(a+b)²=4·ab/2+c² → a²+2ab+b²=2ab+c² → a²+b²=c² → 3²+4²=5²。课程样例的 setState=simplified 为未来公式适配器的预设状态，S01 尚未实现该适配器。','']
 lines+=['验收观察：重播回到 0ms 应重新应用第一步的 0ms 动作；随机跳转应与顺序播放在同一时刻一致。此处为后续验收预期，S01 不记录为播放器测试通过。']
 Path(f'docs/分镜/{c["id"]}.md').parent.mkdir(parents=True,exist_ok=True)
 Path(f'docs/分镜/{c["id"]}.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
