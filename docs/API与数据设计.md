# API、权限与数据设计（S01-06）

S03 已实现认证、课程列表/创建、草稿读写、校验、授权预览与资源接口；S06 已实现版本、发布、回滚和公开快照读取。六张业务表见 `backend/migrations/001_initial.up.sql`；另有一张基础设施表 schema_migrations。

## HTTP 与权限

统一前缀 `/api/v1`，JSON UTF-8；数据库 ID 和 revision 在 JSON 中用十进制字符串传输，避免 JS 安全整数精度损失。错误结构 `{error:{code,message,path?,currentRevision?},requestId}`，path 为课程 JSON Pointer。400 参数，401 未登录，403 无权限，404 不存在（含无权查看他人私有课程），409 修订或幂等冲突，422 课程校验错误，413 上传过大，503 数据库不可用。

| 接口 | 权限 | 输入 / 输出与约束 |
| --- | --- | --- |
| POST /auth/login | 匿名，限速 | username/password → HttpOnly、SameSite=Lax 会话 cookie；生产 Secure |
| POST /auth/logout | 已登录 + CSRF | 撤销服务端会话，清 cookie |
| GET /auth/me | 已登录 | id、role，不返回 hash |
| GET /courses | author/admin | 作者仅自己的课程，管理员全部；`after` ID 游标，每页最多 50 条（分类过滤留后续管理页） |
| POST /courses | author/admin + CSRF | S03 输入 `{body:课程JSON}` → `{id,revision:"1"}`；完整空白/模板编辑入口在 S04/S05 |
| GET /courses/:id/draft | 所有者/admin | body、revision，草稿禁止公共缓存 |
| PUT /courses/:id/draft | 所有者/admin + CSRF | revision、body；成功 revision+1，冲突 409 |
| POST /courses/:id/validate | 所有者/admin + CSRF | body → 带 path 的结构/语义/资源/组件错误 |
| GET /courses/:id/preview | 所有者/admin | 授权草稿及 revision，Cache-Control: private,no-store |
| POST /assets | author/admin + CSRF | multipart，允许 PNG/JPEG/WebP/PDF；S03 拒绝 SVG，待加入净化后开放，≤10MB，检查真实类型，随机 storage_key |
| GET /assets/:id | S03 仅上传者/admin；公开引用经独立版本资源路径访问 | 原始名称只用于下载提示，禁止路径拼接；nosniff，不内联执行 SVG |
| GET /courses/:id/versions | 所有者/admin | 完整历史（只读），历史预览仍需授权 |
| POST /courses/:id/publish | admin + CSRF | revision、Idempotency-Key → versionId；返回稳定首次结果 |
| POST /courses/:id/rollback | admin + CSRF | versionId、reason、Idempotency-Key → 当前版本；不修改草稿 |
| GET /public/courses | 匿名 | 仅已发布目录，元数据取当前快照，不能泄露草稿标题 |
| GET /public/courses/:slug | 匿名 | 指针一次解析出的完整快照及 versionId，ETag=versionId；每次重新校验，不长期缓存指针 |

登录采用服务端签名会话（初版单实例内存存储，重启重新登录，不新增业务表），会话轮换、过期、CSRF token、密码 bcrypt、禁用账号检查在 S03 实现。初始管理员由服务启动时读取 BOOTSTRAP_ADMIN_USER / BOOTSTRAP_ADMIN_PASSWORD（至少 12 字符）创建；已有账号不覆盖密码或角色，无默认生产密码；禁止公开注册。author 不能发布、回滚或访问其他作者草稿。健康检查不返回 DSN 或凭证。

## 数据与并发

users 存后台账号；courses 存目录索引、所有者和发布指针；course_drafts 一课一行；course_versions 保存不可变 JSON 快照与资源 ID 列表；assets 保存元信息，文件在独立持久化目录；course_component_refs 保存每个快照的精确组件版本。课程 JSON 里的资源 ID 对应接口返回的 `asset-<数据库ID>` 别名；发布时将别名解析并冻结到 asset_refs。样例 station-image 是开发资源目录映射，不是线上数据库 ID。

草稿保存必须先验证，再执行 `UPDATE course_drafts SET body=?, revision=revision+1, updated_by=?, updated_at=UTC_TIMESTAMP(3) WHERE course_id=? AND revision=?`。RowsAffected=0 后查存在性，返回 404 或 409 及最新修订，绝不能盲目覆盖。目录元信息与正文更新同事务；公共列表读快照避免草稿泄漏。更新或删除均不物理删除历史版本。

发布在一个 InnoDB 事务内：先锁 courses 行 `FOR UPDATE`，查 (course_id,request_key)；已存在且 request_hash 相同则返回原结果，不重新切换指针（即使其后已经回滚）；同键不同请求返回 409。锁草稿并比较 revision，校验 Schema、语义、资源文件存在和兼容注册表；按 version_no 最大值+1 生成不可变完整快照及 component_refs，最后更新发布指针、目录状态并追加审计，一起提交。request_hash 是规范化请求 `{courseId,revision}` 的 SHA256；同键同修订返回原快照，不能重新读变更草稿当成新请求。死锁回滚后有界重试；连接在提交时断开则用同键查询恢复结果。快照和指针绝不能分事务。唯一键提供第二道并发约束；不同幂等键同修订允许独立发布版本（业务可提示重复）。

审计不增第七张业务表：courses.operation_log JSON 数组由服务端在课程行锁下追加 `{operationId,kind,actorId,at,fromVersionId,toVersionId,reason,requestHash}`；初始值 `[]`。发布与回滚的操作、幂等键和原因必须在同一事务提交，禁止客户端覆盖或清空。回滚锁课程后检查 operationId，重复返回原结果，不重复回滚；同键不同请求 409。目标版本必须属于本课程（数据库复合外键再次限制），确认资源/组件可加载后切换指针并追加日志，草稿不变。审计 JSON 持续增长是首版取舍，超过 1MB 拒绝写入并告警，后续评估独立审计表迁移，不能截断历史。保留历史文件；首版不提供资源物理删除接口。DB 和资源目录一起备份。

## 迁移

运行 `go run ./cmd/migrate`，需在 backend 目录且 MYSQL_DSN 已设置。runner 用 GET_LOCK 串行执行、schema_migrations 标记版本；MySQL DDL 隐式提交，失败可能留下部分表，不能声称整个 DDL 原子回滚。失败时停止服务、备份并按日志检查，空开发库才能执行 down.sql 后重跑；生产先恢复备份或准备修复迁移。down.sql 是显式破坏性的维护脚本，runner 不自动执行。迁移后不运行 AutoMigrate。

S03 已测试原子修订竞争及 Go 语义校验一致性（docs/S03验收.md）；S03 测试范围包含 32 个共享正反案例和真实 MySQL 的 8 请求竞争；S06 测发布插入失败、指针更新失败、超时重试、并发、回滚重复请求、跨课版本拒绝和历史资源。S01 的迁移运行结果另见验收记录，设计用例不计为测试通过。

## S03 实现补充（2026-11-12）

- 会话使用 256 位随机不透明 token，仅保存于内存；服务端状态校验身份，不信任 cookie 提供的角色。登录轮换、8 小时过期、HttpOnly/SameSite=Lax、可配 Secure、每 IP 每分钟最多 20 次尝试，写请求使用会话 CSRF token；每次重新查询账号禁用状态。重启需重新登录。
- `{error:{code,message,issues?},requestId}`；语义 issues 为 `{path,message}`，结构错误包含 Schema 的路径说明；409 带 currentRevision。ID/revision 为字符串。
- ASSET_DIR 为独立持久化目录，随机存储键、真实内容 MIME 探测、10MB 限制、SHA256 元数据、nosniff；PDF 下载。所有草稿/预览/资源均 private,no-store。写课程时验证资源记录、文件和访问权限，不允许生产草稿使用开发 station-image 别名。
- 002_course_title 将目录标题改为 TEXT，匹配契约允许的长标题。迁移 runner 在互斥锁下按文件名执行全部版本，不重跑已记录版本；保留非事务 DDL 的人工恢复规则。
- 保存事务先做带 revision 的原子 UPDATE，再更新目录字段；失败回滚。后台冲突保留本地 JSON、显示服务器正文，可下载副本、重开，或手工合并后明确采用最新修订再保存。保存期间继续输入不会被错误标成已保存。

## S04 编辑器接入

课程/章节/场景/对象表单及 Vue Flow 通过 editor/adapter.ts 写回同一平台 v1 JSON，继续使用 S03 授权列表、草稿、资源与预览接口；没有新增 API、数据库迁移或契约字段。被引用对象/资源的删除由编辑器明确阻止，保存仍执行前后端完整结构与语义校验。视口缩放不存入正文。冲突后完整本地正文保留，明确手工合并后采用最新 revision，不自动覆盖远端。

## S05 步骤与模板
客户端从空白或分镜生成独立实例，创建仍为 POST /courses，资源别名不克隆；生产模板将开发素材别名替换为当前登录会话上传的工位图片。草稿的组件、模板内容和动作仍由服务器校验。步骤及动作顺序为数组顺序，无数据库迁移或 Schema 版本变更。
本地预览对编辑快照执行前端校验，不写库；授权预览始终 GET 已保存修订。显式服务器校验复用 POST /courses/:id/validate。结构错误与语义错误都返回 issues，路径用数组下标（零起始）；如 /chapters/0/scenes/0/steps/1/actions/0/params/x。旧服务仅返回根结构错误时，工作台使用同一份正文的 Ajv 路径补充定位。


## S06 接口细节（2026-11-13）

- 发布请求体为 `{revision}`，回滚请求体为 `{versionId,reason}`，reason 去除首尾空白，1～500 个字符。两者都要求 admin、CSRF 和 Idempotency-Key。键为 1～64 位小写 ASCII 字母、数字、下划线或连字符，作用域为单课，两个操作共享键空间。哈希输入为规范化的 courseId 和本操作字段；重复键同时比对 kind 和哈希。首次及重放均返回 200 `{versionId}`。同键改操作或参数、发布过期 revision 均为 409。
- 事务持有课程行锁直到提交，版本号为本课最大值加一。不同键可以发布同一修订。仅 MySQL 死锁自动重试，至多三次尝试；响应丢失或提交结果未知时调用方用原键重试，通过同事务审计查回原结果。回滚复验历史文件、组件和正文后更新指针及审计，不创建版本。草稿校验、保存与发布共用资源 ID 解析、授权与文件字节校验。
- GET /courses/:id/versions 返回 slug、currentVersionId、versions（按版本号倒序）、operations（按操作时间顺序追加）。GET /courses/:id/versions/:version 返回 body、versionId；其 /assets/:asset 子路径按历史引用允许所有者/admin 读取。上述接口 private, no-store。
- GET /public/courses 返回 courses，每项含 slug、versionId、title、summary、category；GET /public/courses/:slug 返回 body、versionId。两者 no-cache，详情响应带版本 ETag。GET /public/courses/:slug/versions/:version/assets/:asset 同时匹配 slug、当前指针、快照引用和 asset-数字别名；响应 private, no-store，类型与下载策略沿用上传约束。公开版本变化后，旧资源 URL 需要通过授权历史接口访问。对文件的物理保留依赖资源目录与数据库一起备份。
- 使用既有 001/002 表和约束。S06 无额外迁移，不需要重新初始化数据。


## S07 学员读取与本地数据（2026-11-13）

学员目录与课程页只调用 `GET /public/courses`、`GET /public/courses/:slug` 和当前版本的公开资源路径，显式省略凭据并重新校验缓存；不读草稿或打包样例。目录分类/搜索在已发布列表上过滤；详情章节/场景直接来自这次解析出的快照。详情提供“刷新当前发布版本”，发布切换后旧资源拒绝访问时也可用该操作重新加载。未发布与不存在统一反馈，网络失败可重试，图片失败显示资源错误。

学习记录无后端接口，不新增表/迁移。键为 `course-learning:v1:<slug>`，值为 `{schema:1,versionId,sceneId,timeMs,signature,reviewed,updatedAt}`，其中 signature 为当前完整场景 JSON 字符串，reviewed 为学员手动确认的场景 ID 数组。每 500ms 合并写入、离开/刷新前尽力保存；此数据不作为权限、成绩或完成证明。跨课程按 slug 隔离，清除仅影响本课程。存储读取/写入/删除异常显示反馈并允许继续学习；损坏记录忽略，不访问草稿补全。版本及结构变化规则详见播放语义。
