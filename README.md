# 交互式课程平台

[课程工作台](http://127.0.0.1:5173/#/studio) 支持从空白或四类模板建课，经表单和画布编辑结构、对象、步骤与动作，保存、重开和预览。四类课程共用[学习播放器](http://127.0.0.1:5173/#/prototype)。管理员可发布已保存修订、预览历史并回滚。阶段证据见[开发进度](开发进度.md)与[S06 验收](docs/S06验收.md)。

## 环境

本次使用 Node 24.13.0、npm 11.6.2、Go 1.26.1、Docker Desktop / Compose，数据库 MySQL 8.4.9。JS 直接依赖保存精确版本，npm ci 依 package-lock.json 安装；Go 依 go.mod/go.sum；MySQL 镜像固定补丁版本。勿使用 npm update 或 go get -u 作为启动步骤。

## PowerShell 启动

在仓库根目录：

```powershell
npm ci
docker compose up -d mysql
docker compose ps
# 等待 mysql healthy 后，在新终端启动 Go
Set-Location backend
$env:MYSQL_DSN='course:course_local_only@tcp(127.0.0.1:3307)/course?charset=utf8mb4&parseTime=true&loc=UTC'
go mod download
go run ./cmd/migrate
go run .
```

前端另开根目录终端：

```powershell
npm run dev
```

访问 `http://127.0.0.1:5173/#/courses` 和 `/#/formula`；健康检查 `http://127.0.0.1:8080/api/health/ready`，前端开发代理同路径可用。端口占用时先停止自己的旧实例；Vite 若自动选择新端口，原型脚本的固定地址也需同步。本地数据库账号仅用于开发，公网部署属于 S09。

## 本机 Windows 便携 MySQL（已验收路径）

本机 Docker Desktop 新容器停在 Created；Compose 配置已提供但本机未跑通。可改用官方 MySQL 8.4.13 ZIP（不安装系统服务）：

```powershell
# 根目录，新机器首次运行下载、校验固定 SHA256、初始化并监听 127.0.0.1:3307
./scripts/start-local-mysql.ps1 -Download
# 等 .local/mysql.stderr.log 显示 ready for connections 后，仅首次运行：
./scripts/init-local-mysql.ps1
# 然后按上文在 backend 迁移及启动，MYSQL_DSN 不变
```

此机已完成首次初始化，当前数据库正在运行，不要重复执行 init 脚本。后续启动不加 -Download；数据保存在忽略目录 .local/mysql-data。停止使用 `.local/mysql-8.4.13-winx64/bin/mysqladmin.exe --no-defaults -h 127.0.0.1 -P 3307 -u root -p shutdown`，交互输入开发密码 root_local_only，保留数据。便携启动和 Compose 二选一，端口相同不能同时运行。官方包来源：[MySQL Windows 下载](https://dev.mysql.com/downloads/mysql/8.4.html?os=3)、[初始化说明](https://dev.mysql.com/doc/refman/8.4/en/data-directory-initialization.html)。ZIP 的固定 SHA256 来自本次官方 HTTPS 下载产物，用于后续重复安装校验。

## 检查

```powershell
npm run check
npx playwright install chromium
npm run test:prototype
# 若使用本机已安装的 Chrome，可替代浏览器下载：
$env:PROTOTYPE_BROWSER_CHANNEL='chrome'
npm run test:prototype
Set-Location backend
go test ./...
go vet ./...
# 可选：已启动并迁移本地数据库时
$env:MYSQL_DSN='course:course_local_only@tcp(127.0.0.1:3307)/course?charset=utf8mb4&parseTime=true&loc=UTC'
go test -run TestDatabase -v .
```

原型脚本要求前端已启动，重建 `docs/evidence` 下的截图和结果。Go/JS 共用 Schema，S03 的 32 个正反例同时校验 ID、引用、时序和组件兼容性；Go 写接口还验证真实资源与权限。播放语义中的固定状态用例及四课重建检查已由 `test:player` 实际运行；跨章节/场景、业务接口、真实 MySQL 并发和后台浏览器联调已通过 S03 验收。

## 目录

- frontend：Vue / TypeScript 原型、共享播放器及组件适配，Router / Pinia 工程入口，Element Plus / Vue Flow 已锁定。
- backend：Gin 认证/草稿/资源 API、GORM 连接、版本化迁移及 Go 结构/语义校验。
- contracts：平台 Schema、JS 校验器与播放规范用例，无 Vue Flow 内部类型。
- samples：四门样例、最小合法课程、非法案例、自制工位素材。
- docs：分镜、后台草图、API/数据库、播放语义、公式选型、验收证据。

停止前端/后端用各终端 Ctrl+C；`docker compose stop mysql` 保留数据。不要用 `down -v` 作为常规停止命令。Git 已初始化，未配置远端；提交前检查 `git diff --check`，不提交 .env、数据库或构建产物。

## S02 四类场景原型

运行 `npm run dev` 后打开 <http://127.0.0.1:5173/#/prototype>，选择 TCP、审批、数学或生产课程。播放/暂停、下一步、回退、重置、重播及时间滑块共用逻辑时钟；点击节点、几何、公式、图片或选择对象查看目标时间详情。桌面画布等比缩放，小屏保留可横向浏览的逻辑画布。

`npm run test:player` 执行纯状态及逻辑时钟检查（Node 24）；`npm run check` 包括契约、播放器和生产构建。开发服务器运行时执行 `npm run test:s02`，默认使用已安装 Chrome，可通过 PROTOTYPE_BROWSER_CHANNEL 指定已安装的 Playwright channel，产生 docs/evidence/s02-* 证据。S01 草图回归仍为 `npm run test:prototype`。打包学习样例不包含私有草稿；实际后台提供保存和授权预览，正式发布接口见下文 S06。详情及资源提供方由业务页面注入，共享播放器不依赖课程 ID。

## 参考站体验优化

首页及 `/#/prototype`、`/#/learn` 现在打开独立学习界面。TCP 支持等距设备网络图、沿路由路径传递的报文、时序视图、报文表点击跳转、字段/设备详情和步骤讲解；教学节奏为 18 秒，支持 0.5～2 倍速。小屏先展示讲解，网络图与报文表可在各自区域横向浏览。`/#/courses` 继续保留作者草图入口。

`npm run test:network` 校验网络契约、路径、握手边界及倍速；`npm run test:experience` 在已启动的本地服务器和已安装 Chrome 上检查新体验及其他三课回归。`npm run test:s02` 保留四课完整控制回归入口，现从样例读取时长，产出 regression-*，不覆盖历史 s02-* 截图。当前求值器测试写入 player-current.json，历史 S02 报告记录的是当时 6 秒版本的结果。UX 验收与限制见 docs/体验优化验收.md。

网络图目前每段有两条带箭头的相反方向通道，报文沿当前方向传递；时序图随播放斜向延伸而非一次性绘制。`npm run test:motion` 验证通道/位置/进度，`npm run test:motion-browser` 检查实际连续播放并输出 motion-network.webm、motion-sequence.webm（需 `node node_modules/playwright/cli.js install ffmpeg` 安装对应 Playwright 录制运行时）。视频和结果在 docs/evidence；验收说明见 docs/动效对齐验收.md。

## S03 后台使用与验证

先按上文启动 MySQL，在 backend 运行迁移。首次创建管理员，在当前终端配置后启动（现有账号不会被覆盖）：

```powershell
$env:BOOTSTRAP_ADMIN_USER='your-admin-name'
$env:BOOTSTRAP_ADMIN_PASSWORD=Read-Host '初始密码，至少12字符' -MaskInput
$env:ASSET_DIR='D:\AIDiy\course\.local\assets'
go run .
```

登录 `/#/studio`，选择建课起点以创建课程；生产课程先上传 PNG/JPEG/WebP 工位图片，再创建，替换开发素材引用。可通过课程信息、章节/场景管理、画布和对象属性表单编辑，保存后重新打开；授权预览播放服务器已保存版本。两页同时编辑时旧修订返回 409，保留本地正文并显示服务器内容，支持下载、重新打开或手工合并后再次保存。资源上传 ≤10MB，支持 PNG/JPEG/WebP/PDF，SVG 暂拒绝。数据库与 ASSET_DIR 必须一起备份。公开发布资源使用下文的版本限定入口。

开发会话存内存，8 小时过期，API 重启需重新登录。生产 HTTPS 设置 COOKIE_SECURE=true；无默认生产密码。本机验收管理员为 `admin`；验收凭据仅保存在忽略文件 `.local/s03-test-credentials.json`，不写入版本库。此设置仅适用于当前本地数据库，生产初始化仍由环境配置，不提交本地凭证文件。

```powershell
# 真实后台测试需要已运行的 5173/8080/MySQL；读取本机忽略的验收账号文件
npm run test:s03
# API 重启后读取上一轮保存的快照及资源进行恢复复验
node scripts/check-s03-api.mjs --restore
# Go 测试必须设置 MYSQL_DSN 才执行真实 MySQL 并发测试
Set-Location backend
go test ./... -count=1 -v
go vet ./...
```

新环境可在设置初始账号环境变量后，用 `{username,password}` JSON 格式建立 `.local/s03-test-credentials.json` 供浏览器验收；请保持此文件在忽略目录。32 案例两端一致性不依赖数据库；未设置 DSN 的数据库测试会跳过，不能作为集成验收。测试会保留后台创建的验证课程供检查，Go 集成测试清理自己建立的临时课程和账号。

## S04 课程与画布编辑

登录 `/#/studio`，搜索并打开实际数据库课程，或从四类验证课程起点创建。左侧上传资源会加入当前课程引用；生产起点创建前需上传图片。编辑标题、简介、分类及章节/场景，可新增、删除与上下排序；整段删除需确认，课程结构保留至少一个章节、场景和对象。

选择对象类型并添加，在画布中拖动、缩放和平移；从右侧连接圆点拖至另一对象左侧，或使用连线表单。右侧提供名称、坐标、尺寸、初始可见/高亮/状态、设备地址、TCP 字段、公式及状态公式、几何顶点、图片资源与详情表单。初始隐藏对象仍以虚线呈现便于编辑。对象顺序控制展示层次。Vue Flow 数据只在独立适配层转换，契约不存储节点库内部字段。

保存后可重新打开或刷新再选课，所有字段通过授权草稿 API 持久化。失败或 revision 冲突保留当前完整正文；可比较服务器版本、下载本地副本，在表单或折叠的高级 JSON 中合并，再明确采用最新修订。保存期间继续修改会保持未保存标记。离开、刷新或重开前有未保存提醒；尚无本地自动恢复，请先保存或下载。被动作/连线/报文引用的对象不能直接删除；资源仍被图片使用时须先替换引用。

`npm run test:s04` 在本地 5173/8080/MySQL 和忽略目录凭据存在时执行真实 Chrome 验收，输出 `docs/evidence/s04-browser.json`、编辑器与冲突截图。验收报告见 [S04验收](docs/S04验收.md)。以上为 S04 验收范围；当前编排与模板用法见下文。

## S05 步骤编排与模板

在后台的「建课起点」选择空白或模板，再点「创建课程」。每个实例有独立的课程、章节、场景、对象、步骤和动作 ID。生产模板先上传工位图片，可用仓库内 [station.png](samples/assets/station.png)；实例引用受权限保护的资源，不复制文件。PDF 仍可作为附件，SVG 上传仍拒绝。

在画布下方选择教学步骤，输入标题、讲解和毫秒时长。步骤上下移会带着全部动作一起移动。动作可选显示、隐藏、高亮、移动、修改状态；只有移动可以持续一段时间。开始时间相同且修改同一属性时，排在后面的动作优先。缩短时长与现有动作冲突时，先调整动作或延长步骤。更换类型会重置该动作参数，有内容时先确认。

「预览本地编辑」打开当前未保存内容的快照，不写库；「授权预览」读取服务器上已保存的修订。两者都在同一播放器内切步、看讲解和对象详情。修改后再次点击预览可更新快照。保存或「服务器校验」提示错误时，点「定位」切到相应章节、对象或动作，在表单修正。高级 JSON 仍供检查及冲突合并。

运行 `npm run test:s05` 可复验模板隔离、错误定位和五条真实作者流程（空白及四个模板）；需要前端、API、MySQL 和忽略目录内的验收账号。测试会留下独立的验收草稿，不覆盖原课程。截图和可复核结果见 [S05 验收记录](docs/S05验收.md)。

## S06 发布与版本

登录工作台，打开课程并展开「发布与版本」。管理员先保存草稿，再点「发布已保存修订」。版本列表提供历史预览，「打开公开课程」可供学员匿名播放。编辑并再次保存后可发布下一版。回滚时选择历史版本、填写原因并确认，当前草稿可继续编辑。操作记录保留操作者、时间、原版本、目标和原因。

当前本机工作台仍为 5173，新 API 在 8086；直接测试 API 时也请使用 8086。旧 8080 实例保留。重启新版可在 backend 目录设置前文的 MYSQL_DSN 和 ASSET_DIR，再执行以下命令。本机 frontend/.env 已配置 COURSE_API_ORIGIN=http://127.0.0.1:8086；新环境按默认 8080 启动时无需配置该项。

```powershell
$env:LISTEN_ADDR='127.0.0.1:8086'
go run .
```

前端、API、MySQL 均启动后，在根目录执行 `npm run test:s06`。真实事务测试在 backend 目录设置 MYSQL_DSN 后执行 `go test ./... -count=1 -v`。验收细节及证据见 [S06 验收](docs/S06验收.md)。


## S07 学员网站

打开 [学员目录](http://127.0.0.1:5173/#/catalog)（也为网站默认首页），按分类或搜索筛选真实已发布课程。课程页包含当前快照的简介、章节/场景目录、共享播放器、讲解与详情；场景切换暂停于起点，课程结束不自动切场景。原型保留在 `/#/prototype`，作者工作台仍为 `/#/studio`。

播放位置自动保存到当前浏览器，刷新后以暂停、1×恢复。可主动标记场景“已复习”，或清除本课程记录；跳到末尾不会自动算学完。更换浏览器/设备不共享记录，存储不可用时会提示并继续播放。版本匹配与失效规则见 [播放语义](docs/播放语义.md)。小屏左右滑动画布和报文表；数学步骤另提供当前公式阅读区。

`npm run test:s07` 运行进度规则与真实 Chrome 端到端验收，会经本地后台 API 创建并发布独立验收课程，保留已有数据；需启动前端、8086 API 和 MySQL、准备忽略目录内验收凭据。全局禁用存储的启动验收使用生产构建：先 `npm run build`，再 `npm run preview -w frontend -- --port 5174`，另一终端设置 `$env:BROWSER_BASE_URL='http://127.0.0.1:5174'` 后运行测试。5174 仅本地预览，仍代理 8086，不是外部部署。开发模式 Vue devtools 自身会访问存储，因此开发模式仅对学习记录命名空间注入不可用；生产模式测试全部 Storage 方法不可用。

验收结果、四门本地公开课入口与模拟尺寸截图见 [S07 验收](docs/S07验收.md)。手机尺寸模拟不代表真机通过，作者内容确认和部署仍留 S08/S09。

## S08 / S09 交付与验收

平台已部署到 [学员目录](http://192.192.99.188/#/catalog)、[作者工作台](http://192.192.99.188/#/studio)，采用IP HTTP80；既有443服务保留。四门公开课标为候选，待真实作者批准。生产管理员course-admin使用独立随机口令，仅本机忽略文件.local/production-admin.json私下交接。

见 [最终交付](docs/最终交付.md)、[S08](docs/S08验收.md)、[S09九项验收](docs/S09验收.md)、[作者确认清单](docs/作者试用与内容确认.md)、[作者使用说明](docs/作者使用说明.md)、[部署与维护](docs/部署与维护.md)。一致备份和独立恢复、隔离环境应用镜像回退已实测。生产配置在deploy，离线打包脚本scripts/package-release.ps1使用独立构建目录；完整源Docker构建与实际离线构建的验证差异在报告明确记录。

作者独立试用、内容/素材批准与手机真机仍待验收，当前7/9，不能把桌面视口模拟当手机实测。本地Docker运行时当前未运行，远端Compose已通过；本地原生MySQL/3307、API8086保留。

质量复核：`npm run test:s08`读取当前本地S07验收课程；`npm run test:s09:smoke`对目标平台做只读浏览器复验。`test:s09:restore`要求维护人预先建立本机18083→目标127.0.0.1:18082的SSH隧道，按恢复文档启动隔离环境；勿把恢复端口开放公网。写入型远端作者验收脚本会保留验收草稿/历史，仅在需要重验时执行。


2026-11-13 报销流程体验优化：本地 [直接查看三条报销路径](http://127.0.0.1:5173/#/prototype?course=expense)，或在工作台从报销模板新建。正常报销、退回补正与超额加签共22步，保留共享播放器与课程v1；运行 `npm run test:expense` 验证。分镜、截图及后台保存证据见 [报销流程优化验收](docs/报销流程优化验收.md)。既有发布课不自动覆盖，线上前端及旧报销内容需单独升级发布。
