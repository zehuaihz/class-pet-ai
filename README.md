# Class Pet AI

> 每位学生养成自己的专属宠物，让积分形成反馈闭环。

面向教师的班级管理、积分激励、打卡审批和教辅 AI 工具。

教师记录课堂表现和打卡任务，积分进入可追溯流水并推动每位学生的专属宠物成长；宠物满级毕业自动铸造徽章，徽章可在小卖部兑换奖励；班级大屏展示共同进度，Dashboard 帮助教师发现待处理事项；AI 生成**可编辑草稿**，由教师编辑并确认保存为评语档案，不自动发送给学生或家长。

当前项目是教师端 MVP / 原型，已在单台云服务器（Docker Compose）上完成过端到端部署验证；距离生产就绪仍有安全与合规缺口（见「当前已知限制」）。

## 核心价值

- **个人养成**：每位学生一只专属宠物，积分喂养成长，满级毕业领徽章，徽章可兑换奖励。
- **可追溯**：积分、撤销、打卡审批、奖励兑换全部保留业务流水；数据台账支持 CSV 导出与按日期清理。
- **教师掌控**：AI 输出先生成草稿，由教师编辑和确认存档，不自动对外发布。

## 当前状态

| 领域 | 状态 | 当前事实 |
| --- | --- | --- |
| 教师登录 | 已实现 | 单教师配置账号、签名 Cookie 会话、登录限流、教师身份校验 |
| 班级管理 | 已实现 | 班级创建、列表、详情、更新 API 与页面 |
| 学生数据 | 已实现 | 学生 API CRUD、JSON 导入、分组、搜索、筛选已接入学生管理页面 |
| 手动积分 | 已实现 | 支持给学生或小组加分，写入积分流水并更新总分 |
| 积分排行榜 | 已实现 | 排行榜接口返回学生和小组；积分页接入 `PointRule` CRUD 与小组榜 |
| 积分撤销 | 已实现 | 反向 `ROLLBACK` 流水幂等保护（`transaction_integrity` 迁移），重复撤销返回同一反向流水 |
| 打卡任务 | 已实现 | 任务创建、学生提交（学生端页面）、待审核、批准和拒绝 |
| 打卡审批事务 | 已实现 | 批准/拒绝在单一数据库事务内更新状态并发放奖励积分 |
| 打卡统计 | 已实现 | 统一统计服务提供完成/待审/驳回/漏卡与完成率，页面与 Dashboard 共用 |
| 个人宠物 | 已实现 | `StudentPet` 每人一只，正积分喂养 growthValue，等级阈值可配置，满级毕业自动铸造徽章 |
| 徽章与兑换 | 已实现 | 徽章墙/光荣榜页面；奖励商品 CRUD、兑换申请、审批、履约、取消，积分与库存事务内原子扣减（含幂等键） |
| Dashboard | 已实现 | 班级聚合数据来自统一统计口径，`missedCount` 与完成率真实计算 |
| 班级大屏 | 已实现 | 双栏布局：宠物主舞台（成长值进度条、月光聚光）+ Top8 排行榜 + 实时时钟；约 3 秒轮询，支持浏览器全屏；不是 WebSocket/SSE |
| AI 评语草稿 | 已实现 | `AiJob` 异步化（`PENDING → RUNNING → SUCCEEDED/FAILED`）、输入脱敏、Provider 草稿、可编辑页面 |
| AI 评语确认 | 已实现 | 教师编辑草稿后「确认保存评语」，写入 `StudentComment` 评语档案并在页面下方查看历史 |
| 真实 AI Provider | 已实现 | Provider adapter 支持 mock 与 Anthropic（fetch 调用，服务端密钥）；`AI_PROVIDER` 默认 `mock` |
| AI 异步任务 | 已实现 | 独立 worker（`npm run worker`，DB 轮询认领）+ 请求内 fire-and-forget 双路径，带租约与重试 |
| 数据台账 | 已实现 | 积分流水台账页面、CSV 导出、按日期范围清理（`audit_reliability` 迁移） |
| 学生/家长/Admin 账号 | 已实现 | 存储密码凭据、会话版本、角色守卫与各角色页面/API；学生端含打卡提交与奖励查看，家长端为只读摘要 |
| Prisma Migration | 已完成 | 6 条迁移链（baseline → transaction_integrity → audit_reliability → zoo_v1 → zoo_align → student_comments），全部幂等可重放，已在服务器空库与存量库两条路径验证 |
| Redis | 可选 | 业务代码未使用；Compose 中保留供更高规模队列/限流时启用 |
| 生产运维 | 已完成 | 健康检查、结构化日志、登录限流、安全响应头、容器化备份恢复脚本与 runbook |

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
npx prisma migrate deploy   # 或开发迭代用 npx prisma db push
npm run db:seed
npm run dev
```

打开 <http://localhost:3000>，使用 `.env` 中的 `TEACHER_LOGIN_EMAIL` 和 `TEACHER_LOGIN_PASSWORD` 登录。若希望直接看到 seed 演示班级，请保留默认邮箱 `teacher@example.com`；`prisma/seed.mjs` 当前固定使用该邮箱，修改登录邮箱后会创建没有演示班级的另一位教师。

> 迁移链包含 zoo v1 破坏性迁移（删除旧 `Pet`/`PetMood`、改用 `StudentPet`/`Badge`）。全新环境直接 `migrate deploy` 即可；**在已有旧版数据的环境升级前，请先用 `scripts/backup-db.sh` 备份**。所有迁移均按幂等编写（`IF EXISTS` / `IF NOT EXISTS`），可安全重放。

### 建议体验路径

1. 登录教师账号，查看 Dashboard。
2. 进入班级积分页面，给学生手动加分，查看积分流水和排行榜，撤销一笔积分验证反向流水。
3. 到动物园观察学生宠物成长、喂养，满级后到荣誉墙查看徽章。
4. 创建打卡任务，用学生账号（或学生端页面）提交打卡，回到教师端批准，观察积分与宠物联动。
5. 到小卖部创建奖励商品，用学生积分发起兑换并完成审批/履约。
6. 打开班级大屏，观察约 3 秒轮询后的数据更新（成长值进度条、排行榜、时钟）。
7. 进入 AI 评语页面，生成草稿、编辑文本，点「确认保存评语」，在页面下方查看评语档案。
8. 到设置 → 数据台账，导出 CSV，查看含撤销状态的流水台账。

## 核心业务闭环

```text
课堂表现 / 打卡任务
        ↓
教师加分或审批（事务内）
        ↓
可追溯积分流水
        ↓
学生余额 / 小组总分 + 学生宠物成长
        ↓
Dashboard 汇总 / 班级大屏 / 数据台账反馈
        ↓
教师确认下一步行动
```

### 手动积分与宠物喂养

```text
教师选择学生或小组
  → 事务内创建积分流水并更新总分
  → 学生正积分喂养 StudentPet.growthValue
  → 写入 PetGrowthLog，满级毕业自动铸造徽章（Badge）
  → Dashboard / 大屏 / 动物园读取聚合结果
```

当前边界：宠物只处理正积分增长；撤销通过幂等反向流水实现（重复撤销返回同一反向流水），不删除原流水。

### 打卡与审批奖励

```text
教师创建任务
  → 学生端提交打卡记录
  → 无证据要求：COMPLETED
  → 需要证据：PENDING
  → 教师批准 / 拒绝（单一数据库事务）
  → 批准后创建 CHECKIN 奖励积分流水并喂养宠物
```

当前边界：并发审批由事务与状态检查保护（有集成测试覆盖）；打卡证据文件的上传与访问控制尚未实现。

### AI 评语（三步闭环）

```text
教师提交学生、语气和补充说明
  → 创建 AiJob（PENDING → RUNNING → SUCCEEDED/FAILED）
  → 基础文本脱敏 → Provider 生成草稿（默认 mock 模板）
  → 教师编辑草稿
  → 「确认保存评语」写入 StudentComment 评语档案
  → 页面下方查看已保存评语
```

`AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` 启用真实模型调用（服务端密钥，不经浏览器）；默认 `mock` 无需任何 key。

### 奖励兑换

```text
学生用积分发起兑换（Idempotency-Key 幂等）
  → 事务内校验余额与库存并原子扣减
  → 教师审批 / 履约 / 取消
  → 取消时事务内回补积分与库存
```

## 页面与 API 能力

### 教师端页面

| 页面 | 当前能力 |
| --- | --- |
| `/auth/login` | 教师登录 |
| `/dashboard` | 班级聚合数据、宠物、积分和任务摘要 |
| `/classrooms` | 班级列表（真实数据） |
| `/classrooms/new` | 创建班级 |
| `/classrooms/[id]/students` | 学生管理：CRUD、JSON 导入、分组、搜索、筛选（真实数据） |
| `/classrooms/[id]/points` | 学生积分、流水、幂等撤销；`PointRule` CRUD 与小组榜 |
| `/classrooms/[id]/checkins` | 查看任务/记录，批准或拒绝待审核记录 |
| `/classrooms/[id]/checkins/new` | 创建打卡任务 |
| `/classrooms/[id]/zoo` | 班级动物园：学生宠物卡片、一键分配、宠物详情和喂食 |
| `/classrooms/[id]/badges` | 荣誉墙：徽章墙视图 |
| `/classrooms/[id]/leaderboard` | 光荣榜：按徽章数排序 |
| `/classrooms/[id]/rewards` | 小卖部：奖励商品 CRUD 与兑换管理 |
| `/classrooms/[id]/settings` | 系统设置：班级信息、成长阈值、全局系统名称；二级菜单含数据台账、班级大屏 |
| `/classrooms/[id]/audit` | 数据台账：积分流水台账、CSV 导出、按日期清理 |
| `/classrooms/[id]/screen` | 班级大屏：宠物主舞台（成长值进度条）+ Top8 排行榜 + 实时时钟，3 秒轮询，支持全屏 |
| `/classrooms/[id]/pet` | 旧"班级宠物"入口，重定向到动物园 |
| `/classrooms/[id]/ai` | AI 工作台入口 |
| `/classrooms/[id]/ai/comment` | 评语生成：草稿生成 → 编辑 → 确认保存评语档案 |

### 其他角色页面

| 页面 | 当前能力 |
| --- | --- |
| `/student` | 学生登录 |
| `/student/checkins` | 学生端打卡任务提交 |
| `/student/rewards` | 学生端奖励查看与兑换发起 |
| `/parent` | 家长只读摘要 |
| `/admin` | Admin 后台（基础） |
| `/forbidden` | 越权访问提示页 |

### API 领域

- Auth：登录、退出、当前教师信息。
- Classroom：班级创建、列表、详情和归属校验。
- Student：学生列表、创建、更新、删除、JSON 导入。
- Points：积分流水、排行榜、手动加分、幂等反向流水。
- Check-in：任务、记录、统计、批准、拒绝（事务）。
- Pet：学生宠物读取和成长日志。
- Dashboard：班级聚合数据（含宠物成长进度）。
- Screen：班级大屏数据（宠物成长进度、Top8 榜单）。
- Comments：评语档案保存与列表（`StudentComment`）。
- Audit：流水台账 CSV 导出、按日期清理。
- AI：评语草稿提交、AiJob 状态查询。
- Redemption：兑换申请（幂等）、审批、履约、取消。

## 技术栈与工程结构

- Next.js 15 App Router
- React 19
- TypeScript（strict）
- Tailwind CSS（暖纸教室手册 × 贴纸动物园设计系统：paper/ink/forest 色板、贴纸阴影、楷体展示字）
- Prisma 6 + PostgreSQL
- Zod
- Vitest + Testing Library
- Playwright
- Docker Compose（postgres / redis / migrate / web / worker 五服务）

```text
src/app/                 页面与 API Route Handlers
src/components/          可复用 UI 组件（宠物形象、弹窗、布局壳）
src/server/auth/         会话、角色守卫与密码
src/server/services/     班级、积分、打卡、宠物、AI、评语、台账业务服务
src/server/ai/           AiJob 处理器、Provider adapter、脱敏
src/server/utils/        错误和响应封装
src/workers/             AI 异步任务 worker（DB 轮询认领）
prisma/schema.prisma     数据模型事实源
prisma/migrations/       6 条幂等迁移链
prisma/seed.mjs          本地演示数据（教师、班级、宠物品种、成长阈值、学生宠物）
tests/                   Vitest 单元/API 合约测试（含需独立 PG 的集成测试）
e2e/                     Playwright 浏览器流程
scripts/                 容器化备份/恢复脚本
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
| `npm run dev` | 启动 Next.js 开发服务器（predev 自动生成 Prisma Client） |
| `npm run build` | 生成 Prisma Client 并构建生产版本 |
| `npm run start` | 启动生产构建 |
| `npm run worker` | 运行 AI 异步任务 worker（DB 轮询认领） |
| `npm run lint` | 执行 ESLint，禁止 warning |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行 Vitest（当前 20 个文件 / 62 个用例） |
| `npm run test:watch` | 以 watch 模式运行 Vitest |
| `npm run test:integration` | 运行 PostgreSQL 集成测试（需要 `TEST_DATABASE_URL`） |
| `npm run test:coverage` | 运行 Vitest 覆盖率；需先安装匹配版本的 `@vitest/coverage-v8` |
| `npm run test:e2e` | 运行 Playwright E2E |
| `npm run test:e2e:ui` | 以 Playwright UI 模式运行 E2E |
| `npm run test:e2e:real` | 运行连接真实环境的 E2E |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:migrate` | 开发环境创建/应用 Prisma migration |
| `npm run db:deploy` | 部署已提交的 Prisma migration 链 |
| `npm run db:seed` | 写入本地演示教师、班级、宠物品种、成长阈值、系统设置和学生宠物 |

## 测试与验证

当前测试覆盖三类目标：

- Vitest 单元/API 合约：20 个文件、62 个用例（服务事务逻辑、API envelope、权限守卫、评语档案合约等）。
- Vitest 集成：5 个文件（并发审批、并发积分、并发兑换、事务完整性、AiJob 认领），需要 `TEST_DATABASE_URL` 指向独立 PG。
- Playwright E2E：4 个 spec（登录流程、审批、Dashboard 切换、AI 失败降级）。

当前不足：集成测试依赖本地 PostgreSQL 环境才能运行；移动端流程、跨班级授权矩阵和 AI Provider 失败注入的覆盖仍不充分。覆盖率阈值配置在 `vitest.config.ts`，不等于所有核心业务都已经被真实集成测试验证。

当前可用验证命令：

```bash
npm run lint
npm run test
npm run test:e2e
npx prisma validate
```

`npm run test:coverage` 当前缺少 `@vitest/coverage-v8`，补充匹配版本的开发依赖后再纳入质量门禁。

## 部署说明

### Docker Compose（已验证路径）

单机服务器部署已在腾讯云 OpenCloudOS + Docker Compose 上端到端验证。Compose 启动五个服务：`postgres`、`redis`、`migrate`（一次性迁移任务）、`web`（端口 3000，依赖 migrate 成功退出）、`worker`（AI 异步任务轮询）。

```bash
# 服务器首次部署
git clone <repo> && cd class-pet-ai
cat > .env <<EOF
DATABASE_URL=postgresql://postgres:<密码>@postgres:5432/class_pet_ai
SESSION_SECRET=$(openssl rand -hex 32)
TEACHER_LOGIN_EMAIL=<邮箱>
TEACHER_LOGIN_PASSWORD=<密码>
EOF

docker compose up -d --build    # migrate 自动应用迁移链，成功后 web 启动

# 日常升级
docker compose exec postgres pg_dump ...   # 或直接用下面的备份脚本
git pull
docker compose up -d --build
```

**升级前务必备份**：

```bash
scripts/backup-db.sh    # 自动探测 postgres 容器，pg_dump + gzip + 完整性校验
scripts/restore-db.sh   # 恢复
```

**迁移约定（重要）**：所有迁移必须幂等（`IF EXISTS` / `IF NOT EXISTS` / 先 DELETE 再 DDL），保证空库链式初始化与存量库增量对齐两条路径都成立。历史教训：跨环境迁移账本分叉时，用 `prisma migrate resolve --rolled-back` / `--applied` 对齐后，再以幂等对齐迁移（如 `202610280001_zoo_align`）收敛 schema 差异。

**排障入口**：

```bash
docker compose logs migrate --tail 30     # 迁移失败原因
docker compose exec postgres psql -U postgres class_pet_ai \
  -c "select migration_name, finished_at, rolled_back_at from _prisma_migrations order by migration_name;"
```

注意 `psql` 元命令 `\dt` 的 pattern 含大写字母时匹配不可靠，查带引号大写表名请用 `\dt "StudentComment"` 或直接 `select`。

### Vercel + 托管 PostgreSQL

可作为 MVP、演示或内部试用的目标架构；当前安全和运维缺口未补齐前，不应直接用于真实学生数据的试点。配置 `DATABASE_URL`、`SESSION_SECRET` 以及教师账号变量后构建：

```bash
npx prisma generate && npm run build
npx prisma migrate deploy   # 迁移链已提交并验证
```

### 正式上线前检查

- 使用强随机 `SESSION_SECRET`，移除默认教师密码与默认数据库密码。
- 使用 HTTPS，并配置安全 Cookie 和安全响应头。
- 持续执行迁移升级前的备份与恢复演练。
- 增加错误追踪与告警接入。
- 验证教师、班级和学生数据隔离矩阵。
- 评估未成年人数据隐私、删除、导出、证据文件访问和 AI Provider 数据处理。
- 明确 Redis 是否用于队列/缓存；若不使用，移除无效基础设施依赖。
- 完成移动端、并发和容量测试。

## 当前已知限制：不要过度承诺

- **单教师账号**：当前通过环境变量配置唯一教师账号；多教师、多班级归属管理尚未实现。
- **真实 AI 默认关闭**：`AI_PROVIDER` 默认 `mock`（固定模板）；真实模型需显式配置 `anthropic` + `ANTHROPIC_API_KEY`。
- **实时同步**：班级大屏约 3 秒轮询，不是 WebSocket 或 SSE。
- **AI 任务双路径**：草稿生成同时走请求内 fire-and-forget 与独立 worker 轮询；单机场景可用，多副本水平扩展前需要收敛为单一队列路径。
- **集成测试环境**：5 个集成测试文件需要独立 PostgreSQL（`TEST_DATABASE_URL`），CI 未固定执行。
- **打卡证据文件**：证据要求的数据模型已预留，上传与访问控制未实现。
- **数据合规**：项目没有声称完成未成年人数据合规认证或法律审查。
- **规模能力**：尚无高可用、压力测试、容量基准或队列伸缩数据。
- **密钥轮换**：`SESSION_SECRET` 无轮换机制；会话版本已预留字段。

## 迭代路线图

路线图是计划，不代表当前已完成。

### P0：多教师与多租户

- 多教师账号体系与班级归属管理，移除单教师环境变量。
- 教师/班级/学生数据隔离的完整授权矩阵测试。
- Redis 去留决策：删除，或正式用于 AI 队列/缓存。

**验收**：多个教师各自只能访问自己的班级；越权访问全部被守卫拦截并有测试覆盖。

### P1：实时与证据

- 班级大屏升级为 SSE/WebSocket 推送。
- 打卡证据文件上传、存储与访问控制。
- 移动端适配与真机测试。

**验收**：大屏数据延迟降至亚秒级；证据文件链路有权限控制。

### P2：AI 能力深化

- 评语之外扩展班级总结、学生洞察（保持教师确认边界）。
- 结构化输出、敏感内容检查、耗时与成本记录。
- AI 队列收敛为单一 worker 路径，支持水平扩展。

**验收**：每条 AI 输出都有来源数据范围、成本记录和教师确认边界。

### P3：产品化

- 家长端从只读摘要扩展到绑定关系与可见数据控制。
- 报表导出、数据保留/删除/导出策略。
- 学校级多班级管理与数据隔离。
- 压力测试与容量基准。

**验收**：每个角色有独立完整的登录/授权闭环；多租户隔离有真实测试和审计证据。

## 贡献与文档维护

- 代码、路由、schema 和测试是功能状态事实源；README 不先于代码宣称能力。
- 新功能合并时，同步更新功能状态矩阵、启动步骤、限制和路线图。
- "部分实现"必须写清已完成部分和缺口。
- 新增环境变量、命令、API 或部署步骤时，同步更新对应章节。
- 新增数据库迁移必须幂等（`IF EXISTS` / `IF NOT EXISTS`），并在空库与存量库两条路径验证。
- 不提交 `.env`、API key、生产密码或真实学生数据。
- 涉及学生数据、AI、认证、支付/兑换或跨班级权限的变更，先补测试和安全评审。

## License

License 尚未确定。公开发布前请补充许可证和贡献协议。
