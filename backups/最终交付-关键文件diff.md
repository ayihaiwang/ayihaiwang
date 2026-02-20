# 最终交付 - 关键文件 diff

> 生成时间：2026-02-20

---

## 1. package.json - scripts 和 build 配置

### scripts 部分 diff

```diff
  "scripts": {
    "server:build": "tsc -p server/tsconfig.build.json",
    "server:clean": "rimraf server/dist",
    "rebuild:native": "electron-rebuild -f -w better-sqlite3",
    "postinstall": "electron-builder install-app-deps",
+   "predist:win": "npm run rebuild:native"
  }
```

### build.asarUnpack 部分（已确认）

```json
"asarUnpack": [
  "**/better-sqlite3/**/*",
  "**/server/dist/**/*",
  "**/*.node"
]
```

---

## 2. electron/main.ts - 主进程启动 server 关键 diff

### 新增变量

```diff
- const BACKEND_PORT = 41731;
- const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
+ let actualBackendPort: number = BACKEND_PORT;
+ let actualBackendURL: string = `http://127.0.0.1:${BACKEND_PORT}`;
```

### 环境变量设置（用户数据目录）

```diff
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.PORT || '41731',
+     WAREHOUSE_USER_DATA: dbDir, // 由 app.getPath('userData') 计算
    };
```

### 端口解析逻辑

```diff
    backendProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log('[Backend]', msg);
      logStream.write(`[STDOUT] ${msg}`);
      
-     // 检测端口信息
-     if (msg.includes('Server running at') || msg.includes('listening')) {
-       const portMatch = msg.match(/127\.0\.0\.1[:\s]+(\d+)/);
-       if (portMatch) {
-         logStream.write(`[INFO] 检测到监听端口: ${portMatch[1]}\n`);
-       }
-     }
+     // 检测端口信息并更新实际端口（优先解析 LISTENING:PORT= 格式）
+     const portMatch = msg.match(/LISTENING:PORT=(\d+)/);
+     if (portMatch) {
+       const detectedPort = parseInt(portMatch[1], 10);
+       if (detectedPort !== actualBackendPort) {
+         actualBackendPort = detectedPort;
+         actualBackendURL = `http://127.0.0.1:${actualBackendPort}`;
+         console.log(`[Electron] 检测到后端实际端口: ${actualBackendPort}`);
+         logStream.write(`[INFO] 后端实际监听端口: ${actualBackendPort}\n`);
+         logStream.write(`[INFO] 后端URL: ${actualBackendURL}\n`);
+       }
+     }
    });
```

### 健康检查改进（多端口轮询）

```diff
-   const checkHealth = async (): Promise<void> => {
-     try {
-       const response = await fetch(`${BACKEND_URL}/api/health`);
-       if (response.ok) {
-         resolve();
-       } else {
-         setTimeout(checkHealth, 500);
-       }
-     } catch (e) {
-       setTimeout(checkHealth, 500);
-     }
-   };
+   const checkHealth = async (): Promise<void> => {
+     const portsToTry = actualBackendPort !== BACKEND_PORT 
+       ? [actualBackendPort] 
+       : [BACKEND_PORT, 41732, 41733, 41734, 41735, 41736, 41737, 41738, 41739, 41740];
+     
+     for (const port of portsToTry) {
+       try {
+         const testUrl = `http://127.0.0.1:${port}/api/health`;
+         const response = await fetch(testUrl);
+         if (response.ok) {
+           if (port !== actualBackendPort) {
+             actualBackendPort = port;
+             actualBackendURL = `http://127.0.0.1:${actualBackendPort}`;
+           }
+           resolve();
+           return;
+         }
+       } catch (e) {
+         continue;
+       }
+     }
+     setTimeout(checkHealth, 500);
+   };
```

### loadURL 使用实际端口

```diff
  } else {
-   mainWindow.loadURL(BACKEND_URL);
+   mainWindow.loadURL(actualBackendURL);
+   console.log(`[Electron] 加载URL: ${actualBackendURL}`);
  }
```

---

## 3. server/index.ts - 端口输出格式

```diff
      await fastify.listen({ port, host });
      console.log(`🚀 Server running at http://${host}:${port}`);
+     console.log(`LISTENING:PORT=${port}`);
```

---

## 4. server/model/db.ts - 数据库路径

```diff
  function getDbPath(): string {
-   const userDataDir = process.platform === 'win32'
-     ? path.join(os.homedir(), 'AppData', 'Roaming', 'warehouse-app')
-     : path.join(os.homedir(), '.warehouse-app');
+   // 优先使用环境变量（由 Electron 主进程通过 app.getPath('userData') 设置）
+   let userDataDir: string;
+   
+   if (process.env.WAREHOUSE_USER_DATA) {
+     userDataDir = process.env.WAREHOUSE_USER_DATA;
+   } else {
+     // 备用方案：使用平台默认路径
+     userDataDir = process.platform === 'win32'
+       ? path.join(os.homedir(), 'AppData', 'Roaming', 'warehouse-app')
+       : path.join(os.homedir(), '.warehouse-app');
+   }
   
    return path.join(userDataDir, 'warehouse.db');
  }
```

---

## 5. build-scripts/一键构建-Windows.bat

```diff
  REM Step 3: Rebuild native modules
  echo [Step 3/6] Rebuild native modules (better-sqlite3)...
  echo.
  call npm run rebuild:native
- if errorlevel 1 (
-     echo [WARNING] Native module rebuild failed, but continuing...
-     echo [INFO] This may cause issues if better-sqlite3 is not properly rebuilt
- )
+ if errorlevel 1 (
+     echo [ERROR] Native module rebuild failed
+     echo [ERROR] This will cause MODULE_NOT_FOUND errors in production
+     pause
+     exit /b 1
+ )
  echo [OK] Native modules rebuilt
```

---

## 总结

所有关键修改已完成：
1. ✅ 一键构建命令格式修复（A/B/C三段）
2. ✅ electron-rebuild 顺序保证（predist:win 钩子）
3. ✅ 端口自动切换与前端联动（解析端口 + 多端口轮询）
4. ✅ 数据库路径使用 app.getPath（环境变量传递）
5. ✅ asarUnpack 配置确认（包含 **/*.node）
