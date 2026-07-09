# arb —— 基金套利监控看板

跨市场基金折溢价套利实时监控系统。实时监测黄金原油、QDII 欧美、QDII 亚洲、国内 LOF、白银等上市基金的盘中溢价与估值偏差，发现跨市场套利机会。

> ⚠️ **风险声明**：本软件为学习与测试用途，所有数据均可能存在错误或延迟，**不应作为实际投资依据**。

## 环境要求

| 依赖 | 版本 |
|------|------|
| Python | >= 3.11 |
| Node.js | >= 18 |
| npm | >= 9 |

## 安装步骤

### 1. 克隆仓库

```bash
git clone <your-repo-url>
cd arb
```

### 2. 安装 Python 后端依赖

```bash
# 创建 Python 虚拟环境（推荐）
python -m venv .venv

# 激活虚拟环境
# Windows:
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate

# 安装依赖
pip install -r ArbDashboard\backend\requirements.txt
```

`requirements.txt` 包含以下核心依赖：`fastapi`、`uvicorn`、`pandas`、`numpy`、`sqlalchemy`、`pydantic`、`httpx`、`requests`、`pyyaml`、`paramiko`、`chinese-calendar`、`openpyxl`、`python-multipart`。

### 3. 安装前端依赖

```bash
cd ArbDashboard\frontend
npm install
```

前端技术栈：Vue 3 + TypeScript + Vite + NaiveUI + Pinia + ECharts。

### 4. 初始化数据库

首次使用需要将共享数据库模板重命名为正式数据库：

```bash
cd database

# Windows:
ren arb_master_share.db arb_master.db

# Linux / macOS:
mv arb_master_share.db arb_master.db
```

### 5. （可选）配置个人密钥

如需运行完整的历史数据流水线（含 Woody 估值因子），创建 `arbcore/config/account_private.py`：

```python
BOT_Key = "您的Woody_BOT_Key"
WOODY_USERNAME = "您的邮箱"
WOODY_PASSWORD = "您的密码"
```

该文件已在 `.gitignore` 中，不会被提交到 Git。**无需密钥也可正常查看实时行情与沙盘推演**。

## 启动项目

### 一键启动（推荐）

```bash
cd ArbDashboard
start_dashboard.bat
```

脚本自动执行：清理端口 → 启动后端 → 健康检查 → 启动前端 → 打开浏览器。

### 手动启动

```bash
# 终端1：启动后端（端口 8000）
cd ArbDashboard\backend
python main.pycd

# 终端2：启动前端（端口 5173）
cd ArbDashboard\frontend
npm run dev
```

浏览器访问 `http://localhost:5173`，Swagger API 文档访问 `http://localhost:8000/docs`。

## 界面功能

| 页面 | 功能 |
|------|------|
| 套利看板 | 核心监控页，分类 TAB 展示所有基金折溢价，支持自选管理 |
| 实时沙盘 | 单只基金深度分析：估值曲线 + 持仓篮子 + 五档盘口 + 下单 |
| 信号监视 | 自动盯盘规则配置，满足条件自动提醒 |
| 盘后对账 | 实盘交易记录、套利对管理、T+3 赎回提醒、Excel 导入 |
| ETF 轮动 | ETF 轮动组合实时监控 |
| 数据管理 | 手动触发数据同步与更新 |
| 系统配置 | 基金管理、数据源优先级、费率配置 |

## 数据源说明

程序采用多级瀑布流降级设计，行情获取时自动切换最优可用源：

### A 股 / 国内期货（四级瀑布流）

| 优先级 | 数据源 | 说明 |
|--------|--------|------|
| 1 | 银河 QMT | Socket 直连，速度最快 |
| 2 | 通达信 TQ | 内存直连，需启动通达信客户端 |
| 3 | 国金 QMT | xtquant 策略库 |
| 4 | 新浪 API | 兜底轮询，无需客户端 |

### 美股 / 港股（双通道）

| 角色 | 数据源 | 说明 |
|------|--------|------|
| 主通道 | 盈透证券 IB | 美股 ETF 实时行情 |
| 备用通道 | 富途 OpenD | 港股 + 美股备用 |

### 历史净值

- **Woody API**：估值因子核心锚点
- **腾讯 / 新浪 API**：国内 LOF 与美股历史 K 线自动获取

### 连接管理

程序启动默认不连接任何客户端（只启动新浪/腾讯 API 兜底），需在看板顶部点击对应标签手动连接：

- 🔴 红 = 未连接 | 🟡 黄 = 连接中 | 🟢 绿 = 已连接

## 项目结构

```
arb/
├── arbcore/                  # 大一统底层基座
│   ├── config/               # YAML 主配置 + 估值映射 + 数据源路由
│   ├── database/             # SQLite WAL 数据库管理（Fund/Market/System）
│   ├── fetchers/             # 数据获取层（实时/历史/WoodyAPI）
│   ├── calculators/          # 估值引擎（矩阵/魔法/跟踪指数/日增量）
│   ├── traders/              # 交易执行（银河QMT/国金QMT/通达信/IB）
│   ├── scripts/              # 运维脚本（YAML同步/静态估值重算）
│   └── utils/                # 交易日历/健康监控/熔断重试
├── ArbDashboard/
│   ├── backend/              # FastAPI 后端（端口 8000）
│   ├── frontend/             # Vue 3 前端（端口 5173）
│   └── start_dashboard.bat   # 一键启动脚本
├── database/                 # SQLite 数据库
└── docs/                     # 技术文档（22篇）
```

## 估值算法

| 算法 | 公式 | 适用场景 |
|------|------|----------|
| 矩阵公式 (Basket) | 净值 = Σ(权重 × 成分股价) × 汇率 | 持仓透明的 ETF |
| 魔法公式 (Hedge) | 净值 = 对冲 ETF 价格 ÷ Hedge 比率 | 有对冲工具的 LOF |
| 跟踪指数公式 | 净值 = 指数值 × 乘数 | 被动指数基金 |
| 日增量公式 | 净值 = 昨日净值 + 日变化量 | 日频更新基金 |

核心指标：**溢价率 = (市价 - 公允净值) / 公允净值**。

## 常见问题

| 问题 | 解决方法 |
|------|----------|
| 前端白屏 | 等待后端完全启动（约 30 秒）再刷新页面 |
| ModuleNotFoundError | 确认已激活 `.venv` 并执行 `pip install -r requirements.txt` |
| 数据不更新 | 点击侧边栏底部数据源标签，确认已变绿 |
| 端口 8000 被占用 | 运行 `netstat -ano | findstr :8000` 找到进程并 `taskkill /F /PID xxx` |
| 通达信连不上 | 确认通达信客户端已启动并登录 |
| 周末数据异常 | QMT 周末休眠，功能受限，属正常现象 |
| npm install 失败 | 确认 Node.js >= 18，尝试删除 `node_modules` 后重试 |
