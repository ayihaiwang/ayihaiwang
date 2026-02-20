/**
 * 统一数据库连接管理
 * 优先使用环境变量 WAREHOUSE_USER_DATA（由 Electron 主进程设置）
 * 否则使用平台默认路径：
 *   Windows: %APPDATA%\warehouse-app\warehouse.db
 *   Linux/Mac: ~/.warehouse-app/warehouse.db
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

let db: Database.Database | null = null;

function getDbPath(): string {
  // 优先使用环境变量（由 Electron 主进程通过 app.getPath('userData') 设置）
  let userDataDir: string;
  
  if (process.env.WAREHOUSE_USER_DATA) {
    userDataDir = process.env.WAREHOUSE_USER_DATA;
  } else {
    // 备用方案：使用平台默认路径
    userDataDir = process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Roaming', 'warehouse-app')
      : path.join(os.homedir(), '.warehouse-app');
  }
  
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'warehouse.db');
}

export function initDb() {
  const dbPath = getDbPath();
  console.log(`📂 [DB] 数据库路径: ${dbPath}`);
  console.log(`📂 [DB] 数据库文件存在: ${fs.existsSync(dbPath) ? '是' : '否'}`);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  console.log(`✅ [DB] 数据库连接已初始化（可写模式）`);
  return db;
}

export function getDbPathPublic(): string {
  return getDbPath();
}

export function getDb(): Database.Database {
  if (!db) {
    initDb();
  }
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function close() {
  if (db) db.close();
  db = null;
}
