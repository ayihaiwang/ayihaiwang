# Web + 本地后端架构迁移完成报告

## ✅ 完成状态

所有要求的功能已全部实现并验证通过。

## 📁 Server 目录结构

```
server/
├── index.js    # Fastify HTTP 服务器入口（4.3K）
└── db.js       # 数据库操作逻辑（14K，复用 electron/db.ts）
```

## 🔌 API 列表

### 基础 API
- `GET /api/health` - 健康检查
- `POST /api/db/init` - 初始化数据库表
- `POST /api/db/seed` - 填充种子数据
- `GET /api/db/export` - 导出数据库备份（返回 .db 文件）
- `POST /api/db/import` - 导入数据库备份

### Items API（物品管理）
- `GET /api/items?activeOnly=true` - 获取物品列表
- `POST /api/items` - 创建物品
- `PUT /api/items/:id` - 更新物品

### Stocks API（库存管理）
- `GET /api/stocks` - 获取库存列表

### Operators API（操作员管理）
- `GET /api/operators` - 获取操作员列表
- `POST /api/operators` - 添加操作员

### Movements API（出入库操作）
- `POST /api/movements/in` - 入库操作（事务：更新库存、关联申报单）
- `POST /api/movements/out` - 出库操作（事务：校验库存、更新库存）
- `GET /api/movements/recent?limit=50` - 最近操作记录

### Claims API（申报单管理）
- `GET /api/claims` - 获取申报单列表
- `GET /api/claims/:id` - 获取申报单详情
- `POST /api/claims` - 创建申报单
- `PUT /api/claims/:id/status` - 更新申报单状态
- `GET /api/claims/:id/items` - 获取申报单物品列表
- `GET /api/claims/for-inbound` - 获取待入库申报单

### Reports API（报表统计）
- `GET /api/reports/daily?start=2026-01-01&end=2026-12-31&itemId=1&operator=张三` - 日报统计
- `GET /api/reports/top-items?start=2026-01-01&end=2026-12-31&type=IN&limit=10` - 热门物品统计
- `GET /api/reports/movements?start=2026-01-01&end=2026-12-31&itemId=1&operator=张三` - 操作记录查询

**注意**: 图表 PNG 导出功能在前端实现（使用 ECharts 的 `getDataURL`），无需后端 API。

## 🚀 dev:web 启动日志

```
Now using node v18.20.8 (npm v10.8.2)

> warehouse-app@1.0.0 dev:web
> concurrently "vite --port 5173 --strictPort" "node ./server/index.js"

[1] {"level":30,"time":1771413103063,"pid":2918183,"hostname":"harbrzb-MCLG-XX","msg":"Server listening at http://127.0.0.1:41731"}
[1] 🚀 Server running at http://127.0.0.1:41731
[0]   VITE v5.4.21  ready in 152 ms
[0]   ➜  Local:   http://localhost:5173/
```

## 💾 数据库文件位置

**数据库文件路径**: `~/.warehouse-app/warehouse.db`

- 数据库文件存储在用户主目录下的 `.warehouse-app` 目录
- 如果目录不存在，服务器会自动创建
- 当前文件大小：52K（已包含种子数据）
- 单机软件，本机生成 SQLite，本机使用，不支持多人共享

## ✅ 功能验证清单

### 入库功能 ✅
- [x] 选择物品、数量、日期、操作员
- [x] 关联申报单（可选）
- [x] 自动更新库存
- [x] 自动更新申报单状态（累计到货、状态刷新）

### 出库功能 ✅
- [x] 选择物品、数量、日期、操作员
- [x] 库存不足校验（事务保护）
- [x] 自动更新库存

### 库存管理 ✅
- [x] 查看当前库存
- [x] 添加/编辑物品
- [x] 最低预警显示

### 申报管理 ✅
- [x] 创建申报单
- [x] 查看申报单详情
- [x] 更新申报单状态
- [x] 申报单与入库关联

### 报表统计 ✅
- [x] 日报统计（图表展示）
- [x] 热门物品统计
- [x] 操作记录查询
- [x] 图表 PNG 导出（前端实现）

### 数据导出 ✅
- [x] 导出数据库备份（.db 文件）
- [x] 导入数据库备份

## 📝 NPM 脚本

```json
{
  "dev:web": "concurrently \"vite --port 5173 --strictPort\" \"node ./server/index.js\"",
  "dev:desktop": "npm run compile && concurrently \"vite\" \"wait-on http://localhost:5173 && ./scripts/run-electron.sh .\"",
  "start:server": "node ./server/index.js"
}
```

- `npm run dev:web` - Web 模式（推荐，Linux/Windows/Mac 通用）
- `npm run dev:desktop` - Electron 桌面模式（保留，Windows 使用）
- `npm start:server` - 仅启动后端服务器

## 🔧 技术栈

- **后端**: Fastify 4.x + better-sqlite3
- **前端**: React + Vite + Ant Design + ECharts
- **通信**: HTTP REST API（替代 IPC）
- **数据库**: SQLite（单机本地存储）

## 📍 访问地址

- **前端**: http://localhost:5173
- **后端 API**: http://127.0.0.1:41731/api

## ✨ 关键特性

1. **事务逻辑保持不变**: 出库校验、申报累计到货、状态刷新等所有事务逻辑完全保留
2. **前端代码无需修改**: 通过 API 客户端自动适配，所有页面组件继续使用 `window.electronAPI`
3. **数据库位置统一**: 统一存储在用户目录 `~/.warehouse-app/warehouse.db`
4. **跨平台支持**: Web 模式支持 Linux/Windows/Mac，Electron 模式保留用于 Windows 打包

## 🎯 总结

✅ 成功将 Electron IPC 架构迁移为 Web + HTTP API 架构
✅ 所有业务功能保持不变
✅ 事务逻辑完全保留
✅ 前端代码无需修改
✅ 数据库位置统一在用户目录
✅ 支持 Linux/Windows/Mac 多平台运行

现在可以在 Linux 上通过浏览器完整测试所有业务功能，无需依赖 Electron。
