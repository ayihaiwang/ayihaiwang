import { app, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

const isDev = process.env.NODE_ENV !== 'production' || process.argv.includes('--dev');

// 后端服务进程
let backendProcess: ChildProcess | null = null;
const BACKEND_PORT = 41731;
let actualBackendPort: number = BACKEND_PORT; // 实际监听的端口（可能因端口占用而改变）
let actualBackendURL: string = `http://127.0.0.1:${BACKEND_PORT}`;

// 日志文件路径（使用 app.getPath('appData')）
function getLogPath(): string {
  const baseDir = path.join(app.getPath('appData'), 'warehouse-app');
  const logDir = path.join(baseDir, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, `app-${new Date().toISOString().slice(0, 10)}.log`);
}

// 启动后端服务（生产环境运行编译后的 JS，开发环境仍可用 tsx）
function startBackendServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    let serverEntry: string;
    let serverCwd: string;
    let serverArgs: string[];

    if (isDev) {
      // 开发环境：使用 tsx 运行 TS（方便调试）
      const tsxDir = path.dirname(require.resolve('tsx/package.json'));
      const tsxCli = path.join(tsxDir, 'dist/cli.mjs');
      serverEntry = path.join(__dirname, '../../server/index.ts');
      serverCwd = path.join(__dirname, '../..');
      serverArgs = [tsxCli, serverEntry];
    } else {
      // 生产环境：运行编译后的 JS
      const resourcesPath = process.resourcesPath || app.getAppPath();
      // 优先从 extraResources 找，否则从 asar 解包位置找
      const serverDistPath = path.join(resourcesPath, 'server', 'dist', 'index.js');
      const serverDistPathUnpacked = path.join(app.getAppPath(), 'server', 'dist', 'index.js');
      
      if (fs.existsSync(serverDistPath)) {
        serverEntry = serverDistPath;
        serverCwd = path.join(resourcesPath, 'server');
      } else if (fs.existsSync(serverDistPathUnpacked)) {
        serverEntry = serverDistPathUnpacked;
        serverCwd = path.join(app.getAppPath(), 'server');
      } else {
        reject(new Error(`后端编译产物未找到: ${serverDistPath} 或 ${serverDistPathUnpacked}`));
        return;
      }
      serverArgs = [serverEntry];
    }

    console.log('[Electron] 启动后端服务:', serverEntry);
    console.log('[Electron] 工作目录:', serverCwd);

    // 计算用户数据目录（使用 Electron app.getPath('appData')）
    const baseDir = path.join(app.getPath('appData'), 'warehouse-app');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: process.env.PORT || '41731',
      // 传递用户数据目录给后端
      WAREHOUSE_USER_DATA: baseDir,
    };
    
    const logPath = getLogPath();
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    
    console.log(`[Electron] 用户数据目录: ${baseDir}`);
    logStream.write(`[INFO] 用户数据目录: ${baseDir}\n`);

    backendProcess = spawn(process.execPath, serverArgs, {
      env,
      cwd: serverCwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    logStream.write(`\n=== 启动后端服务 ${new Date().toISOString()} ===\n`);
    logStream.write(`[INFO] 服务入口: ${serverEntry}\n`);
    logStream.write(`[INFO] 工作目录: ${serverCwd}\n`);

    let healthCheckStarted = false;
    let timeoutId: NodeJS.Timeout | null = null;
    let isStartupComplete = false; // 标记启动是否完成

    backendProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.log('[Backend]', msg);
      logStream.write(`[STDOUT] ${msg}`);
      
      // 检测端口信息并更新实际端口（优先解析 LISTENING:PORT= 格式）
      const portMatch = msg.match(/LISTENING:PORT=(\d+)/);
      if (portMatch) {
        const detectedPort = parseInt(portMatch[1], 10);
        if (detectedPort !== actualBackendPort) {
          actualBackendPort = detectedPort;
          actualBackendURL = `http://127.0.0.1:${actualBackendPort}`;
          console.log(`[Electron] 检测到后端实际端口: ${actualBackendPort}`);
          logStream.write(`[INFO] 后端实际监听端口: ${actualBackendPort}\n`);
          logStream.write(`[INFO] 后端URL: ${actualBackendURL}\n`);
        }
      } else if (msg.includes('Server running at') || msg.includes('listening')) {
        // 备用解析方式
        const altPortMatch = msg.match(/127\.0\.0\.1[:\s]+(\d+)/);
        if (altPortMatch) {
          const detectedPort = parseInt(altPortMatch[1], 10);
          if (detectedPort !== actualBackendPort) {
            actualBackendPort = detectedPort;
            actualBackendURL = `http://127.0.0.1:${actualBackendPort}`;
            console.log(`[Electron] 检测到后端实际端口: ${actualBackendPort}`);
            logStream.write(`[INFO] 后端实际监听端口: ${actualBackendPort}\n`);
            logStream.write(`[INFO] 后端URL: ${actualBackendURL}\n`);
          }
        }
      }
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString();
      console.error('[Backend]', msg);
      logStream.write(`[STDERR] ${msg}`);
    });

    backendProcess.on('error', (err: Error) => {
      console.error('[Electron] 后端服务启动失败:', err);
      logStream.write(`[ERROR] ${err.message}\n`);
      logStream.end();
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });

    backendProcess.on('exit', (code: number) => {
      const isStartupPhase = !isStartupComplete;
      console.log(`[Electron] 后端服务退出，代码: ${code}`);
      logStream.write(`[EXIT] 代码: ${code}\n`);
      logStream.write(`[EXIT] 退出时间: ${new Date().toISOString()}\n`);
      
      if (isStartupPhase) {
        // 启动阶段的退出处理
        logStream.end();
        if (timeoutId) clearTimeout(timeoutId);
        backendProcess = null;
        if (code !== 0 && code !== null) {
          reject(new Error(`后端服务异常退出，代码: ${code}`));
        }
      } else {
        // 运行期间的退出处理（后端崩溃）
        logStream.write(`[ERROR] 后端进程在运行期间异常退出\n`);
        logStream.end();
        backendProcess = null;
        
        // 只有非正常退出（code !== 0）且窗口存在时才显示错误提示
        if (code !== 0 && code !== null && mainWindow && !mainWindow.isDestroyed()) {
          const currentLogPath = getLogPath();
          console.error(`[Electron] 后端进程异常退出，退出码: ${code}`);
          
          // 写入错误日志
          const errorLogStream = fs.createWriteStream(currentLogPath, { flags: 'a' });
          errorLogStream.write(`[ERROR] 后端进程异常退出，退出码: ${code}\n`);
          errorLogStream.write(`[ERROR] 退出时间: ${new Date().toISOString()}\n`);
          errorLogStream.end();
          
          // 显示错误提示
          dialog.showErrorBox(
            '后端服务异常退出',
            `后端服务意外关闭，请重启应用。\n\n退出码: ${code}\n\n请查看日志文件获取详细信息：\n${currentLogPath}`
          );
        }
      }
    });

    // 健康检查函数（支持端口自动切换）
    const checkHealth = async (): Promise<void> => {
      if (!backendProcess || !backendProcess.pid) {
        return;
      }
      
      // 如果端口已更新，使用新端口；否则尝试多个端口
      const portsToTry = actualBackendPort !== BACKEND_PORT 
        ? [actualBackendPort] 
        : [BACKEND_PORT, 41732, 41733, 41734, 41735, 41736, 41737, 41738, 41739, 41740];
      
      for (const port of portsToTry) {
        try {
          const testUrl = `http://127.0.0.1:${port}/api/health`;
          
          // 使用 AbortController 设置超时（1500ms）
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 1500);
          
          const response = await fetch(testUrl, { 
            signal: controller.signal 
          });
          
          clearTimeout(timeout);
          
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
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = null; // 清除 timeoutId，标记启动完成
            isStartupComplete = true;
            resolve();
            return;
          }
        } catch (e: any) {
          // 超时或其他错误，继续尝试下一个端口
          if (e.name === 'AbortError') {
            // 超时，继续下一个端口
            continue;
          }
          // 其他错误（如连接拒绝），也继续下一个端口
          continue;
        }
      }
      
      // 所有端口都失败，继续重试
      setTimeout(checkHealth, 500);
    };

    // 超时处理：15 秒
    timeoutId = setTimeout(() => {
      if (backendProcess && backendProcess.pid) {
        const errorMsg = `后端服务启动超时（15秒），请检查日志: ${logPath}`;
        console.error(`[Electron] ${errorMsg}`);
        logStream.write(`[ERROR] ${errorMsg}\n`);
        logStream.end();
        reject(new Error(errorMsg));
      }
    }, 15000);

    // 延迟 1 秒后开始健康检查
    setTimeout(() => {
      healthCheckStarted = true;
      checkHealth();
    }, 1000);
  });
}

// 停止后端服务
function stopBackendServer() {
  if (backendProcess) {
    console.log('[Electron] 停止后端服务');
    backendProcess.kill('SIGTERM');
    backendProcess = null;
  }
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // icon 路径在生产环境可能不同，使用可选路径
    icon: fs.existsSync(path.join(__dirname, '../public/icon.ico'))
      ? path.join(__dirname, '../public/icon.ico')
      : undefined,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：后端服务提供静态文件和 API（使用实际端口）
    mainWindow.loadURL(actualBackendURL);
    console.log(`[Electron] 加载URL: ${actualBackendURL}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startBackendServer();
    createWindow();
  } catch (err) {
    console.error('[Electron] 启动失败:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

app.on('will-quit', () => {
  stopBackendServer();
});
