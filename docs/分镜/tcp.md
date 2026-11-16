# TCP 三次握手：当前体验分镜（UX-02，2026-11-12）

当前课程：samples/valid/tcp.json，flow@1.1.0，960×560 逻辑画布，三步各 6000ms，共 18 秒。时间是放慢后的教学时间，不是链路时延。只演示建立连接，数据传输、重传及关闭仍不在本课范围。

场景包含客户端（192.168.1.10:49152）、路由器（192.168.1.1）、互联网与服务器（203.0.113.10:80），三段边连成转发路径。设备使用 content.visual 指定的原创 SVG，报文使用结构化 content.packet 字段；没有课程页面脚本。初始客户端 CLOSED、服务端 LISTEN，0ms 即应用第一步动作，客户端成为 SYN-SENT。

| 步骤 | 发送与字段 | 动画/状态变化 | 讲解重点 |
| --- | --- | --- | --- |
| 0～6000ms 请求同步序列号 | SYN，SEQ=100，客户端 → 服务端 | 0 显示；800～4100 分三段经路由器/互联网；4100 到达，服务端 SYN-RECEIVED；4800 隐藏 | SYN 消耗一个序列号，对端用 101 确认 |
| 6000～12000ms 确认请求，发出回应 | SYN, ACK，SEQ=300 ACK=101，服务端 → 客户端 | 6000 显示；6800～10100 反向沿同路径；10100 到达，客户端 ESTABLISHED；10800 隐藏 | 确认客户端的 SYN，同时发出自己的 SYN |
| 12000～18000ms 连接建立 | ACK，SEQ=101 ACK=301，客户端 → 服务端 | 12000 显示；12800～16100 沿正向路径；16100 服务端 ESTABLISHED；16800 隐藏 | 纯 ACK 不消耗序列号；服务端收到后连接两端均建立 |

每步开始高亮发送端，到达时高亮接收端，步内 5500ms 取消两端高亮。每个分段 move 持续 1100ms；可暂停、任意跳转、回退和倍速，任意时刻均从动作重建。设备位置/尺寸、详情、讲解、字段及路径全部在课程 JSON 中。

点击步骤、报文行或时序箭头：暂停并跳到发送时刻，选择对应报文。画布选择设备：查看地址和当前状态；选择报文：查看源/目的、端口、SEQ、ACK、flags、帧大小及含义。表格保持三个事件行，未来事件淡显，状态由发送/抵达时间计算；隐藏画布报文后仍保留已到达记录。网络/时序切换不改变时间。

内容仍待作者确认。60 B 为简化帧大小示意，不代表固定 TCP 首部长度。验证见 docs/体验优化验收.md。

---

## 历史：S01 的 6 秒技术分镜（保留追溯，已由上文替代）

# TCP 三次握手分镜（S01-01）

教学目标与边界：识别 SYN、SYN+ACK、ACK 的方向与确认号，理解握手状态；不模拟拥塞、重传或超时。

契约样例：`samples/valid/tcp.json`。第一章「基础演示」，场景 01「TCP 三次握手」，960×540 逻辑画布，3 步共 6 秒。内容为开发样例，待作者教学校对。

## 对象与初始画面

| 对象 ID / 类型 | 初始位置与尺寸 | 初始状态 | 内容 / 详情 |
| --- | --- | --- | --- |
| client / node | (80,200), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "客户端"}；详情：客户端 |
| server / node | (720,200), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "服务端"}；详情：服务端 |
| link / edge | (80,240), 140×80 | {"visible": true, "highlight": false, "status": "idle"} | {"label": "网络链路", "source": "client", "target": "server"}；详情：网络链路 |
| syn / packet | (80,120), 140×80 | {"visible": false, "highlight": false, "status": "idle"} | {"label": "SYN seq=100"}；详情：SYN seq=100 |
| synack / packet | (720,120), 140×80 | {"visible": false, "highlight": false, "status": "idle"} | {"label": "SYN+ACK seq=300 ack=101"}；详情：SYN+ACK seq=300 ack=101 |
| ack / packet | (80,120), 140×80 | {"visible": false, "highlight": false, "status": "idle"} | {"label": "ACK seq=101 ack=301"}；详情：ACK seq=101 ack=301 |

## 逐步分镜

### 1. 发送 SYN（场景 0–2000ms）

讲解：客户端发送 SYN，进入 SYN-SENT；SYN 占用一个序号。

| 动作 | 目标 | 步内开始 / 持续 ms | 参数 |
| --- | --- | --- | --- |
| show | syn | 0 / 0 | {} |
| move | syn | 0 / 1500 | {"x": 720, "y": 120} |
| setState | client | 0 / 0 | {"value": "SYN-SENT"} |
| hide | syn | 1800 / 0 | {} |

预期步末画面（边界下一步动作之前）：syn：{"x": 720, "y": 120, "visible": false, "highlight": false, "status": "idle"}；client：{"x": 80, "y": 200, "visible": true, "highlight": false, "status": "SYN-SENT"}。

详情联动：选择动作目标时显示该对象静态说明及上述 status；步骤讲解切换到本步文字。

### 2. 回复 SYN+ACK（场景 2000–4000ms）

讲解：服务端确认 101，发送自己的初始序号 300，进入 SYN-RECEIVED。

| 动作 | 目标 | 步内开始 / 持续 ms | 参数 |
| --- | --- | --- | --- |
| show | synack | 0 / 0 | {} |
| move | synack | 0 / 1500 | {"x": 80, "y": 120} |
| setState | server | 0 / 0 | {"value": "SYN-RECEIVED"} |
| hide | synack | 1800 / 0 | {} |

预期步末画面（边界下一步动作之前）：synack：{"x": 80, "y": 120, "visible": false, "highlight": false, "status": "idle"}；server：{"x": 720, "y": 200, "visible": true, "highlight": false, "status": "SYN-RECEIVED"}。

详情联动：选择动作目标时显示该对象静态说明及上述 status；步骤讲解切换到本步文字。

### 3. 发送 ACK（场景 4000–6000ms）

讲解：客户端确认 301；双方进入 ESTABLISHED。ACK 不携带数据时不占序号。

| 动作 | 目标 | 步内开始 / 持续 ms | 参数 |
| --- | --- | --- | --- |
| show | ack | 0 / 0 | {} |
| move | ack | 0 / 1500 | {"x": 720, "y": 120} |
| setState | client | 1500 / 0 | {"value": "ESTABLISHED"} |
| setState | server | 1500 / 0 | {"value": "ESTABLISHED"} |
| hide | ack | 1800 / 0 | {} |

预期步末画面（边界下一步动作之前）：ack：{"x": 720, "y": 120, "visible": false, "highlight": false, "status": "idle"}；client：{"x": 80, "y": 200, "visible": true, "highlight": false, "status": "ESTABLISHED"}；server：{"x": 720, "y": 200, "visible": true, "highlight": false, "status": "ESTABLISHED"}。

详情联动：选择动作目标时显示该对象静态说明及上述 status；步骤讲解切换到本步文字。

字段详情：SYN(seq=100,ack未置位)、SYN+ACK(seq=300,ack=101)、ACK(seq=101,ack=301)。示例初始序号用于教学，不代表生产系统固定值。

验收观察：重播回到 0ms 应重新应用第一步的 0ms 动作；随机跳转应与顺序播放在同一时刻一致。此处为后续验收预期，S01 不记录为播放器测试通过。
