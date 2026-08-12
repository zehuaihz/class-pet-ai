# Class Pet AI

> 用班级共同养成，让积分形成反馈闭环。

面向教师的班级管理、积分激励、打卡审批和教辅 AI 工具原型。

教师记录课堂表现和打卡任务，积分进入可追溯流水并推动全班共享宠物成长；班级大屏展示共同进度，Dashboard 帮助教师发现待处理事项；AI 当前仅生成**可编辑草稿**，不自动发送给学生或家长。

当前项目是教师端 MVP / 原型，不是生产就绪系统。后端能力多于前端页面，部分页面仍是静态占位；AI 仍处于 mock 模式。

## 核心价值

- **共同目标**：全班积分推动同一只宠物成长，不只依赖个人排名。
- **可追溯**：积分、撤销、打卡审批保留业务流水，便于教师复核。
- **教师掌控**：AI 输出先生成草稿，由教师编辑和确认，不自动对外发布。

## 当前状态

| 领域 | 状态 | 当前事实 |
| --- | --- | --- |
| 教师登录 | 已实现 | 单教师配置账号、签名 Cookie 会话、教师身份校验 |
| 班级管理 | 已实现 | 班级创建、列表、详情、更新 API；班级列表页接入真实数据 |
| 学生数据 | 已实现 | 学生 API CRUD、JSON 导入、分组、搜索、筛选已接入学生管理页面 |
| 手动积分 | 已实现 | 支持给学生或小组加分，写入积分流水并更新总分 |
| 积分排行榜 | 已实现 | 排行榜接口返回学生和小组；积分页接入 `PointRule` CRUD 与小组榜 |
| 积分撤销 | 已实现 | 反向 `ROLLBACK` 流水幂等保护，重复撤销返回同一反向流水 |
| 打卡任务 | 已实现 | 支持任务创建、记录提交、待审核、批准和拒绝 |
| 打卡统计 | 已实现 | 统一统计服务提供完成/待审/驳回/漏卡与完成率，页面与 Dashboard 共用 |
| 共享宠物 | 已实现 | 懒创建、正积分增长、成长日志，以及 level/mood/hunger/skin 成长规则 |
| Dashboard | 已实现 | 班级聚合数据来自统一统计口径，`missedCount` 与完成率真实计算 |
| 班级大屏 | 已实现 | 独立展示页面，约 3 秒轮询数据，支持浏览器全屏；不是 WebSocket/SSE |
| AI 评语草稿 | 已实现 | `AiJob` 异步化、输入脱敏、Provider 草稿和可编辑页面 |
| 真实 AI Provider | 已实现 | Provider adapter 支持 mock 与 Anthropic（fetch 调用，服务端密钥） |
| AI 异步任务 | 已实现 | `AiJob` 经历 `PENDING → RUNNING → SUCCEEDED/FAILED`，DB 轮询 worker 与重试 |
| 奖励兑换 | 已实现 | 奖励商品 CRUD、兑换申请、批准、履约、取消，积分与库存原子扣减 |
| 学生/家长/Admin 账号 | 已实现 | 存储密码凭据、会话版本、角色守卫与各角色页面/API |
| Prisma Migration | 已完成 | 已提交 baseline 与 transaction_integrity migration |
| Redis | 可选 | 当前使用 DB 轮询 worker 与内存限流；Redis 仅供更高规模队列/限流时启用 |
| 生产运维 | 已完成 | 健康检查、结构化日志、登录限流、安全响应头、备份恢复脚本与 runbook |

## 5 分钟体验

### 前置条件

- Node.js 22+
- npm
- Docker（仅用于启动本地 PostgreSQL）

### 启动

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

打开 <http://localhost:3000>，使用 `.env` 中的 `TEACHER_LOGIN_EMAIL` 和 `TEACHER_LOGIN_PASSWORD` 登录。若希望直接看到 seed 演示班级，请保留默认邮箱 `teacher@example.com`；`prisma/seed.ts` 当前固定使用该邮箱，修改登录邮箱后会创建没有演示班级的另一位教师。

> 当前仓库没有 Prisma migration 文件。开发/演示环境使用 `prisma db push` 同步 schema；不能把 `prisma migrate deploy` 描述为当前已验证的空库生产初始化流程。正式上线前，必须先建立、提交并验证 migration 链。

### 建议体验路径

1. 登录教师账号，查看 Dashboard。
2. 进入班级积分页面，给学生手动加分，查看积分流水、排行榜和宠物成长日志。
3. 创建打卡任务，查看任务列表和统计接口能力。
4. 打卡记录提交 API、待审核批准/拒绝 API 已存在，但当前教师 UI 没有学生提交页面；没有预置打卡记录时，无法仅靠当前 UI 完成审批体验。
5. 打开班级大屏，观察约 3 秒轮询后的数据更新。
6. 进入 AI 评语页面，生成固定模板草稿并编辑文本。

学生管理页面当前仍包含静态学生数组和占位交互，不应把它当作完整 CRUD 流程。

## 核心业务闭环

```text
课堂表现 / 打卡任务
        ↓
教师加分或审批
        ↓
可追溯积分流水
        ↓
学生余额 / 小组总分 + 班级宠物成长
        ↓
Dashboard 汇总 / 班级大屏反馈
        ↓
教师确认下一步行动
```

### 手动积分与宠物成长

```text
教师选择学生或小组
  → 创建积分流水
  → 更新学生或小组总分
  → 学生正积分推动 Pet.growthValue
  → 写入 PetGrowthLog
  → Dashboard / 大屏读取聚合结果
```

当前边界：宠物只处理正积分增长；撤销通过新建反向流水实现，不删除原流水，且尚未具备幂等保护。

### 打卡与审批奖励

```text
教师创建任务
  → 提交打卡记录
  → 无证据要求：COMPLETED
  → 需要证据：PENDING
  → 教师批准 / 拒绝
  → 批准后创建 CHECKIN 奖励积分流水
```

当前边界：打卡状态更新和奖励积分目前不是同一数据库事务；重复请求、并发审批和重复奖励需要在后续迭代中处理。

### AI 评语草稿

```text
教师提交学生、语气和补充说明
  → 创建 AiJob
  → 基础文本脱敏
  → 返回固定模板
  → 教师编辑草稿
```

当前 AI 路径没有真实模型调用、Provider、队列或 worker。`AI_PROVIDER` 默认是 `mock`，`AI_API_KEY` 不会自动启用真实 AI。

## 页面与 API 能力

### 教师端页面

| 页面 | 当前能力 |
| --- | --- |
| `/auth/login` | 教师登录 |
| `/dashboard` | 班级聚合数据、宠物、积分和任务摘要 |
| `/classrooms/new` | 创建班级 |
| `/classrooms/[id]/students` | 学生管理页面骨架，部分内容为静态占位 |
| `/classrooms/[id]/points` | 学生积分、流水和反向流水；小组积分仅在后端服务/API 层支持 |
| `/classrooms/[id]/checkins` | 查看任务/记录，批准或拒绝待审核记录 |
| `/classrooms/[id]/checkins/new` | 创建打卡任务，当前表单选项有限 |
| `/classrooms/[id]/pet` | 宠物状态和成长日志 |
| `/classrooms/[id]/screen` | 班级展示大屏和全屏模式 |
| `/classrooms/[id]/ai` | AI 工作台入口，部分能力为占位卡片 |
| `/classrooms/[id]/ai/comment` | 生成并编辑 mock 评语草稿 |

### API 领域

- Auth：登录、退出、当前教师信息。
- Classroom：班级创建、列表、详情和归属校验。
- Student：学生列表、创建、更新、删除、JSON 导入。
- Points：积分流水、排行榜、手动加分、反向流水。
- Check-in：任务、记录、统计、批准、拒绝。
- Pet：宠物读取和成长日志。
- Dashboard：班级聚合数据。
- Screen：班级大屏数据。
- AI：评语草稿和 AI job 查询。

## 技术栈与工程结构

- Next.js 15 App Router
- React 19
- TypeScript（strict）
- Tailwind CSS
- Prisma 6 + PostgreSQL
- Zod
- Vitest + Testing Library
- Playwright
- Docker Compose

```text
src/app/                 页面与 API Route Handlers
src/components/          可复用 UI 组件
src/server/auth/         会话与教师身份校验
src/server/services/     班级、积分、打卡、宠物、AI 业务服务
src/server/utils/        错误和响应封装
prisma/schema.prisma     数据模型事实源
prisma/seed.ts           本地演示数据
tests/                   Vitest 单元/API 合约测试
e2e/                     Playwright 浏览器流程
```

API 返回统一 envelope：

```json
{
  "success": true,
  "data": {}
}
```

错误响应使用 `success: false` 和 `error` 字段，具体行为以 route handler 与 service 实现为准。

## 环境变量

来源：`.env.example`。当前默认值只适合本地开发，不能直接用于公网部署。

| 变量 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 | `postgresql://postgres:postgres@localhost:5432/class_pet_ai` |
| `SESSION_SECRET` | 是 | 会话签名密钥；生产环境必须使用强随机值 | `change-me`（仅本地） |
| `NEXT_PUBLIC_APP_URL` | 否 | 预留的应用访问地址；当前运行代码未直接依赖 | `http://localhost:3000` |
| `AI_PROVIDER` | 否 | `mock` 或 `anthropic`；`anthropic` 启用真实 Provider | `mock` |
| `AI_API_KEY` | 否 | 兼容保留；`anthropic` 模式建议改用 `ANTHROPIC_API_KEY` | 空值 |
| `ANTHROPIC_API_KEY` | 否 | Anthropic Provider 服务端密钥，仅在 `AI_PROVIDER=anthropic` 时使用 | 空值 |
| `AI_MODEL` | 否 | Provider 模型名 | `mock-model` |
| `AI_TIMEOUT_MS` | 否 | Provider 请求超时毫秒数 | `30000` |
| `TEACHER_LOGIN_EMAIL` | 是 | 当前单教师演示账号邮箱 | `teacher@example.com` |
| `TEACHER_LOGIN_PASSWORD` | 是 | 当前单教师演示账号密码 | `password123`（仅本地） |

## 命令参考

来源：`package.json`。

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Next.js 开发服务器 |
| `npm run build` | 生成 Prisma Client 并构建生产版本 |
| `npm run start` | 启动生产构建 |
| `npm run worker` | 运行 AI 异步任务 worker（DB 轮询） |
| `npm run lint` | 执行 ESLint，禁止 warning |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行 Vitest |
| `npm run test:watch` | 以 watch 模式运行 Vitest |
| `npm run test:integration` | 运行 PostgreSQL 集成测试（需要 `TEST_DATABASE_URL`） |
| `npm run test:coverage` | 运行 Vitest 覆盖率；需先安装匹配版本的 `@vitest/coverage-v8` |
| `npm run test:e2e` | 运行 Playwright E2E |
| `npm run test:e2e:ui` | 以 Playwright UI 模式运行 E2E |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:migrate` | 开发环境创建/应用 Prisma migration |
| `npm run db:deploy` | 部署已提交的 Prisma migration 链 |
| `npm run db:seed` | 写入本地演示教师、班级、宠物和学生 |

## 测试与验证

当前测试覆盖两类目标：

- Vitest：部分服务单元测试和 API/UI 合约测试。
- Playwright：教师端主要页面流程，部分测试通过拦截 API 响应验证 UI 行为。

当前不足：真实 PostgreSQL 持久化、跨班级授权、审批/奖励事务一致性、撤销幂等、AI Provider 失败处理和完整移动端流程覆盖仍不充分。覆盖率阈值配置在 `vitest.config.ts`，不等于所有核心业务都已经被真实集成测试验证。

当前可用验证命令：

```bash
npm run lint
npm run test
npm run test:e2e
npx prisma validate
```

`npm run test:coverage` 当前缺少 `@vitest/coverage-v8`，补充匹配版本的开发依赖后再纳入质量门禁。

## 部署说明

### Vercel + 托管 PostgreSQL

可作为 MVP、演示或内部试用的目标架构；当前安全和运维缺口未补齐前，不应直接用于真实学生数据的试点。配置 `DATABASE_URL`、`SESSION_SECRET` 以及当前教师账号变量后构建：

```bash
npx prisma generate && npm run build
```

当前没有 `prisma/migrations` 目录，因此不要直接把下面命令当作已验证的首次生产初始化步骤：

```bash
npx prisma migrate deploy
```

正式部署前应先建立并提交 migration 链，验证空库初始化、升级和回滚策略。

### Docker Compose

当前 Compose 更适合本地开发、集成测试和演示。推荐先只启动数据库：

```bash
docker compose up -d postgres
```

当前 Dockerfile 会无条件复制 builder 阶段的 `/app/public`，而仓库没有 `public/` 目录；因此 `docker compose up -d --build` 在当前 checkout 可能因镜像构建失败。修复 Dockerfile 或补充 `public/` 后，再使用 Web 容器：

```bash
docker compose up -d --build
docker compose exec web npx prisma db push
```

Compose 会启动 PostgreSQL、Redis 和 Web。Redis 当前未被业务代码使用；默认数据库密码、教师密码、`SESSION_SECRET=change-me` 和 HTTP 地址都不适合公网或生产环境。当前 Docker 构建也缺少 `.dockerignore`，生产化前应隔离 `.env`、`node_modules`、`.next`、测试报告等构建上下文。

### 正式上线前检查

- 使用强随机 `SESSION_SECRET`，移除默认教师密码。
- 使用 HTTPS，并配置安全 Cookie 和安全响应头。
- 建立 Prisma migration、升级和回滚流程。
- 配置数据库备份、恢复演练和数据保留策略。
- 增加应用健康检查、结构化日志、错误追踪、限流和告警。
- 验证教师、班级和学生数据隔离。
- 评估未成年人数据隐私、删除、导出、证据文件访问和 AI Provider 数据处理。
- 明确 Redis 是否用于队列/缓存；若不使用，移除无效基础设施依赖。
- 完成移动端、并发和容量测试。

## 当前已知限制：不要过度承诺

- **真实 AI**：当前是固定模板，不是真实大模型生成；`AI_API_KEY` 未被实际消费。
- **多角色端**：学生、家长和 Admin 只存在部分 schema 定义，没有完整登录、页面和权限闭环。
- **奖励商城**：奖励商品和兑换模型已预留，完整兑换/审批/履约流程尚未完成。
- **实时同步**：班级大屏约 3 秒轮询，不是 WebSocket 或 SSE。
- **生产迁移**：当前没有提交 Prisma migration，`migrate deploy` 尚不能作为可靠空库初始化方案。
- **生产运维**：尚无完整健康检查、结构化日志、限流、告警、备份恢复和密钥轮换体系。
- **事务一致性**：打卡批准与奖励积分目前分开执行；积分撤销尚未幂等。
- **数据合规**：项目没有声称完成未成年人数据合规认证或法律审查。
- **规模能力**：尚无高可用、压力测试、容量基准或队列伸缩数据。
- **学生管理 UI**：学生 API 已有，但页面仍含静态数据和占位交互。

## 迭代路线图

路线图是计划，不代表当前已完成。

### P0：可信运行基础

目标：让已有业务闭环具备可安全迭代和可部署基础。

- 建立并提交 Prisma migrations。
- 将打卡批准和奖励积分放入同一数据库事务。
- 为积分撤销增加幂等约束和重复请求保护。
- 增加真实数据库、跨班级授权、并发和事务失败测试。
- 增加 `.dockerignore`，隔离 secrets、依赖、构建产物和测试报告。
- 加固登录、会话、Cookie、密钥和登录限流。
- 增加健康检查、结构化日志、错误追踪、基础限流和安全响应头。
- 决定 Redis 去留：删除，或正式用于队列/缓存。

**验收**：空库可按文档初始化；重复审批不重复奖励；重复撤销不重复扣分；关键 API 有真实 DB 和权限隔离测试。

### P1：教师端核心操作完整化

目标：把“API 已有、页面占位”的能力补齐为教师可用流程。

- 连接真实学生列表，完成添加、编辑、删除、导入和错误反馈。
- 完成分组、搜索、筛选和真实积分展示。
- 接入 `PointRule`，移除仅依赖前端硬编码规则。
- 完善积分流水、撤销确认、失败提示和权限反馈。
- 接入打卡任务真实完成率、总人数、待审批、逾期和 `MISSED` 状态。
- 让 Dashboard 指标来自统一真实统计，修复固定值和简化口径。
- 明确学生自行提交与教师代提交的身份边界。

**验收**：教师不依赖静态占位数据完成核心操作；失败时页面不静默刷新、不误报成功；Dashboard、积分页、打卡页数字来源一致。

### P2：可靠 AI 与异步任务

目标：把 mock 草稿升级为可控、可审计的 AI 辅助能力。

- 定义 Provider adapter，通过服务端密钥调用真实模型。
- 完善输入最小化、PII/未成年人数据处理、提示注入防护和数据保留策略。
- 引入明确的队列/worker 方案，支持超时、重试、失败状态和任务恢复。
- 让 `AiJobStatus` 真实经历 `PENDING → RUNNING → SUCCEEDED/FAILED`。
- 增加结构化输出、质量校验、敏感内容检查、耗时和成本记录。
- 保留教师审核、编辑、接受/拒绝步骤，禁止自动发布。
- 在 grounded comment 稳定后，再评估班级总结和学生洞察。

**验收**：无 API key 时明确降级；Provider 失败时可重试或失败可见；每条 AI 输出都有来源数据范围和教师确认边界。

### P3：多角色与成长产品化

目标：把 schema 中扩展模型变成完整产品能力。

- 学生登录、学生端任务/证据/积分/宠物/奖励体验。
- 家长只读摘要、绑定关系和可见数据控制。
- Admin 后台和系统级管理。
- 奖励目录、库存、兑换申请、审批、履约和取消；积分与库存原子扣减。
- 实现宠物 `level`、`mood`、`hunger`、`skin` 成长规则和 UI。
- 评估 SSE/WebSocket，替代大屏轮询。
- 报表导出、审计日志、数据保留/删除/导出。
- 多班级、多教师和学校级数据隔离。

**验收**：每个角色有独立的最小登录/授权闭环；奖励、宠物和大屏规则一致；多租户隔离有真实测试和审计证据。

## 贡献与文档维护

- 代码、路由、schema 和测试是功能状态事实源；README 不先于代码宣称能力。
- 新功能合并时，同步更新功能状态矩阵、启动步骤、限制和路线图。
- “部分实现”必须写清已完成部分和缺口。
- 新增环境变量、命令、API 或部署步骤时，同步更新对应章节。
- 不提交 `.env`、API key、生产密码或真实学生数据。
- 涉及学生数据、AI、认证、支付/兑换或跨班级权限的变更，先补测试和安全评审。

## License

License 尚未确定。公开发布前请补充许可证和贡献协议。
