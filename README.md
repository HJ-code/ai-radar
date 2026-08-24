# 多源 AI 热点搜集站（AI 热点雷达）

一个由 AI 鉴别真伪、可多源可配置、自动通知的 **AI 热点雷达**：自动从多个免费源发现并搜集 AI 领域热点，经 AI「真伪识别 → 相关度评分 → 中文摘要」三道关后，以暗色雷达指挥室界面实时展示，命中关注关键词即站内 + 浏览器通知。

> 纯个人项目：全免费数据源、费用可控、AI 不可用时自动降级、零付费依赖。

---

## 功能

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 后端骨架：Express5 + TypeScript + SQLite（node:sqlite 内置），源/范围/关键词 CRUD，种子数据 | ✅ |
| P1 | 7 个免费源采集器 + 定时调度 + 去重入库 | ✅ |
| P2 | AI 三道关（真伪/相关/中文摘要）+ 规则降级 | ✅ |
| P3 | 通知层：SSE 实时推送 + 浏览器 Notification（可插拔 Notifier） | ✅ |
| P4 | 前端雷达指挥室（响应式暗色 UI） | ✅ |
| P5 / P6 | 测试（vitest）+ 验收 / Agent Skills | ⏳ 待做 |

## 技术栈

- **后端**：Node.js 24 · Express 5 · TypeScript（tsx 直跑，无编译步骤）· SQLite（Node 内置 `node:sqlite`，零原生依赖）
- **前端**：React 19 · Vite 8 · TypeScript · Tailwind CSS v4
- **AI 接入**：任意 OpenAI 兼容 `chat/completions` 服务（可插拔 `intelligence` 客户端）
- **数据源**：Hacker News · GitHub（高星新仓库，≥500 星）· Bilibili（科技分区榜）· 中文 RSS（量子位/机器之心/IT之家/极客公园/雷锋网/InfoQ中文/开源中国）· Reddit/Google News/Hugging Face（可选接入）（全部免费）

## 目录结构

```
├── server/                # 后端（Node + Express）
│   ├── src/
│   │   ├── ai/            # OpenAI 兼容客户端 + 三道关 prompts
│   │   ├── collectors/    # 7 个插件式采集器（实现 Collector 接口即可新增源）
│   │   ├── notifiers/     # 可插拔通知渠道
│   │   ├── repositories/  # SQLite 数据访问层
│   │   ├── routes/        # REST + SSE 路由
│   │   ├── services/      # 调度 / 采集主循环 / AI 流水线 / 通知分发 / SSE
│   │   └── db/            # 建表 + 种子数据
│   └── .env.example       # 环境变量模板（复制为 .env）
├── client/                # 前端（React + Vite + Tailwind）
│   └── src/
│       ├── api/           # REST + 类型
│       ├── components/    # Radar / HotspotCard / Ticker / StatusBar …
│       ├── hooks/         # 轮询 / SSE
│       └── pages/         # Dashboard / Config
└── docs/                  # 需求文档（PRD）· 技术设计文档（TDD）
```

## 快速开始

### 开发模式（前后端分离 + 热重载）

```bash
# 终端 1：后端（端口 5188）
cd server
npm install
npm run dev

# 终端 2：前端（端口 5173，/api 代理到 5188）
cd client
npm install
npm run dev
```

浏览器打开 **http://localhost:5173**。

### 单进程部署（生产托管）

```bash
cd client && npm run build    # 产物 → client/dist
cd ../server && npm start     # 一个进程同时提供页面 + API
```

浏览器打开 **http://localhost:5188**（后端检测到 `client/dist` 时自动托管）。

## 配置（server/.env）

```env
PORT=5188
DB_PATH=./data/hotspot.db

# AI 服务（OpenAI 兼容；不配置则自动降级为规则相关度）
AI_BASE_URL=https://…/v1
AI_API_KEY=…
AI_MODEL=…                # 用 GET {AI_BASE_URL}/models 列表里的模型名，不可带 [1M] 后缀
AI_TIMEOUT_MS=60000       # 免费端点偏慢，建议 ≥30s
AI_MIN_RELEVANCE=55       # 相关度低于此分不生成热点
AI_MAX_PER_RUN=20         # 每轮最多处理条数（控制费用/耗时）
AI_COOLDOWN_MS=60000      # 两轮 AI 处理间的冷却
```

> ⚠️ `.env` 已被 `.gitignore` 排除，AI key 不会入库；`server/.env.example` 提供模板。

## REST API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET/PUT | `/api/sources` · `/api/sources/:id` · `/api/sources/:id/toggle` | 源配置 / 启停 / 间隔 |
| GET/POST/PUT/DELETE | `/api/ranges` | 监控范围 CRUD |
| GET/POST/PUT/DELETE | `/api/keywords` | 告警关键词 CRUD |
| GET | `/api/items` · `/api/hotspots` | 条目流 / 热点列表 |
| GET | `/api/stats` | 概览计数 |
| POST | `/api/collect/now` | 立即采集一轮 |
| GET | `/api/system/ai` | AI 服务状态 |
| POST | `/api/system/ai/test` | AI 连通性自检（真实调用，不落库） |
| GET | `/api/stream/hotspots` | SSE 实时流（`alert` 事件） |
| GET | `/api/alerts` | 通知日志 |
| POST | `/api/alerts/notify/test` | 发送测试通知 |

## 核心机制

- **采集调度**：进程内每 20s 检查各源是否到期，按源独立间隔轮询；单源失败自动隔离，不影响整体。RSS/B站为**整库型源**，每轮只抓取一次（避免按关键词重复请求）。
- **关键词预过滤**：入库前条目标题/正文/URL 需命中任一启用关键词/范围词，否则丢弃（过滤计数返回 `/api/collect/now`）。
- **去重**：`items(source_key, external_id)` 唯一键；热点按 `url` 唯一。
- **AI 三道关**：每条新条目一次请求返回 `verdict(real/doubtful/fake) + relevance(0-100) + 中文摘要`。`fake` 隐藏；`doubtful` 降权（hotScore 减半）；相关度**仅主体相关给高分**（仅提及封顶 50）；判定倾向可信为真。`real` 且相关度达标、且**互动量达该源门槛** → 生成热点，`hotScore = 相关度 × log10(互动量+10)`。连续失败自动熔断并回落规则打分，不中断功能。
- **热点互动门槛**：交互型源需达标才入热点（HN points≥50 / GitHub stars≥500 / B站 view≥1万 或 like≥200），`extraJson` 见 `min<字段>` 可调；资讯型源（RSS）以相关度准入并在卡片标注「资讯」。
- **通知触发**：AI 判 `real` 且相关度达标且命中启用关键词、且仅对「本轮新插入的热点」通知（不回放存量刷屏）、`items.notified` 去重。通知渠道可插拔（当前：站内 `alert_logs` + SSE → 浏览器 Notification）。
- **浏览器通知**：需 **localhost 或 HTTPS** 上下文；打开页面后点顶栏铃铛授权。

## 已知限制

- Reddit / Google News / Hugging Face 在部分网络不可达（疑似需要代理）；采集器已就绪，失败自动降级，可换源或挂代理后直接可用。
- GitHub 未带 Token 时每分钟限 10 次查询（已内置 6.5s 节流）；可在源配置填 `apiKey` 提升额度。采集默认只收近 7 天 `stars>500` 的新仓库，弱数据源已从源头过滤。
- B 站科技分区榜 API 要求浏览器 User-Agent（否则 -352 风控），高频请求会临时限流；正常轮询频率下可用。
- 免费 AI 端点（如 opencode.ai 的 `mimo-v2.5`）单次调用较慢（15–45s），可调小 `AI_MAX_PER_RUN` 或换更快的模型（如 `deepseek-v4-flash`）。
- 模型对训练截止日期之后的事件偏保守，可能把近期新闻判为 `存疑`；已放宽为「可信即 real」倾向，仍可在 `server/src/ai/prompts.ts` 再调整。

## 文档

- [需求文档（PRD）](docs/需求文档.md)
- [技术设计文档（TDD）](docs/技术设计文档.md)