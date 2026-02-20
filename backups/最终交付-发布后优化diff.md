# 最终交付 - 发布后优化 diff

> 生成时间：2026-02-20

---

## 📋 修改文件列表

1. `package.json` - tsx 移到 devDependencies
2. `electron/main.ts` - 添加后端异常退出提示

---

## 🔧 关键文件 diff

### 1. package.json - tsx 位置优化

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
    "electron": "27.3.11",
    "exceljs": "^4.4.0",
    "fastify": "^4.29.1",
    "html2canvas": "^1.4.1",
    "jspdf": "^4.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-resizable": "^3.1.3",
    "react-router-dom": "^6.28.0",
-   "tsx": "^4.21.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
+   "tsx": "^4.21.0",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/react-resizable": "^3.0.8",
    "@vitejs/plugin-react": "^4.3.3",
    "concurrently": "^9.0.1",
    "electron-builder": "^25.1.8",
    "electron-rebuild": "^3.2.9",
    "rimraf": "^5.0.5",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "wait-on": "^8.0.1"
  }
```

---

### 2. electron/main.ts - 后端异常退出提示

**导入 dialog**：
```diff
- import { app, BrowserWindow } from 'electron';
+ import { app, BrowserWindow, dialog } from 'electron';
```

**添加启动完成标记**：
```diff
    let healthCheckStarted = false;
    let timeoutId: NodeJS.Timeout | null = null;
+   let isStartupComplete = false; // 标记启动是否完成
```

**健康检查成功后标记启动完成**：
```diff
            console.log(`[Electron] 后端服务已就绪: ${actualBackendURL}`);
            logStream.write(`[INFO] 健康检查通过: ${actualBackendURL}/api/health\n`);
-           logStream.end();
            if (timeoutId) clearTimeout(timeoutId);
+           timeoutId = null; // 清除 timeoutId，标记启动完成
+           isStartupComplete = true;
            resolve();
            return;
```

**exit 事件处理增强**：
```diff
    backendProcess.on('exit', (code: number) => {
-     console.log(`[Electron] 后端服务退出，代码: ${code}`);
-     logStream.write(`[EXIT] 代码: ${code}\n`);
-     logStream.end();
-     backendProcess = null;
-     if (timeoutId) clearTimeout(timeoutId);
-     if (code !== 0 && code !== null) {
-       reject(new Error(`后端服务异常退出，代码: ${code}`));
-     }
+     const isStartupPhase = !isStartupComplete;
+     console.log(`[Electron] 后端服务退出，代码: ${code}`);
+     logStream.write(`[EXIT] 代码: ${code}\n`);
+     logStream.write(`[EXIT] 退出时间: ${new Date().toISOString()}\n`);
+     
+     if (isStartupPhase) {
+       // 启动阶段的退出处理
+       logStream.end();
+       if (timeoutId) clearTimeout(timeoutId);
+       backendProcess = null;
+       if (code !== 0 && code !== null) {
+         reject(new Error(`后端服务异常退出，代码: ${code}`));
+       }
+     } else {
+       // 运行期间的退出处理（后端崩溃）
+       logStream.write(`[ERROR] 后端进程在运行期间异常退出\n`);
+       logStream.end();
+       backendProcess = null;
+       
+       // 只有非正常退出（code !== 0）且窗口存在时才显示错误提示
+       if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
+         const currentLogPath = getLogPath();
+         console.error(`[Electron] 后端进程异常退出，退出码: ${code}`);
+         
+         // 写入错误日志
+         const errorLogStream = fs.createWriteStream(currentLogPath, { flags: 'a' });
+         errorLogStream.write(`[ERROR] 后端进程异常退出，退出码: ${code}\n`);
+         errorLogStream.write(`[ERROR] 退出时间: ${new Date().toISOString()}\n`);
+         errorLogStream.end();
+         
+         // 显示错误提示
+         dialog.showErrorBox(
+           '后端服务异常退出',
+           `后端服务意外关闭，请重启应用。\n\n退出码: ${code}\n\n请查看日志文件获取详细信息：\n${currentLogPath}`
+         );
+       }
+     }
    });
```

---

## ✅ 验证步骤总结

### 优化 1 验证：tsx 移到 devDependencies

```powershell
# 重新安装依赖
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install

# 验证 tsx 位置
npm list tsx --depth=0
# 预期：tsx@4.21.0（在 devDependencies）

# 执行构建
npm run dist:win

# 检查安装包体积
Get-Item "dist\仓库管理-1.0.0-Setup.exe" | Select-Object Length
# 预期：体积略有减小（5-10MB）
```

### 优化 2 验证：后端异常退出提示

```powershell
# 1. 安装并启动应用
# 2. 查找后端进程 PID
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Select-Object Id, ProcessName

# 3. 终止后端进程（替换 <PID> 为实际 PID）
Stop-Process -Id <PID> -Force

# 4. 验证错误提示弹出
# 预期：弹出错误对话框，显示退出码和日志路径

# 5. 检查日志
Get-Content "$env:APPDATA\warehouse-app\logs\app-*.log" -Tail 10
# 预期：日志中包含 [ERROR] 后端进程异常退出
```

---

## 📦 最终输出

**安装包位置**：
```
dist\仓库管理-1.0.0-Setup.exe
```

**预期改进**：
- ✅ 安装包体积减小（tsx 不再打包）
- ✅ 后端崩溃时用户有明确提示
- ✅ 日志记录更完善

---

**所有优化已完成！** ✅
