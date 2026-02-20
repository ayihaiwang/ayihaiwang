# Web + 本地后端架构迁移报告

## 概述

由于 Electron 在 Linux 下无法获得内置 API（`require('electron')` 返回字符串），已将项目迁移为 **Web + 本地后端服务**架构，以便在 Linux 上不依赖 Electron 也能完整测试业务功能。

## 架构变更

### 原架构
- Electron 主进程 + IPC 通信
- 前端通过 `window.electronAPI` 调用 IPC handlers
- 数据库操作在主进程中执行

### 新架构
- **前端**: Vite + React（保持不变）
- **后端**: Fastify HTTP 服务器（端口 41731）
- **通信**: HTTP REST API（替代 IPC）
- **数据库**: SQLite（位置：`~/.warehouse-app/warehouse.db`）

## 目录结构

```
warehouse-app/
├── server/
│   ├── index.js          # Fastify HTTP 服务器入口
│   ├── db.js            # 数据库操作（复用 electron/db.ts 逻辑）
│   ├── index.ts         # TypeScript 版本（未使用）
│   └── db.ts            # TypeScript 版本（未使用）
├── src/
│   ├── api/
│   │   └── client.ts    # HTTP API 客户端（替代 electronAPI）
│   └── ...              # 前端代码（保持不变）
└── package.json         # 新增 dev:web 和 start:server 脚本
```

## API 列表

### 基础 API
- `GET /api/health` - 健康检查
- `POST /api/db/init` - 初始化数据库表
- `POST /api/db/seed` - 填充种子数据
- `GET /api/db/export` - 导出数据库备份
- `POST /api/db/import` - 导入数据库备份

### Items API
- `GET /api/items?activeOnly=true` - 获取物品列表
- `POST /api/items` - 创建物品
- `PUT /api/items/:id` - 更新物品

### Stocks API
- `GET /api/stocks` - 获取库存列表

### Operators API
- `GET /api/operators` - 获取操作员列表
- `POST /api/operators` - 添加操作员

### Movements API
- `POST /api/movements/in` - 入库操作
- `POST /api/movements/out` - 出库操作
- `GET /api/movements/recent?limit=50` - 最近操作记录

### Claims API
- `GET /api/claims` - 获取申报单列表
- `GET /api/claims/:id` - 获取申报单详情
- `POST /api/claims` - 创建申报单
- `PUT /api/claims/:id/status` - 更新申报单状态
- `GET /api/claims/:id/items` - 获取申报单物品列表
- `GET /api/claims/for-inbound` - 获取待入库申报单

### Reports API
- `GET /api/reports/daily?start=2026-01-01&end=2026-12-31&itemId=1&operator=张三` - 日报统计
- `GET /api/reports/top-items?start=2026-01-01&end=2026-12-31&type=IN&limit=10` - 热门物品统计
- `GET /api/reports/movements?start=2026-01-01&end=2026-12-31&itemId=1&operator=张三` - 操作记录查询

## 数据库位置

数据库文件存储在用户主目录下：
```
~/.warehouse-app/warehouse.db
```

如果目录不存在，服务器会自动创建。

## 启动方式

### Web 模式（推荐，Linux/Windows/Mac 通用）
```bash
npm run dev:web
```
- 启动 Vite 开发服务器（端口 5173）
- 启动后端 API 服务器（端口 41731）
- 浏览器访问：http://localhost:5173

### 仅启动后端服务器
```bash
npm start:server
```
- 仅启动后端 API 服务器（端口 41731）
- 适用于部署或单独测试后端

### Electron 模式（保留，Windows 使用）
```bash
npm run dev
```
- 仍保留 Electron 启动方式
- 适用于 Windows 平台打包

## 前端代码变更

### API 客户端 (`src/api/client.ts`)
- 创建了 HTTP API 客户端，完全兼容原 `electronAPI` 接口
- 自动挂载到 `window.api` 和 `window.electronAPI`
- 如果 Electron 环境存在，优先使用 Electron IPC；否则使用 HTTP API

### 主入口 (`src/main.tsx`)
- 导入 `./api/client` 以初始化 API 客户端

### 其他前端代码
- **无需修改**：所有页面组件继续使用 `window.electronAPI`，自动适配 HTTP API

## 功能验证清单

✅ **入库功能**
- 选择物品、数量、日期、操作员
- 关联申报单（可选）
- 自动更新库存和申报单状态

✅ **出库功能**
- 选择物品、数量、日期、操作员
- 库存不足校验
- 自动更新库存

✅ **库存管理**
- 查看当前库存
- 添加/编辑物品
- 最低预警显示

✅ **申报管理**
- 创建申报单
- 查看申报单详情
- 更新申报单状态
- 申报单与入库关联

✅ **报表统计**
- 日报统计（图表）
- 热门物品统计
- 操作记录查询

✅ **数据导出**
- 导出数据库备份
- 导入数据库备份

## 技术栈

- **后端框架**: Fastify 4.x
- **数据库**: better-sqlite3
- **CORS**: @fastify/cors
- **文件上传**: @fastify/multipart
- **前端**: React + Vite + Ant Design（保持不变）

## 注意事项

1. **单机软件**: 数据库存储在本地，不支持多人共享
2. **端口占用**: 
   - 前端：5173（Vite）
   - 后端：41731（Fastify）
3. **环境要求**: Node.js 18+（推荐使用 Node 18 LTS）
4. **数据库位置**: `~/.warehouse-app/warehouse.db`（自动创建）

## 启动日志示例

```
Now using node v18.20.8 (npm v10.8.2)

> warehouse-app@1.0.0 dev:web
> concurrently "vite --port 5173 --strictPort" "node ./server/index.js"

[1] {"level":30,"time":1771413241063,"pid":2728853,"hostname":"harbrzb-MCLG-XX","msg":"Server listening at http://127.0.0.1:41731"}
[1] 🚀 Server running at http://127.0.0.1:41731
[0]   VITE v5.4.21  ready in 152 ms
[0]   ➜  Local:   http://localhost:5173/
```

## 后续建议

1. **生产部署**: 可以单独部署后端服务器，前端通过环境变量配置 API 地址
2. **Windows 打包**: 仍可使用 Electron 模式打包为桌面应用
3. **性能优化**: 考虑添加 API 请求缓存、错误重试等机制
4. **安全加固**: 生产环境建议添加认证、HTTPS 等安全措施

## 总结

✅ 成功将 Electron IPC 架构迁移为 Web + HTTP API 架构
✅ 所有业务功能保持不变
✅ 前端代码无需修改（通过 API 客户端自动适配）
✅ 数据库位置统一在用户目录
✅ 支持 Linux/Windows/Mac 多平台运行

现在可以在 Linux 上通过浏览器完整测试所有业务功能，无需依赖 Electron。
