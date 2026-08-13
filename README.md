# Class Zoo（班级动物园）

> 把传统课堂加减分转化为「学生专属宠物养成玩法」，让积分形成正向反馈闭环。

面向中小学班主任的班级德育趣味积分管理系统。教师给学生加分（喂食）、扣分（扣食物），每位学生养一只专属宠物，宠物满级（Lv.10）毕业自动获得徽章；徽章用于小卖部兑换奖励，并按徽章数量参与光荣榜排名。适配电脑网页端、手机端与希沃教学大屏。

当前项目是教师端 MVP / 原型，不是生产就绪系统。打卡任务与 AI 评语模块代码保留但不在本轮改造范围。

## 核心闭环

```text
课堂表现奖惩（加分 / 扣分 = 喂食 / 扣食物）
        ↓
学生专属宠物成长（Lv1 ~ Lv10，阈值可自定义）
        ↓
满级毕业 → 自动获得 1 枚徽章 → 领养下一只新宠物
        ↓
徽章：光荣榜排名 + 小卖部兑换奖励
```

## 当前状态

| 领域 | 状态 | 当前事实 |
| --- | --- | --- |
| 教师登录 | 已实现 | 单教师配置账号、签名 Cookie 会话、教师身份校验 |
| 班级管理 | 已实现 | 班级创建、列表、详情；班级列表页接入真实数据与毕业数统计 |
| 学生管理 | 已实现 | 学生 API CRUD、JSON 导入、搜索、分组筛选；页面含宠物分配入口 |
| 宠物品种目录 | 已实现 | `PetSpecies` 内置 10 个品种（猫/狗/熊猫等），每级独立视觉插槽 |
| 一键分配宠物 | 已实现 | 为未分配学生随机分配品种宠物（Lv1 幼崽），跳过已有宠物学生 |
| 宠物成长 | 已实现 | 加分推进成长、扣分倒退（下限 0）；`PetGrowthLog` 完整留痕 |
| 自定义成长阈值 | 已实现 | 每班级配置 1~10 级累计食物阈值，默认 `[0,5,10,20,30,45,60,75,90,100]` |
| 满级毕业 | 已实现 | 到达 Lv.10 自动标记毕业并发放 1 枚徽章（同事务） |
| 领养下一代 | 已实现 | 毕业宠物记录保留，可领养下一只新宠物继续循环 |
| 徽章墙 | 已实现 | 按学生展示累计/可用/已消耗徽章，含兑换历史 |
| 光荣榜 | 已实现 | 按可用徽章数排序，展示姓名、品种、等级、进度、徽章数 |
| 小卖部 | 已实现 | 奖励商品 CRUD、徽章兑换、审批、履约、取消退回徽章 |
| 批量/全班加减分 | 已实现 | 勾选多人或全班统一加减分，`batchKey` 幂等保护 |
| 数据台账 | 已实现 | 全操作日志、撤销留痕、CSV 导出、按日期清理 |
| 系统名称配置 | 已实现 | 全局系统名可改（默认「班级动物园」），首页/大屏/导航同步 |
| 班级大屏 | 已实现 | 动物园墙视图，约 3 秒轮询，支持全屏；不是 WebSocket/SSE |
| 打卡任务 | 保留 | 未在本轮改造范围，API 与页面维持原状 |
| AI 评语草稿 | 保留 | 未在本轮改造范围，Provider/worker 维持原状 |
| 多角色账号 | 部分 | 学生端首页/小卖部已接入宠物与徽章；家长/Admin 仍为占位 |
| Prisma Migration | 已完成 | `baseline`、`transaction_integrity`、`zoo_v1` 已提交 |
| Redis | 可选 | 当前使用 DB 轮询 worker 与内存限流；Redis 仅供更高规模时启用 |

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

# 空库：直接应用迁移链（baseline → transaction_integrity → zoo_v1）
npx prisma migrate dev

# 已有 v1 旧数据但没有迁移历史（之前用 db push 同步过 schema）：
# migrate deploy 会报 P3005，此时重置后重放迁移
# npx prisma migrate reset --force

npm run db:seed
npm run dev
```

打开 <http://localhost:3000>，使用 `.env` 中的 `TEACHER_LOGIN_EMAIL` 与 `TEACHER_LOGIN_PASSWORD` 登录（默认 `teacher@example.com` / `password123`）。`prisma/seed.ts` 固定使用该邮箱，会创建演示班级、10 个宠物品种、默认成长阈值并给演示学生分配随机宠物。

> **Linux / Debian 容器运行**：`prisma/schema.prisma` 的 `generator` 已配置
> `binaryTargets = ["native", "debian-openssl-1.0.x"]`，容器内先执行
> `npx prisma generate` 再 seed / dev，否则会报
> `Prisma Client could not locate the Query Engine for runtime "debian-openssl-1.0.x"`。

> **端口被占用**：`predev` 只自动释放本项目残留的 dev server；若 3000 被其他进程占用，
> 用 `ss -tlnp | grep :3000` 找到 PID 后 `kill -9 <PID>`，或改用 `npx next dev -p 3001`。

### 后台运行（服务端 / 容器）

```bash
nohup npm run dev > /tmp/class-pet-ai.log 2>&1 &
tail -f /tmp/class-pet-ai.log    # 查看日志
# 停止：kill $(lsof -tiTCP:3000 -sTCP:LISTEN)
```

生产场景建议用 `pm2`：`pm2 start "npm run start" --name class-pet-ai`。

### 建议体验路径

1. 登录教师账号 → **动物园**：每位学生一只专属宠物卡片，未分配的学生可「一键分配宠物」。
2. 点击某位学生的卡片 → 喂食（快捷 +1/+2 预设）→ 观察进度条推进与升级动画。
3. 持续喂食到 Lv.10 → 自动获得徽章 → 「领养下一只新宠物」。
4. **光荣榜** 查看徽章排行；**徽章墙** 查看全班徽章图鉴。
5. **小卖部** 用徽章兑换奖励；教师端审批/履约/取消兑换。
6. **积分管理** 支持单人/批量/全班加减分与撤销。
7. **设置** 自定义 1~10 级成长阈值与全局系统名称；**数据台账** 导出 CSV 或按日期清理。
8. **班级大屏** 全屏展示班级动物园墙（约 3 秒轮询）。

## 业务闭环

### 宠物成长

```text
教师喂食（+食物）或扣分（−食物）
  → PointTransaction 记账（batchKey 幂等）
  → 学生当前「养成中」宠物 growthValue ±= delta（下限 0）
  → 按班级阈值推导等级 Lv1~Lv10
  → 到达 Lv10 → 同事务标记 GRADUATED + 发放徽章
  → 领养下一只（adoptionSeq +1）继续
```

当前边界：成长等级由 `growthValue` 与阈值推导，`StudentPet.level` 为冗余缓存，喂食时刷新；修改阈值不自动重算存量宠物等级（下次喂食时生效）。

### 徽章与兑换

```text
宠物毕业 → 1 枚 Badge（AVAILABLE）
  → 小卖部兑换（costBadges）→ 原子消费可用徽章（FIFO）
  → 教师批准 / 履约 / 取消
  → 取消退回徽章 + 恢复库存
```

当前边界：兑换不再使用积分流水，积分只作为「食物」驱动宠物成长；`RewardRedemption.idempotencyKey` 保证重复请求幂等。

## 页面与 API

### 教师端页面

| 页面 | 当前能力 |
| --- | --- |
| `/auth/login` | 教师登录 |
| `/dashboard` | 打卡率、今日加分、在养宠物、毕业徽章摘要 |
| `/classrooms` | 班级列表（学生数、毕业宠物数） |
| `/classrooms/new` | 创建班级 |
| `/classrooms/[id]/students` | 学生 CRUD、导入、搜索、一键分配宠物、宠物进度卡 |
| `/classrooms/[id]/zoo` | 动物园墙：学生×宠物卡片、喂食/扣分、升级动画、毕业领徽章、领养下一只 |
| `/classrooms/[id]/points` | 单人 / 批量 / 全班加减分、流水、撤销、小组榜 |
| `/classrooms/[id]/badges` | 徽章墙（累计/可用/已消耗） |
| `/classrooms/[id]/leaderboard` | 光荣榜（徽章数排序） |
| `/classrooms/[id]/rewards` | 小卖部：奖励商品、兑换审批/履约/取消 |
| `/classrooms/[id]/audit` | 数据台账：操作日志、CSV 导出、按日期清理 |
| `/classrooms/[id]/settings` | 成长阈值配置、全局系统名称 |
| `/classrooms/[id]/screen` | 班级动物园大屏（约 3 秒轮询 + 全屏） |
| `/classrooms/[id]/checkins*` | 打卡任务与审批（保留，未改造） |
| `/classrooms/[id]/ai*` | AI 评语工作台（保留，未改造） |

### API 领域

- Auth：登录、退出、当前教师信息。
- Classroom / Student：班级与学生 CRUD、导入、搜索。
- Zoo：`GET /zoo`、`POST /pets/assign`、`GET /students/[id]/pet`、`POST /students/[id]/pet/adopt`、`GET /pet-species`。
- Feeding：`POST /points/feed`（单人/批量/全班，batchKey 幂等）、`POST /points/transactions`、撤销。
- Badges：`GET /badges`、`GET /students/[id]/badges`。
- Leaderboard：`GET /leaderboard`。
- Rewards：奖励商品 CRUD、徽章兑换、审批/履约/取消。
- Config：`GET/PUT /pet-level-config`、`GET/PUT /system-settings`。
- Audit：`GET /audit/export`（CSV）、`DELETE /audit`（清理）。
- Health：live / ready。

## 技术栈与工程结构

- Next.js 15 App Router、React 19、TypeScript（strict）、Tailwind CSS
- Prisma 6 + PostgreSQL、Zod
- Vitest + Testing Library、Playwright
- Docker Compose

```text
prisma/schema.prisma         数据模型事实源（PetSpecies/StudentPet/Badge/PetLevelConfig/SystemSetting）
prisma/migrations/           迁移链（baseline / transaction_integrity / zoo_v1）
prisma/seed.ts               演示数据
src/server/domain/           宠物成长规则（阈值推导、毕业判定、视觉 key）
src/server/services/         学生宠物、徽章、积分喂食、榜单、配置、审计等服务
src/server/utils/            错误与响应封装
src/components/pets/         PetVisual / PetCard / PetDetailModal / LevelUpModal / BatchFeedModal
tests/                       Vitest 单元/API 合约测试
e2e/                         Playwright 浏览器流程（含动物园核心闭环）
```

API 返回统一 envelope：

```json
{ "success": true, "data": {} }
```

错误响应使用 `success: false` 与 `error` 字段。

## 环境变量

来源：`.env.example`。当前默认值只适合本地开发。

| 变量 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 | `postgresql://postgres:postgres@localhost:5432/class_pet_ai` |
| `TEST_DATABASE_URL` | 否 | 集成测试数据库 | `postgresql://postgres:postgres@localhost:5432/class_pet_ai_test` |
| `SESSION_SECRET` | 是 | 会话签名密钥；生产必须强随机 | `change-me`（仅本地） |
| `NEXT_PUBLIC_APP_URL` | 否 | 预留应用访问地址 | `http://localhost:3000` |
| `AI_PROVIDER` | 否 | `mock` 或 `anthropic` | `mock` |
| `AI_API_KEY` / `ANTHROPIC_API_KEY` | 否 | Provider 密钥 | 空值 |
| `AI_MODEL` / `AI_TIMEOUT_MS` | 否 | Provider 模型与超时 | `mock-model` / `30000` |
| `TEACHER_LOGIN_EMAIL` | 是 | 单教师演示账号邮箱 | `teacher@example.com` |
| `TEACHER_LOGIN_PASSWORD` | 是 | 单教师演示账号密码 | `password123`（仅本地） |

## 命令参考

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生成 Prisma Client 并构建 |
| `npm run start` | 启动生产构建 |
| `npm run worker` | 运行 AI 异步 worker（DB 轮询） |
| `npm run lint` / `typecheck` | ESLint（零警告）/ 类型检查 |
| `npm run test` | Vitest 单元与 API 合约测试 |
| `npm run test:integration` | PostgreSQL 集成测试（需 `TEST_DATABASE_URL`） |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:migrate` / `db:deploy` / `db:seed` | 迁移与演示数据 |

## 测试与验证

- **Vitest**：宠物成长规则（自定义阈值/毕业判定）、积分喂食事务、徽章兑换消费/退回、打卡审批、响应 envelope。
- **Playwright**：教师端主流程 + 动物园核心闭环（分配→喂食→升级反馈），通过拦截 API 验证 UI。

当前可用验证命令：

```bash
npm run lint
npm run typecheck
npm run test
npx prisma validate
```

`test:integration` 需要真实 PostgreSQL；`test:coverage` 需要补 `@vitest/coverage-v8`。

## 部署说明

### Vercel + 托管 PostgreSQL

```bash
npx prisma generate && npm run build
```

生产首次初始化应通过已提交的迁移链：`npx prisma migrate deploy`。迁移链包含 `baseline`、`transaction_integrity`、`zoo_v1`，请在空库上先验证升级与回滚策略再对外试点。

### Docker Compose

```bash
docker compose up -d postgres     # 先只启动数据库
docker compose up -d --build      # 需要 public/ 目录或修复 Dockerfile
docker compose exec web npx prisma db push
```

当前 Dockerfile 会无条件复制 `/app/public`，而仓库没有 `public/` 目录，直接 `--build` 可能失败；请先修复 Dockerfile 或补充 `public/`。

### 正式上线前检查

- 使用强随机 `SESSION_SECRET`，移除默认教师密码，启用 HTTPS 与安全 Cookie。
- 建立并验证迁移升级/回滚流程（当前 `zoo_v1` 尚未在真实空库演练）。
- 数据库备份恢复演练、健康检查、结构化日志、限流告警。
- 学生数据隔离与未成年人数据隐私、删除、导出、证据文件访问评估。
- 明确 Redis 是否启用；移动端与并发/容量测试。

## 当前已知限制

- **宠物视觉**：内置品种用 emoji 占位，`visualSlots` 预留每级图片/3D 插槽，真实资产到位后无痛替换。
- **打卡 / AI 模块**：保留未改造，功能边界维持 v1 原状。
- **多角色端**：学生端已接入宠物/徽章/小卖部；家长与 Admin 仍为占位。
- **实时同步**：班级大屏约 3 秒轮询，不是 WebSocket/SSE。
- **事务边界**：喂食与毕业/徽章发放同事务；兑换徽章消费与取消退回同事务；打卡批准仍与奖励积分分开（历史边界）。
- **数据合规**：未完成未成年人数据合规认证或法律审查。
- **规模能力**：无高可用、压力测试、容量基准或队列伸缩数据。

## 迭代路线图

### P0：可信运行基础

- 在真实空库验证并演练 `zoo_v1` 迁移链与回滚。
- 将打卡批准与奖励积分并入同一数据库事务。
- 增加真实数据库、跨班级授权、并发与事务失败测试。
- 增加 `.dockerignore`，隔离 secrets、依赖与构建产物。
- 加固登录、会话、Cookie、密钥与登录限流；决定 Redis 去留。

### P1：动物园体验完整化

- 宠物品种目录管理页（增删品种、自定义视觉插槽）。
- 领养后新宠物命名、分组/多宠物展示与个人主页。
- 成绩单/家长可读报表导出；操作日志筛选与分页。

### P2：多角色与规模

- 学生端完整闭环（自提打卡、查看宠物、兑换）；家长只读摘要；Admin 后台。
- 评估 SSE/WebSocket 替代大屏轮询。
- 多班级、多教师与学校级数据隔离。

## 贡献与文档维护

- 代码、路由、schema 与测试是功能状态事实源；README 不先于代码宣称能力。
- 新功能合并时同步更新功能状态矩阵、启动步骤、限制与路线图。
- 不提交 `.env`、API key、生产密码或真实学生数据。
- 涉及学生数据、AI、认证、支付/兑换或跨班级权限的变更，先补测试与安全评审。

## License

License 尚未确定。公开发布前请补充许可证与贡献协议。
