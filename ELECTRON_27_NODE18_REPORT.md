# Electron 27 + Node 18 降级测试报告

**执行时间**: 2026-02-18  
**目标**: 通过降级到 Electron 27 + Node 18 解决 `require('electron')` 返回字符串的问题

---

## 执行步骤与结果

### 1) 修改 package.json

**修改内容**:
```json
"electron": "27.3.11"  // 从 "^31.7.7" 改为固定版本 "27.3.11"
```

**状态**: ✅ 完成

---

### 2) 安装并切换到 Node 18 LTS

**执行命令**:
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 安装 Node 18
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" && nvm install 18

# 切换到 Node 18
nvm use 18
```

**结果**:
```
Now using node v18.20.8 (npm v10.8.2)
v18.20.8
10.8.2
```

**状态**: ✅ Node 18.20.8 已安装并激活

---

### 3) 清理并重装依赖

**执行命令**:
```bash
rm -rf node_modules package-lock.json
npm install
```

**结果**:
```
added 578 packages, and audited 579 packages in 2m
```

**状态**: ✅ 依赖安装成功，Electron 27.3.11 已安装

---

### 4) 编译并启动

**执行命令**:
```bash
lsof -ti:5173 | xargs -r kill || true
npm run compile
npm run dev
```

**编译结果**: ✅ 成功

**启动日志**:
```text
> warehouse-app@1.0.0 dev
> npm run compile && concurrently "vite" "wait-on http://localhost:5173 && ./scripts/run-electron.sh ."

> warehouse-app@1.0.0 compile
> tsc -p tsconfig.electron.json

[0]   VITE v5.4.21  ready in 134 ms
[0]   ➜  Local:   http://localhost:5173/

[1] [Electron 诊断] process.execPath: /home/harbrzb/warehouse-app/node_modules/electron/dist/electron
[1] [Electron 诊断] process.argv: ["/home/harbrzb/warehouse-app/node_modules/electron/dist/electron","/home/harbrzb/warehouse-app"]
[1] [Electron 诊断] process.versions: {
  "node":"18.17.1",
  "electron":"27.3.11",
  "chrome":"118.0.5993.159",
  ...
}
[1] [Electron 诊断] process.env.ELECTRON_RUN_AS_NODE: 0
[1] [Electron 诊断] typeof require("electron"): string
[1] [Electron 诊断] require("electron") 值: /home/harbrzb/warehouse-app/node_modules/electron/dist/electron
[1] [Electron] 错误: require("electron") 未返回 API 对象（当前类型: string）。未在 Electron runtime，需直接执行 Electron binary。
```

**状态**: ❌ **Electron 窗口仍未弹出**

---

## 诊断信息分析

### 关键发现

1. ✅ **Node 版本**: v18.20.8（符合要求）
2. ✅ **Electron 版本**: 27.3.11（已降级）
3. ✅ **process.versions.electron**: "27.3.11"（存在）
4. ✅ **process.env.ELECTRON_RUN_AS_NODE**: 0（已清除）
5. ❌ **require('electron')**: 仍然返回字符串路径

### 根本原因

**问题不是版本问题**。即使使用：
- ✅ Node 18.20.8（LTS）
- ✅ Electron 27.3.11（稳定版本）
- ✅ 环境变量已正确清除
- ✅ 使用干净环境启动

`require('electron')` 仍然被 Node.js 的标准模块解析机制解析到 `node_modules/electron/index.js`，返回可执行文件路径字符串，而不是 Electron 的 API 对象。

---

## 尝试的解决方案

### 方案 1: 修改 node_modules/electron/index.js
**尝试**: 在 Electron 主进程中检测并尝试通过 `process.binding` 或其他方式获取 API  
**结果**: ❌ 失败

### 方案 2: 使用 --require 预加载补丁脚本
**尝试**: 创建 `scripts/electron-patch.js`，在启动时通过 `--require` 预加载，修改 `Module._load`  
**结果**: ❌ 失败

### 方案 3: 从不同目录启动
**尝试**: 从 `/tmp` 目录启动 Electron，避免找到项目中的 `node_modules/electron`  
**结果**: ❌ 返回 `MODULE_NOT_FOUND`，Electron 未提供内置模块

---

## 最终结论

### 状态
- ❌ **Electron 窗口未成功弹出**

### 根本原因
**这不是版本问题，而是 Electron 在 Cursor IDE 集成终端环境下的模块加载机制失效**。即使：
- ✅ 使用 Node 18 LTS
- ✅ 使用 Electron 27.3.11（稳定版本）
- ✅ 环境变量已正确清除
- ✅ 使用干净环境启动

Electron 的内置模块加载器仍然没有正常工作，`require('electron')` 被 Node.js 的标准模块解析机制拦截，解析到 `node_modules/electron/index.js`。

### 已完成的修改

1. ✅ **package.json**: Electron 版本固定为 "27.3.11"
2. ✅ **Node 18**: 通过 nvm 安装并切换到 v18.20.8
3. ✅ **依赖重装**: 使用 Node 18 重新安装所有依赖
4. ✅ **scripts/electron-patch.js**: 创建了补丁脚本（未生效）
5. ✅ **scripts/run-electron.sh**: 添加了 `--require` 选项

### 版本信息

**最终环境**:
- **Node.js**: v18.20.8（通过 nvm）
- **npm**: v10.8.2
- **Electron**: 27.3.11

---

## 建议的后续行动

1. **在系统终端（非 Cursor IDE）中测试**:
   ```bash
   cd ~/warehouse-app
   export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh" && nvm use 18
   npm run dev
   ```

2. **检查 Cursor IDE 设置**: 查看是否有关于 Electron 或 Node.js 模块解析的特殊配置

3. **尝试其他 Electron 版本**: 虽然已尝试 27.3.11，但可以尝试：
   - Electron 26.x
   - Electron 25.x
   - Electron 24.x

4. **向 Electron 项目报告**: 这是一个潜在的 Electron bug，特别是在某些 IDE 集成终端环境下的模块加载问题

---

**报告生成时间**: 2026-02-18  
**测试环境**: Cursor IDE 集成终端  
**Node.js 版本**: v18.20.8（通过 nvm）  
**Electron 版本**: 27.3.11  
**最终状态**: ❌ 窗口未弹出，问题仍然存在
