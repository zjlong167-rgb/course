# 生产加工流程分镜（S01-01）

教学目标与边界：理解切割、钻孔、检验的工位与物料变化；不是设备操作或安全培训教材。

契约样例：`samples/valid/production.json`。第一章「基础演示」，场景 01「生产加工流程」，960×540 逻辑画布，3 步共 6 秒。内容为开发样例，待作者教学校对。

## 对象与初始画面

| 对象 ID / 类型 | 初始位置与尺寸 | 初始状态 | 内容 / 详情 |
| --- | --- | --- | --- |
| cut / node | (40,220), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "切割"}；详情：切割 |
| drill / node | (320,220), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "钻孔"}；详情：钻孔 |
| qc / node | (650,220), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "检验"}；详情：检验 |
| material / node | (40,80), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "物料"}；详情：物料 |
| photo / image | (600,30), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "工位示意图", "assetId": "station-image"}；详情：工位示意图 |

## 逐步分镜

### 1. 下料切割（场景 0–2000ms）

讲解：原料进入切割工位；示例不代表真实设备操作规程。

| 动作 | 目标 | 步内开始 / 持续 ms | 参数 |
| --- | --- | --- | --- |
| setState | material | 0 / 0 | {"value": "cut"} |

预期步末画面（边界下一步动作之前）：material：{"x": 40, "y": 80, "visible": true, "highlight": false, "status": "cut"}。

详情联动：选择动作目标时显示该对象静态说明及上述 status；步骤讲解切换到本步文字。

### 2. 钻孔加工（场景 2000–4000ms）

讲解：切割件转至钻孔工位并完成加工。

| 动作 | 目标 | 步内开始 / 持续 ms | 参数 |
| --- | --- | --- | --- |
| move | material | 0 / 1500 | {"x": 320, "y": 80} |
| setState | material | 1500 / 0 | {"value": "drilled"} |

预期步末画面（边界下一步动作之前）：material：{"x": 320, "y": 80, "visible": true, "highlight": false, "status": "drilled"}。

详情联动：选择动作目标时显示该对象静态说明及上述 status；步骤讲解切换到本步文字。

### 3. 质量检验（场景 4000–6000ms）

讲解：转至检验工位；预设演示路径为合格入库。

| 动作 | 目标 | 步内开始 / 持续 ms | 参数 |
| --- | --- | --- | --- |
| move | material | 0 / 1500 | {"x": 650, "y": 80} |
| highlight | photo | 0 / 0 | {"value": true} |
| setState | material | 1500 / 0 | {"value": "qualified"} |

预期步末画面（边界下一步动作之前）：material：{"x": 650, "y": 80, "visible": true, "highlight": false, "status": "qualified"}；photo：{"x": 600, "y": 30, "visible": true, "highlight": true, "status": "idle"}。

详情联动：选择动作目标时显示该对象静态说明及上述 status；步骤讲解切换到本步文字。

验收观察：重播回到 0ms 应重新应用第一步的 0ms 动作；随机跳转应与顺序播放在同一时刻一致。此处为后续验收预期，S01 不记录为播放器测试通过。
