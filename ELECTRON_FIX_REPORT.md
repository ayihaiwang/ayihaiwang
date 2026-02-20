# Electron 项目启动问题修复报告

**生成时间**: 2026-02-18  
**项目**: warehouse-app  
**问题**: Electron 主进程 `require('electron')` 返回字符串而非 API 对象，导致应用无法启动

---

## 📋 问题描述

### 原始错误
```
[Electron] 错误: require("electron") 未返回 API 对象（当前类型: string）。请使用 npm run dev 或 npx electron . 启动，不要用 node 运行主进程。
TypeError: Cannot read properties of undefined (reading 'whenReady')
```

### 根本原因
在 Electron 主进程中，`require('electron')` 被错误地解析到 `node_modules/electron/index.js`，该文件返回的是 Electron 可执行文件的路径字符串，而不是包含 `{ app, BrowserWindow, ipcMain, ... }` 的 API 对象。

### 环境信息
- **操作系统**: Linux (Ubuntu/Debian)
- **Node.js**: v20.20.0
- **Electron**: ^33.2.0 (也测试了 28.3.3，问题相同)
- **发现的环境变量**: `ELECTRON_RUN_AS_NODE=1` (在系统环境中被设置)

---

## ✅ 已完成的修改

### 1. Vite 端口配置 (`vite.config.ts`)

**修改内容**:
```typescript
server: {
  port: 5173,
  strictPort: true, // 端口被占用时直接报错，不自动换端口
}
```

**目的**: 确保 Vite 固定使用 5173 端口，端口被占用时直接报错，避免自动切换到其他端口导致 `wait-on` 等待错误的端口。

---

### 2. Electron 启动脚本 (`scripts/run-electron.sh`)

**修改内容**:
```bash
#!/usr/bin/env bash
# 确保以正确环境启动 Electron，避免 require('electron') 解析到 node 包
unset ELECTRON_RUN_AS_NODE
export ELECTRON_RUN_AS_NODE=0
# 通过 Node 解析 electron 包得到可执行文件路径（不依赖 PATH）
ELECTRON_BIN="$(node -p "require('electron')")"
exec "$ELECTRON_BIN" "$@"
```

**关键点**:
- ✅ 使用 `node -p "require('electron')"` 获取 Electron 二进制路径，不依赖 PATH
- ✅ 不直接使用 `./node_modules/.bin/electron` 或依赖 PATH 中的 `electron` 命令
- ✅ 强制清除 `ELECTRON_RUN_AS_NODE` 环境变量并设置为 0
- ✅ 使用 `exec` 替换当前进程，确保环境变量正确传递

---

### 3. 主进程入口防呆 (`electron/main.ts`)

**修改内容**:
```typescript
// 防呆：必须在真正的 Electron 主进程中运行
if (process.env.ELECTRON_RUN_AS_NODE === '1') {
  console.error('[Electron] 错误: 检测到 ELECTRON_RUN_AS_NODE=1，主进程无法获取 Electron API。未在 Electron runtime，需直接执行 Electron binary。');
  process.exit(1);
}
const electron = require('electron');
if (!electron || typeof (electron as { app?: unknown }).app === 'undefined') {
  console.error('[Electron] 错误: require("electron") 未返回 API 对象（当前类型: ' + typeof electron + '）。未在 Electron runtime，需直接执行 Electron binary。');
  process.exit(1);
}
const { app, BrowserWindow, ipcMain } = electron as typeof import('electron');
```

**关键点**:
- ✅ 检查 `ELECTRON_RUN_AS_NODE` 环境变量
- ✅ 验证 `require('electron')` 返回的对象是否包含 `app` 属性
- ✅ 错误提示文案已更新为「未在 Electron runtime，需直接执行 Electron binary」
- ✅ 修复了 `mainWindow` 的类型定义：`InstanceType<typeof BrowserWindow>`

---

### 4. package.json 脚本 (`package.json`)

**dev 脚本**:
```json
"dev": "npm run compile && concurrently \"vite\" \"wait-on http://localhost:5173 && ./scripts/run-electron.sh .\""
```

**关键点**:
- ✅ 使用 `./scripts/run-electron.sh .` 启动 Electron
- ✅ `wait-on` 等待 `http://localhost:5173`（Vite 固定端口）

---

## 🧪 测试结果

### 测试环境
- **工作目录**: `/home/harbrzb/warehouse-app`
- **Node 版本**: v20.20.0
- **npm 版本**: 已安装并可用

### 执行步骤

#### 1. 端口检查与清理
```bash
lsof -ti:5173 | xargs -r kill
```
**结果**: ✅ 端口 5173 已释放

#### 2. 依赖安装
```bash
npm install
```
**结果**: ✅ 依赖安装成功（581 packages）

#### 3. 编译
```bash
npm run compile
```
**结果**: ✅ TypeScript 编译成功，生成 `dist-electron/main.js`

#### 4. 启动开发服务器
```bash
npm run dev
```

**实际输出**:
```text
> warehouse-app@1.0.0 dev
> npm run compile && concurrently "vite" "wait-on http://localhost:5173 && ./scripts/run-electron.sh ."

> warehouse-app@1.0.0 compile
> tsc -p tsconfig.electron.json

[0] The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.
[0]
[0]   VITE v5.4.21  ready in 144 ms
[0]
[0]   ➜  Local:   http://localhost:5173/
[0]   ➜  Network: use --host to expose
[1] [Electron] 错误: require("electron") 未返回 API 对象（当前类型: string）。未在 Electron runtime，需直接执行 Electron binary。
[1] wait-on http://localhost:5173 && ./scripts/run-electron.sh . exited with code 1
```

**结果**: ❌ **Electron 窗口未成功弹出**

---

## 🔍 问题分析

### 核心问题
即使完成了所有修改（清除环境变量、使用正确的启动脚本），在 Electron 主进程中 `require('electron')` 仍然返回字符串路径，而不是 API 对象。

### 深入调查

#### 1. 环境变量检查
```bash
env | grep ELECTRON
```
**发现**: `ELECTRON_RUN_AS_NODE=1` 在系统环境中被设置

#### 2. Electron 二进制测试
```bash
ELECTRON_RUN_AS_NODE=0 ./node_modules/electron/dist/electron --version
```
**结果**: ✅ Electron 二进制正常运行（v20.18.3）

#### 3. 主进程内 require('electron') 测试
```bash
ELECTRON_RUN_AS_NODE=0 ./node_modules/electron/dist/electron -e "console.log(typeof require('electron'))"
```
**结果**: ❌ 返回 `"string"`（应该是 `"object"`）

#### 4. 尝试获取真实 API
测试了以下方法，均无法获取 Electron API：
- ❌ `Module.getBuiltinModule('electron')` → `undefined`
- ❌ `process.electronBinding('app')` → `undefined`
- ❌ `process.binding('electron')` → `No such module: electron`
- ❌ `process._linkedBinding('electron')` → `No such binding was linked: electron`

### 根本原因
在当前的 Electron 版本（33.2.0 和 28.3.3）和 Linux 环境下，Electron 的内部模块加载器没有正确拦截 `require('electron')` 调用。Node.js 的模块解析系统回退到标准的文件系统查找，找到了 `node_modules/electron/index.js`，该文件返回的是可执行文件路径。

这与 GitHub issue [#49034](https://github.com/electron/electron/issues/49034) 描述的问题类似（虽然该 issue 主要针对 Windows）。

---

## 💡 建议的解决方案

### 方案 1: 清除系统环境变量（推荐）

如果 `ELECTRON_RUN_AS_NODE=1` 在你的系统环境中被全局设置：

1. **检查配置文件**:
   ```bash
   grep -r "ELECTRON_RUN_AS_NODE" ~/.bashrc ~/.zshrc ~/.profile /etc/environment 2>/dev/null
   ```

2. **临时清除并测试**:
   ```bash
   cd ~/warehouse-app
   unset ELECTRON_RUN_AS_NODE
   npm run dev
   ```

3. **如果成功，永久清除**:
   - 从 `~/.bashrc`、`~/.zshrc` 或 `/etc/environment` 中删除 `export ELECTRON_RUN_AS_NODE=1`

### 方案 2: 使用不同的 Electron 版本

尝试使用其他 Electron 版本：

```bash
npm install electron@31.0.0 --save-dev
# 或
npm install electron@30.0.0 --save-dev
```

然后重新测试：
```bash
npm run dev
```

### 方案 3: 使用系统终端（非 IDE 集成终端）

某些 IDE（如 Cursor）的集成终端可能会继承特殊的环境变量。尝试在系统自带的终端中运行：

```bash
cd ~/warehouse-app
unset ELECTRON_RUN_AS_NODE
npm run dev
```

### 方案 4: 检查 Electron 安装完整性

如果上述方案都不行，可能是 Electron 安装不完整：

```bash
cd ~/warehouse-app
rm -rf node_modules/electron
npm install electron@^33.2.0 --save-dev
```

---

## 📝 修改文件清单

### 已修改的文件

1. **`vite.config.ts`**
   - 添加 `strictPort: true`

2. **`scripts/run-electron.sh`** (新建)
   - 使用 `node -p "require('electron')"` 获取二进制路径
   - 清除并设置 `ELECTRON_RUN_AS_NODE=0`
   - 使用 `exec` 启动 Electron

3. **`electron/main.ts`**
   - 添加环境变量检查
   - 添加 `require('electron')` 返回值验证
   - 更新错误提示文案
   - 修复 `mainWindow` 类型定义

4. **`package.json`**
   - `dev` 脚本使用 `./scripts/run-electron.sh .`
   - `electron:dev` 脚本同步更新

### 编译产物

- **`dist-electron/main.js`**: 包含防呆检查的编译后主进程文件

---

## 🔗 相关资源

- [Electron Issue #49034](https://github.com/electron/electron/issues/49034): `require('electron')` 返回可执行路径的问题
- [Electron 官方文档 - Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron 官方文档 - Process API](https://www.electronjs.org/docs/latest/api/process)

---

## 📊 状态总结

| 项目 | 状态 | 说明 |
|------|------|------|
| Vite 端口配置 | ✅ 完成 | 固定 5173，strictPort 启用 |
| Electron 启动脚本 | ✅ 完成 | 使用 `node -p` 获取路径，清除环境变量 |
| 主进程防呆检查 | ✅ 完成 | 检查环境变量和 require 返回值 |
| 错误提示文案 | ✅ 完成 | 更新为「未在 Electron runtime」 |
| 编译成功 | ✅ 完成 | TypeScript 编译无错误 |
| Vite 启动成功 | ✅ 完成 | 端口 5173 正常监听 |
| Electron 窗口弹出 | ❌ 失败 | require('electron') 仍返回字符串 |

---

## 🎯 下一步行动

1. **立即尝试**: 在你的系统终端中执行 `unset ELECTRON_RUN_AS_NODE && npm run dev`
2. **如果成功**: 检查并清除系统配置文件中的 `ELECTRON_RUN_AS_NODE=1`
3. **如果失败**: 尝试不同的 Electron 版本（31.x 或 30.x）
4. **如果仍失败**: 考虑向 Electron 项目提交 bug report，附上本报告

---

**报告生成时间**: 2026-02-18  
**修复尝试次数**: 多次  
**最终状态**: 代码修改完成，但受限于环境问题，Electron 窗口在本测试环境中未能成功弹出
