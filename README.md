# 仓库管理（出入库 + 统计 + 申报对比）

跨平台桌面应用：Electron + React + TypeScript + Ant Design + ECharts + SQLite。

## 功能概览

- **物资与库存**：物资维护、当前库存、最低库存预警
- **入库/出库**：快速录入，支持关联申报单入库
- **申报单**：新建/提交/关闭，到货累计与状态自动更新
- **报表**：按日汇总、Top10、明细表，导出 PNG、保存报表快照
- **设置**：经办人管理、数据库备份/恢复

## 环境要求

- Node.js 18+
- npm 或 yarn

## 安装与运行

```bash
cd warehouse-app
npm install
```

### 开发模式

```bash
npm run dev
```

（会先编译 Electron 主进程，再启动 Vite 与 Electron；首次可能稍慢。）

### 生产构建

```bash
# 编译 + 打包（当前平台）
npm run build

# 仅 Windows 安装包
npm run build:win

# 仅 Linux AppImage
npm run build:linux
```

打包输出在 `release/` 目录。

## 数据存储

- SQLite 数据库位于**用户数据目录**：
  - Windows: `%APPDATA%/warehouse-app/warehouse.db`（以实际 appId 为准）
  - Linux: `~/.config/warehouse-app/warehouse.db`（或类似路径）
- 首次启动会自动建表并注入种子数据（10 个物资、2 个经办人、若干流水、1 个申报单）。

## 项目结构

- `electron/`：主进程（main.ts、preload.ts、db.ts）
- `src/`：React 页面与组件
- `src/pages/`：Dashboard、Inbound、Outbound、Inventory、Claims、ClaimDetail、Reports、Settings

## 技术栈

- Electron、React 18、TypeScript、Vite
- Ant Design 5、ECharts（echarts-for-react）
- better-sqlite3、electron-builder
