# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目概述

跨市场基金折溢价套利实时监控看板。核心场景：监控黄金原油、QDII 欧美、QDII 亚洲、国内 LOF、白银等上市基金的盘中实时溢价与估值偏差，发现跨市场套利机会。

架构采用**"大一统底层基座 (arbcore) + SQLite WAL 并发数据库 + ArbDashboard 核心看板"**，技术栈为 Python 3.11 + FastAPI (后端 :8000) + Vue 3 + NaiveUI + Vite (前端 :5173)。

估值算法核心基于 palmmicro 技术体系，使用 Woody API 获取关键估值因子（仓位、权重、校准值）。

## 开发命令

```bash
# 一键启动看板（推荐）
start_dashboard.bat                                          # 自动启动后端(:8000)+前端(:5173)，等待30s健康检查后打开浏览器

# 手动启动后端
cd ArbDashboard/backend && python main.py                    # 启动 FastAPI 后端服务，端口 8000

# 手动启动前端（开发模式，热重载）
cd ArbDashboard/frontend && npm install && npm run dev       # Vite 开发服务器，端口 5173

# 手动构建前端（生产模式）
cd ArbDashboard/frontend && npm run build                    # 构建产物输出到 frontend/dist/

# 数据库初始化（首次使用）
cd database && ren arb_master_share.db arb_master.db         # 将共享数据库模板重命名为正式数据库

# 运行盘后数据更新流水线
cd ArbDashboard/backend && python -c "from arbcore.scripts import daily_updater; daily_updater.run()"

# 后台任务手动触发（需要后端运行中）
curl -X POST http://127.0.0.1:8000/api/system/trigger/011   # 触发011数据更新
curl -X POST http://127.0.0.1:8000/api/system/trigger/nav    # 触发净值更新
```

无单元测试框架配置。调试通过浏览器访问 `http://localhost:8000/docs` 查看 Swagger API 文档，或使用 SQLite 客户端直接查看 `database/arb_master.db`。

## 架构说明

### 整体分层拓扑

```
┌─────────────────────────────────────────────────────────┐
│  ArbDashboard/frontend  (Vue 3 + NaiveUI + Pinia)      │
│  看板 / 沙盘 / 信号监视 / 对账 / ETF轮动 / 配置         │
│  localhost:5173                                         │
├─────────────────────────────────────────────────────────┤
│  ArbDashboard/backend  (FastAPI + Uvicorn)              │
│  REST API + Lifespan 后台调度 + DashboardSnapshot 快照  │
│  localhost:8000                                         │
├──────────────┬──────────────────┬───────────────────────┤
│  arbcore/    │  calculators/    │  traders/             │
│  数据获取层  │  估值计算引擎    │  交易执行层           │
│  fetchers/   │  (矩阵/魔法/     │  银河QMT/国金QMT/     │
│  database/   │   跟踪指数/日增量)│  通达信/IB            │
│  config/     │                  │                       │
├──────────────┴──────────────────┴───────────────────────┤
│  database/arb_master.db  (SQLite WAL, 统一数据存储)     │
└─────────────────────────────────────────────────────────┘
```

### 数据流全景

```
VPS云端数据(Woody) → daily_updater(011) → SQLite DB
                                              ↓
实时行情源(多级瀑布流) → realtime/manager → static_valuation(012) → dynamic_valuation
                                              ↓
                                   DashboardSnapshotService(内存快照缓存)
                                              ↓
                              GET /api/dashboard → 前端 3s/30s 轮询
```

### arbcore/ —— 大一统底层基座

所有数据获取、估值计算、交易执行的核心引擎，被 ArbDashboard 作为依赖包引用。

**config/** —— 配置层：`lof_config.yaml` 是主配置文件（约 36KB），定义每只基金的代码、名称、分类、持仓篮子、对冲 ETF 等。`valuation_mapping.py` 定义每只基金使用的估值方法（矩阵公式/魔法公式/跟踪指数/日增量）。`symbol_source_map.py` 定义标的代码到数据源的映射。

**database/** —— 数据库层：`db_manager.py` 是核心数据库管理器，采用组合模式拆分为三个子管理器：`FundManager`（基金数据/因子/持仓/申赎）、`MarketManager`（汇率/期货/美股ETF）、`SystemManager`（健康检查/数据源配置/清理）。核心表：`unified_fund_list`（88只基金）、`unified_fund_history`（2万+历史记录）、`fund_daily_factors`、`exchange_rate`。

**fetchers/** —— 数据获取层，按"四级瀑布流"降级设计：
1. `fetchers/realtime/` —— 实时行情：`manager.py` 管理优先级和降级，资金源依次为银河QMT(Socket) → 通达信TQ接口 → 国金QMT(xtquant) → 新浪API(兜底)。美股走 IB/Futu 双通道。
2. `fetchers/historical/` —— 历史数据：`manager.py` 管理历史净值/价格拉取，含东方财富/新浪/腾讯/雪球等源。
3. `woody_api_service.py` / `woody_web_crawler.py` —— Woody API 是估值因子的核心锚点，无 API Key 时自动降级跳过。
4. `market_data_router.py` —— 市场数据路由服务，按标的类型智能选择数据源。

**calculators/** —— 估值计算层：
- `valuation_math.py`：核心数学引擎，实现矩阵公式(Basket，基于持仓篮子权重)、魔法公式(Hedge，基于对冲 ETF 价格反推)、跟踪指数公式、日增量公式四种算法。
- `static_valuation.py`：盘后静态估值（T+1历史回填），逐日推演历史净值曲线。
- `dynamic_valuation.py`：盘中动态估值（实时推演），结合实时行情 + 汇率 + 估值因子实时计算公允净值。

**traders/** —— 交易执行层：`trade_manager.py` 提供统一交易接口，底层支持三种通道：银河QMT Socket（v4.3 防僵尸线程世代机制）、国金MiniQMT xtquant（原生直连，推荐）、通达信 tqcenter（内存注入）。推荐优先级：国金MiniQMT > 通达信 > 银河QMT Socket。

**utils/** —— 工具层：`market_calendar.py` 支持 6 个交易所交易日历（A股/NYSE/NASDAQ/港交所/东京/瑞士）；`health_monitor.py` 健康监控；`retry_manager.py` 熔断重试。

### ArbDashboard/backend —— 后端 API 服务

**启动时序 (lifespan)**：
1. 初始化日志 + 数据库 + 所有 Service 单例
2. `FundService`：数据融合服务，将 DB 数据 + 实时行情 + 估值计算融合成统一的 FundItem
3. `DashboardSnapshotService`：核心性能优化组件。在后台异步循环计算估值快照（高优先级 TAB 立即刷新，低优先级 120 秒延迟），前端 API 只读取缓存，避免每次请求做重量级估值计算。
4. `SamplerService`：分时采样（60 秒间隔），记录盘中估值变化供 Analysis 页画曲线。
5. `AutoTradeRunner` / `RuleEngine` / `SignalDetector`：自动交易引擎，RuleEngine 基于 DB 驱动的规则扫描（5 秒周期），SignalDetector 检测套利信号。
6. 定时调度器：morning_refresh（9:20）、nav_update（18:00/19:30/21:00）。

**关键 API 端点分组**：
- `/api/dashboard` —— 核心看板数据，从 DashboardSnapshot 缓存直接返回，高性能
- `/api/fund/{code}/intraday` —— 分时曲线，供深度分析页使用
- `/api/system/reconnect_{ib,tdx,galaxy,guojin,futu}` —— 数据源动态重连
- `/api/ledger/` —— 实盘对账本（套利对+交易记录+Excel 导入+T+3 赎回提醒）
- `/api/rule_engine/` —— DB 驱动规则引擎 CRUD

### ArbDashboard/frontend —— 前端界面

**路由页面（8 个）**：
| 路由 | 组件 | 功能 |
|------|------|------|
| `/dashboard` | Dashboard.vue | 核心套利看板：分类 TAB（自选/黄金原油/QDII 欧美/QDII 亚洲/LOF/白银）+ 数据表格 + 自选管理 |
| `/analysis` | Analysis.vue | 实时沙盘深度分析：ECharts 估值曲线 + 篮子权重 + 五档盘口 + 测算沙盘 + 下单 |
| `/auto-trade` | AutoTrade.vue | 信号监视：自动交易规则配置 + SignalDetector 日志 |
| `/ledger` | Ledger.vue | 盘后对账：套利对管理 + 交易记录 + Excel 批量导入 |
| `/etf-rotation` | ETFRotation.vue | ETF 轮动分组实时监控 |
| `/data` | Data.vue | 数据管理：手动触发同步/更新 |
| `/settings` | Settings.vue | 系统配置：基金配置 YAML / 数据源优先级 / 费率 |
| `/lazymode` | LazyMode.vue | 幽灵做市商（私有插件） |

**数据流模式**（以 Dashboard 为例）：
```
onMounted → fundStore.fetchDashboard()
  → GET /api/dashboard?watchlist=...&category=...
  → 返回 FundItem[]（已融合估值+行情+溢价率）
  → 写入 Pinia store.tableData
  → 组件响应式渲染表格

定时刷新：
  高频 TAB（自选/黄金原油/QDII欧美）: 3 秒
  低频 TAB（其他）: 30 秒
```

**数据源连接按钮**：侧边栏底部实时显示 5 个数据源状态（通达信/IB/银河QMT/富途/国金QMT），绿=已连接、黄=连接中、红=未连接。程序启动默认不连接任何客户端（避免阻塞），需手动点击按钮触发连接，连接成功后新浪/腾讯等纯 API 源自动作为兜底。

### 四种估值算法

1. **矩阵公式 (Basket)**：净值 = Σ(持仓权重_i × 成分股价格_i) × 汇率，适用于持仓透明的 ETF
2. **魔法公式 (Hedge)**：净值 = 对冲ETF价格 / Hedge 比率，适用于有对冲工具的 LOF，如 1 股 164906 = 0.4 股 QQQ
3. **跟踪指数公式**：净值 = 跟踪指数值 × 乘数，直接映射指数
4. **日增量公式**：净值 = 昨日净值 + 今日净值变化量，用于部分日频更新的基金

估值计算时取价策略：溢价卖出用买一价，折价买入用卖一价。

### 基金分类体系

两级分类：主分类映射到看板 TAB（黄金原油/QDII 欧美/QDII 亚洲/LOF/白银/债券/其他），子分类用于估值算法选择和数据源路由。配置集中在 `lof_config.yaml`，共 88 只基金。

### 数据源连接机制（V10.0 重要变化）

- 程序启动时**不自动连接**任何需要客户端的源（通达信/QMT/IB/富途），只有新浪/腾讯等纯 API 源自动作为兜底
- 用户在看板顶部点击对应标签手动触发连接
- 标签颜色：红=未连接 | 绿=已连接 | 黄=连接中
- 连接失败需确认：对应客户端已启动且登录、非周末非交易时段 QMT 休眠问题

### 配置与密钥管理

- `arbcore/config/account_private.py`（不上传 Git）：Woody API Key、Woody 登录凭据、QMT 账号密码
- `arbcore/config/lof_config.yaml`（上传 Git）：基金定义、持仓篮子、对冲关系
- 无需密钥可查看实时行情和沙盘推演，但无法获取 Woody 估值因子运行完整历史数据流水线
