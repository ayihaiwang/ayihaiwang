# STEP 0: 快速体检报告

> 生成时间：2026-02-20  
> 目标：列出当前关键配置（不改动）

---

## 1) package.json - scripts/build/electron-builder 相关字段

### Scripts
```json
{
  "scripts": {
    "dev": "npm run compile && concurrently \"vite\" \"wait-on http://localhost:5173 && ./scripts/run-electron.sh .\"",
    "build": "npm run compile && vite build && electron-builder",
    "build:win": "npm run compile && vite build && electron-builder --win",
    "dist:win": "npm run compile && vite build && electron-builder --win --publish never",
    "build:linux": "npm run compile && vite build && electron-builder --linux",
    "compile": "tsc -p tsconfig.electron.json",
    "dev:web": "concurrently \"vite --port 5173 --strictPort\" \"tsx server/index.ts\"",
    "start:server": "tsx server/index.ts"
  }
}
```

**关键发现**：
- ❌ **生产环境仍使用 tsx 运行 TS**：`start:server` 和 Electron main.ts 都使用 `tsx server/index.ts`
- ❌ **没有后端编译脚本**：缺少 `server:build` 脚本
- ✅ **有 Electron 编译脚本**：`compile` 使用 `tsconfig.electron.json`
- ✅ **构建流程**：`dist:win` = compile + vite build + electron-builder

---

## 2) electron-builder 配置（build 字段）

```json
{
  "build": {
    "appId": "com.warehouse.app",
    "productName": "仓库管理",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "dist/**/*",
      "dist-electron/**/*",
      "package.json",
      "node_modules/**/*",
      "!**/node_modules/*/{CHANGELOG.md,README.md,...}",
      // ... 其他排除规则
    ],
    "asar": true,
    "extraResources": [
      {
        "from": "server",
        "to": "server",
        "filter": ["**/*", "!**/*.js"]
      },
      {
        "from": "package.json",
        "to": "package.json"
      }
    ],
    "asarUnpack": [
      "**/better-sqlite3/**/*",
      "**/server/**/*"
    ],
    "win": {
      "target": [{"target": "nsis", "arch": ["x64"]}],
      "icon": "public/icon.ico",
      "requestedExecutionLevel": "asInvoker",
      "publisherName": "仓库管理系统"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "allowElevation": true,
      "createDesktopShortcut": "always",
      "createStartMenuShortcut": true,
      "shortcutName": "仓库管理",
      "include": "build/installer.nsh",
      "installerLanguages": ["zh_CN"],
      "language": "2052",
      "artifactName": "${productName}-${version}-Setup.${ext}"
    }
  }
}
```

**关键发现**：
- ✅ **asar 已启用**：`"asar": true`
- ✅ **better-sqlite3 已解包**：`"**/better-sqlite3/**/*"` 在 asarUnpack
- ⚠️ **server 目录处理**：
  - `extraResources` 复制 server（但过滤掉 `**/*.js`，只保留 TS？）
  - `asarUnpack` 解包 `**/server/**/*`（但 server 目录是 TS 源文件，不是编译产物）
- ❌ **files 未包含 server/dist**：没有明确包含编译后的 `server/dist/**/*`
- ✅ **NSIS 配置基本完整**：允许选择目录、创建快捷方式

---

## 3) server 启动入口（main process 如何启动 server）

**文件**：`electron/main.ts`

**关键代码片段**：
```typescript
// 启动后端服务（使用 tsx 直接运行 TS）
function startBackendServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    let serverEntry: string;
    let serverCwd: string;
    const tsxDir = path.dirname(require.resolve('tsx/package.json'));
    const tsxCli = path.join(tsxDir, 'dist/cli.mjs');

    if (isDev) {
      serverEntry = path.join(__dirname, '../../server/index.ts');
      serverCwd = path.join(__dirname, '../..');
    } else {
      const resourcesPath = process.resourcesPath || app.getAppPath();
      serverEntry = path.join(resourcesPath, 'server', 'index.ts');
      serverCwd = resourcesPath;
    }

    backendProcess = spawn(process.execPath, [tsxCli, serverEntry], {
      env,
      cwd: serverCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 健康检查：轮询 /api/health
    const checkHealth = async (): Promise<void> => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/health`);
        if (response.ok) {
          resolve();
        } else {
          setTimeout(checkHealth, 500);
        }
      } catch (e) {
        setTimeout(checkHealth, 500);
      }
    };

    // 超时：30 秒
    setTimeout(() => {
      if (backendProcess && backendProcess.pid) {
        reject(new Error('后端服务启动超时'));
      }
    }, 30000);

    setTimeout(checkHealth, 1000);
  });
}
```

**关键发现**：
- ❌ **生产环境仍使用 tsx**：`spawn(process.execPath, [tsxCli, serverEntry])`
- ✅ **监听地址已固定**：`BACKEND_URL = http://127.0.0.1:41731`
- ✅ **有健康检查**：轮询 `/api/health`
- ✅ **有超时机制**：30 秒超时
- ✅ **日志重定向**：stdout/stderr 写入日志文件
- ⚠️ **超时逻辑有问题**：`setTimeout` 不会自动 reject，需要改进

---

## 4) server 目录结构

**入口文件**：`server/index.ts`

**目录结构**（根据 glob 搜索结果）：
```
server/
├── index.ts              # 主入口（Fastify 服务器）
├── index-v2.ts          # v2 版本（备用？）
├── migrate-to-v2.ts      # 迁移脚本
├── db.ts                # 旧数据库连接（暂时保留用于报表）
├── model/               # 统一数据模型层
│   ├── index.ts
│   ├── db.ts            # 统一数据库连接（使用 better-sqlite3）
│   ├── categories.ts
│   ├── items.ts
│   ├── docs.ts
│   ├── doc_lines.ts
│   ├── stocks.ts
│   ├── stock_moves.ts
│   └── operators.ts
```

**关键发现**：
- ✅ **server/index.ts 是主入口**：Fastify 服务器，监听 `127.0.0.1:41731`
- ✅ **已有统一数据模型层**：`server/model/*` 使用 better-sqlite3
- ❌ **没有 server/tsconfig.build.json**：缺少后端专用编译配置
- ❌ **没有 server/dist 目录**：没有编译产物

---

## 5) better-sqlite3 的依赖位置

**package.json**：
```json
{
  "dependencies": {
    "better-sqlite3": "^11.5.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11"
  }
}
```

**关键发现**：
- ✅ **better-sqlite3 在 dependencies**：正确位置
- ✅ **类型定义在 devDependencies**：正确
- ❌ **没有 electron-rebuild 相关工具**：缺少 `electron-rebuild` 或 `@electron/rebuild`
- ❌ **没有 postinstall 脚本**：没有自动 rebuild native 模块

---

## 6) 数据库路径配置

**文件**：`server/model/db.ts`

**当前实现**：
```typescript
function getDbPath(): string {
  const userDataDir = path.join(os.homedir(), '.warehouse-app');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'warehouse.db');
}
```

**关键发现**：
- ❌ **路径不符合要求**：当前使用 `~/.warehouse-app/warehouse.db`
- ❌ **应该使用 %APPDATA%**：Windows 应使用 `%APPDATA%\warehouse-app\warehouse.db`
- ⚠️ **需要跨平台处理**：Windows 用 `app.getPath('userData')`，Linux/Mac 用 `~/.warehouse-app`

---

## 总结：需要改造的关键点

1. ❌ **后端编译**：需要创建 `server/tsconfig.build.json` 和 `server:build` 脚本
2. ❌ **Electron 启动逻辑**：从 `tsx server/index.ts` 改为 `node server/dist/index.js`
3. ❌ **electron-rebuild**：需要安装并配置 rebuild better-sqlite3
4. ❌ **asarUnpack 配置**：需要包含 `server/dist/**/*` 而不是 `server/**/*`
5. ❌ **数据库路径**：需要改为 `%APPDATA%\warehouse-app\warehouse.db`
6. ⚠️ **超时逻辑**：需要改进健康检查的超时处理

---

**下一步**：开始执行 STEP 1 - STEP 7 的改造
