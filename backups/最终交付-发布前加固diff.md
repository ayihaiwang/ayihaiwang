# 最终交付 - 发布前加固 diff

> 生成时间：2026-02-20

---

## 📋 修改文件列表

1. `package.json` - electron 移到 dependencies
2. `electron/main.ts` - 健康检查超时处理 + 路径修复

---

## 🔧 关键文件 diff

### 1. package.json - electron 位置修复

```diff
  "dependencies": {
    "@fastify/cors": "^9.0.1",
    "@fastify/multipart": "^8.3.1",
    "@fastify/static": "^9.0.0",
    "antd": "^5.21.0",
    "better-sqlite3": "^11.5.0",
    "dayjs": "^1.11.13",
    "echarts": "^5.5.0",
    "echarts-for-react": "^3.0.2",
+   "electron": "27.3.11",
    "exceljs": "^4.4.0",
    "fastify": "^4.29.1",
    "html2canvas": "^1.4.1",
    "jspdf": "^4.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-resizable": "^3.1.3",
    "react-router-dom": "^6.28.0",
    "tsx": "^4.21.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/react-resizable": "^3.0.8",
    "@vitejs/plugin-react": "^4.3.3",
    "concurrently": "^9.0.1",
-   "electron": "27.3.11",
    "electron-builder": "^25.1.8",
    "electron-rebuild": "^3.2.9",
    "rimraf": "^5.0.5",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "wait-on": "^8.0.1"
  }
```

---

### 2. electron/main.ts - 健康检查超时处理

```diff
      for (const port of portsToTry) {
        try {
          const testUrl = `http://127.0.0.1:${port}/api/health`;
          
+         // 使用 AbortController 设置超时（1500ms）
+         const controller = new AbortController();
+         const timeout = setTimeout(() => controller.abort(), 1500);
+         
-         const response = await fetch(testUrl);
+         const response = await fetch(testUrl, { 
+           signal: controller.signal 
+         });
+         
+         clearTimeout(timeout);
+         
          if (response.ok) {
            // 找到可用端口，更新全局变量
            if (port !== actualBackendPort) {
              actualBackendPort = port;
              actualBackendURL = `http://127.0.0.1:${actualBackendPort}`;
              console.log(`[Electron] 健康检查发现后端端口: ${actualBackendPort}`);
              logStream.write(`[INFO] 健康检查发现后端端口: ${actualBackendPort}\n`);
              logStream.write(`[INFO] 后端URL: ${actualBackendURL}\n`);
            }
            console.log(`[Electron] 后端服务已就绪: ${actualBackendURL}`);
            logStream.write(`[INFO] 健康检查通过: ${actualBackendURL}/api/health\n`);
            logStream.end();
            if (timeoutId) clearTimeout(timeoutId);
            resolve();
            return;
          }
        } catch (e: any) {
+         // 超时或其他错误，继续尝试下一个端口
+         if (e.name === 'AbortError') {
+           // 超时，继续下一个端口
+           continue;
+         }
          // 其他错误（如连接拒绝），也继续下一个端口
          continue;
        }
      }
```

---

### 3. electron/main.ts - 路径计算修复

**日志路径函数**：
```diff
- // 日志文件路径（使用 app.getPath('userData')）
  function getLogPath(): string {
-   const userData = app.getPath('userData');
-   const logDir = path.join(userData, 'warehouse-app', 'logs');
+   const baseDir = path.join(app.getPath('appData'), 'warehouse-app');
+   const logDir = path.join(baseDir, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    return path.join(logDir, `app-${new Date().toISOString().slice(0, 10)}.log`);
  }
```

**用户数据目录计算**：
```diff
-   // 计算用户数据目录（使用 Electron app.getPath）
-   const userDataDir = app.getPath('userData');
-   const dbDir = path.join(userDataDir, 'warehouse-app');
-   if (!fs.existsSync(dbDir)) {
-     fs.mkdirSync(dbDir, { recursive: true });
-   }
+   // 计算用户数据目录（使用 Electron app.getPath('appData')）
+   const baseDir = path.join(app.getPath('appData'), 'warehouse-app');
+   if (!fs.existsSync(baseDir)) {
+     fs.mkdirSync(baseDir, { recursive: true });
+   }
    
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.PORT || '41731',
-     WAREHOUSE_USER_DATA: dbDir,
+     WAREHOUSE_USER_DATA: baseDir,
    };
    
    const logPath = getLogPath();
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    
-   console.log(`[Electron] 用户数据目录: ${dbDir}`);
-   logStream.write(`[INFO] 用户数据目录: ${dbDir}\n`);
+   console.log(`[Electron] 用户数据目录: ${baseDir}`);
+   logStream.write(`[INFO] 用户数据目录: ${baseDir}\n`);
```

---

## ✅ 验证步骤总结

### FIX A 验证：electron 在 dependencies

```powershell
# 重新安装依赖
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install

# 验证 electron 位置
npm list electron --depth=0
# 预期：electron@27.3.11（在 dependencies）

# 验证 rebuild
npm run rebuild:native
# 预期：无错误，rebuild 成功
```

### FIX B 验证：健康检查超时处理

```powershell
# 占用多个端口（41731-41735）
$listeners = @()
for ($port = 41731; $port -le 41735; $port++) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
    $listener.Start()
    $listeners += $listener
}

# 启动应用
# 预期：窗口正常打开，不卡死

# 验证后端运行在其他端口
for ($port = 41736; $port -le 41740; $port++) {
    $testUrl = "http://127.0.0.1:$port/api/health"
    $testResponse = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -ErrorAction SilentlyContinue
    if ($testResponse) {
        Write-Host "✅ 后端运行在端口 $port"
        break
    }
}

# 释放端口
foreach ($l in $listeners) { $l.Stop() }
```

### FIX C 验证：数据路径正确

```powershell
# 启动应用后检查路径
$dbPath = "$env:APPDATA\warehouse-app\warehouse.db"
Test-Path $dbPath
# 预期：True

Get-Item $dbPath | Select-Object FullName
# 预期：C:\Users\<用户名>\AppData\Roaming\warehouse-app\warehouse.db

$logDir = "$env:APPDATA\warehouse-app\logs"
Test-Path $logDir
# 预期：True

Get-ChildItem $logDir | Select-Object FullName
# 预期：C:\Users\<用户名>\AppData\Roaming\warehouse-app\logs\app-YYYY-MM-DD.log
```

---

## 📦 最终输出

**安装包位置**：
```
dist\仓库管理-1.0.0-Setup.exe
```

---

**所有加固修复已完成！** ✅
