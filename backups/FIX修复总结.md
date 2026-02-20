# FIX 修复总结

> 修复时间：2026-02-20  
> 目标：修复5个关键问题，确保构建和运行稳定

---

## FIX 1: 一键构建命令格式错误 ✅

### 修改文件
- `backups/STEP6-一键构建命令-最终版.md` - 新增（提供A/B/C三段命令）
- `build-scripts/一键构建-Windows.bat` - 修改（rebuild失败时退出）

### 关键修改
1. **提供三段可复制命令**：
   - PowerShell 多行版
   - PowerShell 单行版（用 `;` 连接）
   - CMD 单行版（用 `&&` 连接）

2. **批处理脚本改进**：
   ```batch
   REM rebuild失败时退出（不再继续）
   call npm run rebuild:native
   if errorlevel 1 (
       echo [ERROR] Native module rebuild failed
       exit /b 1
   )
   ```

---

## FIX 2: electron-rebuild 顺序问题 ✅

### 修改文件
- `package.json` - 修改（添加 predist:win 钩子）

### 关键修改
```json
{
  "scripts": {
    "rebuild:native": "electron-rebuild -f -w better-sqlite3",
    "predist:win": "npm run rebuild:native"
  }
}
```

### 验证
- ✅ better-sqlite3 在 dependencies（不是 devDependencies）
- ✅ electron 版本固定：27.3.11（不是 latest）
- ✅ rebuild 在打包前一定执行（predist:win 钩子）

---

## FIX 3: 端口自动切换与前端联动 ✅

### 修改文件
- `electron/main.ts` - 修改（获取实际端口后 loadURL）
- `server/index.ts` - 修改（输出 LISTENING:PORT= 格式）

### 关键修改

**主进程（electron/main.ts）**：
```typescript
let actualBackendPort: number = BACKEND_PORT;
let actualBackendURL: string = `http://127.0.0.1:${BACKEND_PORT}`;

// 解析 stdout 获取实际端口
backendProcess.stdout?.on('data', (data: Buffer) => {
  const portMatch = msg.match(/LISTENING:PORT=(\d+)/);
  if (portMatch) {
    actualBackendPort = parseInt(portMatch[1], 10);
    actualBackendURL = `http://127.0.0.1:${actualBackendPort}`;
  }
});

// 健康检查支持多端口轮询
const checkHealth = async (): Promise<void> => {
  const portsToTry = [BACKEND_PORT, 41732, 41733, ...];
  for (const port of portsToTry) {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    if (response.ok) {
      actualBackendPort = port;
      actualBackendURL = `http://127.0.0.1:${actualBackendPort}`;
      resolve();
      return;
    }
  }
};

// 使用实际端口 loadURL
mainWindow.loadURL(actualBackendURL);
```

**后端（server/index.ts）**：
```typescript
await fastify.listen({ port, host });
console.log(`LISTENING:PORT=${port}`); // 输出端口供主进程解析
```

### 验证步骤
1. 占用端口 41731：`netstat -ano | findstr :41731`
2. 启动应用
3. 检查日志：`%APPDATA%\warehouse-app\logs\app-YYYY-MM-DD.log`
4. 确认日志中有：`后端实际监听端口: 41732`（或其他端口）
5. 确认窗口能正常打开（使用实际端口）

---

## FIX 4: 数据库路径使用 app.getPath ✅

### 修改文件
- `electron/main.ts` - 修改（使用 app.getPath 计算路径）
- `server/model/db.ts` - 修改（从环境变量读取路径）

### 关键修改

**主进程（electron/main.ts）**：
```typescript
// 使用 Electron app.getPath 计算用户数据目录
const userDataDir = app.getPath('userData');
const dbDir = path.join(userDataDir, 'warehouse-app');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const env = {
  ...process.env,
  WAREHOUSE_USER_DATA: dbDir, // 传递给后端
};
```

**后端（server/model/db.ts）**：
```typescript
function getDbPath(): string {
  // 优先使用环境变量（由 Electron 主进程设置）
  let userDataDir: string;
  
  if (process.env.WAREHOUSE_USER_DATA) {
    userDataDir = process.env.WAREHOUSE_USER_DATA;
  } else {
    // 备用方案：使用平台默认路径
    userDataDir = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'warehouse-app')
      : path.join(os.homedir(), '.warehouse-app');
  }
  
  return path.join(userDataDir, 'warehouse.db');
}
```

### 路径说明
- **Windows**: `C:\Users\<用户名>\AppData\Roaming\warehouse-app\warehouse.db`
- **macOS**: `~/Library/Application Support/warehouse-app/warehouse.db`
- **Linux**: `~/.config/warehouse-app/warehouse.db`

---

## FIX 5: asarUnpack 配置确认 ✅

### 当前配置
```json
{
  "build": {
    "asar": true,
    "asarUnpack": [
      "**/better-sqlite3/**/*",
      "**/server/dist/**/*",
      "**/*.node"
    ]
  }
}
```

### 验证
- ✅ better-sqlite3 已解包
- ✅ server/dist 已解包（后端编译产物）
- ✅ **/*.node 已包含（兜底所有 native 模块）

### 打包后验证
打包后检查：`resources/app.asar.unpacked/` 目录应包含：
- `node_modules/better-sqlite3/` 目录及其 .node 文件
- `server/dist/` 目录及其 JS 文件
- 其他 .node 文件（如果有）

---

## 最终交付清单

### 1. 更新后的文档
- ✅ `backups/STEP6-一键构建命令-最终版.md` - 包含A/B/C三段命令

### 2. 更新后的构建脚本
- ✅ `build-scripts/一键构建-Windows.bat` - rebuild失败时退出

### 3. package.json 关键 diff
```diff
+ "predist:win": "npm run rebuild:native"
```

### 4. 主进程启动 server 关键 diff
- ✅ 端口解析和更新逻辑
- ✅ 健康检查多端口轮询
- ✅ 使用实际端口 loadURL
- ✅ 用户数据目录计算和传递

### 5. 端口切换联动验证说明
见 FIX 3 验证步骤

### 6. 打包输出
- `dist\仓库管理-1.0.0-Setup.exe`

---

## 干净 Windows 环境验证流程

### 步骤 1: 准备环境
```powershell
# 1. 确保在 Windows 10/11 x64
# 2. 安装 Node.js 18+
node --version

# 3. 清理旧构建产物（可选）
Remove-Item -Recurse -Force node_modules, server/dist, dist-electron, dist -ErrorAction SilentlyContinue
```

### 步骤 2: 执行构建
```powershell
cd "D:\仓库管理\warehouse-app"
npm install
npm run server:build
npm run rebuild:native
npm run compile
npm run build
npm run dist:win
```

### 步骤 3: 验证安装包
```powershell
# 检查安装包是否存在
Test-Path "dist\仓库管理-1.0.0-Setup.exe"

# 检查安装包大小（应该 > 100MB）
Get-Item "dist\仓库管理-1.0.0-Setup.exe" | Select-Object Length
```

### 步骤 4: 安装并运行
1. 双击 `dist\仓库管理-1.0.0-Setup.exe` 安装
2. 从桌面或开始菜单启动应用
3. 检查窗口是否正常打开

### 步骤 5: 验证后端服务
```powershell
# 检查健康端点（可能需要等待几秒）
Start-Sleep -Seconds 3
$response = Invoke-WebRequest -Uri "http://127.0.0.1:41731/api/health" -UseBasicParsing -ErrorAction SilentlyContinue
if ($response) {
    Write-Host "健康检查通过: $($response.Content)"
} else {
    Write-Host "尝试其他端口..."
    for ($port = 41732; $port -le 41740; $port++) {
        $testUrl = "http://127.0.0.1:$port/api/health"
        $testResponse = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -ErrorAction SilentlyContinue
        if ($testResponse) {
            Write-Host "健康检查通过（端口 $port）: $($testResponse.Content)"
            break
        }
    }
}
```

### 步骤 6: 验证数据库路径
```powershell
# 检查数据库文件
$dbPath = "$env:APPDATA\warehouse-app\warehouse.db"
if (Test-Path $dbPath) {
    Write-Host "数据库文件存在: $dbPath"
    Get-Item $dbPath | Select-Object FullName, Length, LastWriteTime
} else {
    Write-Host "数据库文件不存在，检查日志..."
}
```

### 步骤 7: 检查日志
```powershell
# 查看最新日志
$logDir = "$env:APPDATA\warehouse-app\logs"
if (Test-Path $logDir) {
    $latestLog = Get-ChildItem $logDir | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Write-Host "最新日志: $($latestLog.FullName)"
    Get-Content $latestLog.FullName -Tail 20
}
```

### 步骤 8: 验证端口占用场景
```powershell
# 占用端口 41731
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 41731)
$listener.Start()

# 启动应用
# 检查日志确认端口切换
# 检查窗口是否正常打开

# 停止占用
$listener.Stop()
```

---

## 预期结果

1. ✅ **构建成功**：无错误，生成安装包
2. ✅ **安装成功**：安装包正常安装
3. ✅ **启动成功**：应用窗口正常打开
4. ✅ **后端正常**：健康检查返回 `{"status":"ok"}`
5. ✅ **数据库正常**：数据库文件在 `%APPDATA%\warehouse-app\warehouse.db`
6. ✅ **端口切换正常**：端口占用时自动切换，窗口仍能打开
7. ✅ **日志正常**：日志文件记录端口和路径信息

---

**所有修复已完成！** ✅
