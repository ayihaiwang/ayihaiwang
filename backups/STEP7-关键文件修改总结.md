# STEP 7: 关键文件修改总结

> 生成时间：2026-02-20  
> 目标：展示所有关键文件的修改 diff

---

## 1. package.json - scripts 和 build 配置

### 新增脚本

```json
{
  "scripts": {
    // 新增后端编译脚本
    "server:build": "tsc -p server/tsconfig.build.json",
    "server:clean": "rimraf server/dist",
    
    // 新增 native 模块重建脚本
    "rebuild:native": "electron-rebuild -f -w better-sqlite3",
    
    // 新增 postinstall 钩子
    "postinstall": "electron-builder install-app-deps",
    
    // 修改构建脚本，加入后端编译步骤
    "build": "npm run compile && npm run server:build && vite build && electron-builder",
    "build:win": "npm run compile && npm run server:build && vite build && electron-builder --win",
    "dist:win": "npm run compile && npm run server:build && electron-builder --win --publish never"
  }
}
```

### 新增依赖

```json
{
  "devDependencies": {
    "electron-rebuild": "^3.2.9",  // 新增
    "rimraf": "^5.0.5"              // 新增
  }
}
```

### electron-builder 配置修改

**files 字段**：
```json
{
  "files": [
    "dist/**/*",
    "dist-electron/**/*",
    "server/dist/**/*",              // 新增：包含后端编译产物
    "package.json",
    "node_modules/**/*",
    // ... 其他规则
    "!server/**/*.ts",               // 新增：排除 TS 源文件
    "!server/**/*.ts.map"             // 新增：排除 source map
  ]
}
```

**extraResources 字段**：
```json
{
  "extraResources": [
    {
      "from": "server/dist",         // 修改：从 server 改为 server/dist
      "to": "server/dist"
    },
    {
      "from": "package.json",
      "to": "package.json"
    }
  ]
}
```

**asarUnpack 字段**：
```json
{
  "asarUnpack": [
    "**/better-sqlite3/**/*",
    "**/server/dist/**/*",            // 修改：从 **/server/**/* 改为 **/server/dist/**/*
    "**/*.node"                       // 新增：保险起见，解包所有 .node 文件
  ]
}
```

---

## 2. server/tsconfig.build.json - 新增文件

**完整内容**：
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "sourceMap": true,
    "declaration": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

**关键配置**：
- `target: ES2020` - 目标 ES2020
- `module: CommonJS` - 使用 CommonJS（可直接 node 运行）
- `outDir: ./dist` - 输出到 `server/dist`
- `sourceMap: true` - 生成 source map（方便调试）

---

## 3. electron/main.ts - 启动后端逻辑修改

### 修改前（使用 tsx）

```typescript
// 启动后端服务（使用 tsx 直接运行 TS）
function startBackendServer(): Promise<void> {
  const tsxDir = path.dirname(require.resolve('tsx/package.json'));
  const tsxCli = path.join(tsxDir, 'dist/cli.mjs');
  
  if (isDev) {
    serverEntry = path.join(__dirname, '../../server/index.ts');
  } else {
    serverEntry = path.join(resourcesPath, 'server', 'index.ts');
  }
  
  backendProcess = spawn(process.execPath, [tsxCli, serverEntry], {
    env,
    cwd: serverCwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  // 超时：30 秒
  setTimeout(() => {
    if (backendProcess && backendProcess.pid) {
      reject(new Error('后端服务启动超时'));
    }
  }, 30000);
}
```

### 修改后（运行编译后的 JS）

```typescript
// 启动后端服务（生产环境运行编译后的 JS，开发环境仍可用 tsx）
function startBackendServer(): Promise<void> {
  if (isDev) {
    // 开发环境：使用 tsx 运行 TS（方便调试）
    const tsxDir = path.dirname(require.resolve('tsx/package.json'));
    const tsxCli = path.join(tsxDir, 'dist/cli.mjs');
    serverEntry = path.join(__dirname, '../../server/index.ts');
    serverArgs = [tsxCli, serverEntry];
  } else {
    // 生产环境：运行编译后的 JS
    const resourcesPath = process.resourcesPath || app.getAppPath();
    const serverDistPath = path.join(resourcesPath, 'server', 'dist', 'index.js');
    const serverDistPathUnpacked = path.join(app.getAppPath(), 'server', 'dist', 'index.js');
    
    if (fs.existsSync(serverDistPath)) {
      serverEntry = serverDistPath;
      serverCwd = path.join(resourcesPath, 'server');
    } else if (fs.existsSync(serverDistPathUnpacked)) {
      serverEntry = serverDistPathUnpacked;
      serverCwd = path.join(app.getAppPath(), 'server');
    } else {
      reject(new Error(`后端编译产物未找到`));
      return;
    }
    serverArgs = [serverEntry];
  }
  
  backendProcess = spawn(process.execPath, serverArgs, {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.PORT || '41731',
    },
    cwd: serverCwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  // 超时：15 秒（改进）
  timeoutId = setTimeout(() => {
    if (backendProcess && backendProcess.pid) {
      const errorMsg = `后端服务启动超时（15秒），请检查日志: ${logPath}`;
      logStream.write(`[ERROR] ${errorMsg}\n`);
      logStream.end();
      reject(new Error(errorMsg));
    }
  }, 15000);
}
```

**关键改进**：
1. ✅ **生产环境运行 JS**：不再依赖 tsx
2. ✅ **路径查找**：优先从 extraResources 找，其次从 asarUnpack 位置找
3. ✅ **超时改进**：15 秒超时，并记录日志路径
4. ✅ **环境变量**：明确设置 PORT

---

## 4. server/index.ts - 端口监听改进

### 修改前

```typescript
const start = async () => {
  try {
    await fastify.listen({ port: 41731, host: '127.0.0.1' });
    console.log('🚀 Server running at http://127.0.0.1:41731');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
```

### 修改后

```typescript
const start = async () => {
  try {
    // 从环境变量读取端口，默认 41731
    const port = parseInt(process.env.PORT || '41731', 10);
    const host = '127.0.0.1'; // 固定监听本地，避免防火墙弹窗
    
    try {
      await fastify.listen({ port, host });
      console.log(`🚀 Server running at http://${host}:${port}`);
    } catch (listenErr: any) {
      // 端口占用时尝试其他端口
      if (listenErr.code === 'EADDRINUSE') {
        fastify.log.warn(`端口 ${port} 被占用，尝试其他端口...`);
        // 尝试从 41732 到 41740
        for (let tryPort = port + 1; tryPort <= port + 10; tryPort++) {
          try {
            await fastify.listen({ port: tryPort, host });
            console.log(`🚀 Server running at http://${host}:${tryPort}`);
            return;
          } catch (retryErr: any) {
            if (retryErr.code !== 'EADDRINUSE') {
              throw retryErr;
            }
          }
        }
        throw new Error(`无法找到可用端口（尝试了 ${port}-${port + 10}）`);
      } else {
        throw listenErr;
      }
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
```

**关键改进**：
1. ✅ **环境变量支持**：从 `process.env.PORT` 读取端口
2. ✅ **端口占用处理**：自动尝试其他端口（41732-41740）
3. ✅ **固定监听 127.0.0.1**：避免防火墙弹窗

---

## 5. server/model/db.ts - 数据库路径修改

### 修改前

```typescript
function getDbPath(): string {
  const userDataDir = path.join(os.homedir(), '.warehouse-app');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'warehouse.db');
}
```

### 修改后

```typescript
function getDbPath(): string {
  // Windows: 使用 APPDATA，其他平台使用 home directory
  const userDataDir = process.platform === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Roaming', 'warehouse-app')
    : path.join(os.homedir(), '.warehouse-app');
  
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'warehouse.db');
}
```

**关键改进**：
1. ✅ **Windows 路径**：使用 `%APPDATA%\warehouse-app\warehouse.db`
2. ✅ **跨平台支持**：Linux/Mac 仍使用 `~/.warehouse-app/warehouse.db`

---

## 6. build/installer.nsh - NSIS 脚本增强

### 修改前

```nsis
; 卸载时保留用户数据（可选）
Function un.onInit
  MessageBox MB_YESNO|MB_ICONQUESTION "确定要卸载仓库管理系统吗？$\r$\n$\r$\n注意：卸载不会删除您的数据文件（数据库、日志等）。" IDYES uninstall_confirm
  Abort
  
  uninstall_confirm:
FunctionEnd
```

### 修改后

```nsis
; 卸载时保留用户数据
Function un.onInit
  MessageBox MB_YESNO|MB_ICONQUESTION "确定要卸载仓库管理系统吗？$\r$\n$\r$\n注意：卸载不会删除您的数据文件（数据库、日志等）。$\r$\n数据保存在：%APPDATA%\warehouse-app\" IDYES uninstall_confirm
  Abort
  
  uninstall_confirm:
FunctionEnd

; 卸载时不删除用户数据目录
Function un.onUninstSuccess
  ; 用户数据目录 %APPDATA%\warehouse-app\ 不会被删除
  ; 这是 Electron app.getPath('userData') 的默认位置
FunctionEnd
```

**关键改进**：
1. ✅ **明确数据路径**：提示用户数据保存在 `%APPDATA%\warehouse-app\`
2. ✅ **卸载确认**：明确说明不会删除用户数据

---

## 7. 新增文件

### build-scripts/一键构建-Windows.bat

完整的 Windows 构建脚本，包含所有步骤：
1. 安装依赖
2. 编译后端
3. 重建 native 模块
4. 编译 Electron
5. 构建前端
6. 构建安装包

### build-scripts/一键构建命令.md

详细的构建文档，包含：
- PowerShell 命令
- 验证步骤
- 故障排查

---

## 总结：所有修改点

| 文件 | 修改类型 | 关键变更 |
|------|----------|----------|
| `package.json` | 修改 | 新增脚本、依赖、优化 build 配置 |
| `server/tsconfig.build.json` | 新增 | 后端编译配置 |
| `electron/main.ts` | 修改 | 生产环境运行 JS，改进超时和错误处理 |
| `server/index.ts` | 修改 | 端口环境变量支持，端口占用自动切换 |
| `server/model/db.ts` | 修改 | Windows 使用 %APPDATA% |
| `build/installer.nsh` | 修改 | 卸载时保留用户数据提示 |
| `build-scripts/一键构建-Windows.bat` | 新增 | 一键构建脚本 |
| `build-scripts/一键构建命令.md` | 新增 | 构建文档 |

---

**所有改造已完成！** ✅
