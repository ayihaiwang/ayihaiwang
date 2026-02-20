/**
 * 数据库迁移脚本：从旧表结构迁移到统一 v2 表结构
 * 
 * 执行方式：
 * 1. 备份数据库：cp warehouse.db warehouse.db.bak.{timestamp}
 * 2. 运行迁移：node -r ts-node/register server/migrate-to-v2.ts
 * 
 * 回滚方式：
 * 1. 恢复备份：cp warehouse.db.bak.{timestamp} warehouse.db
 * 2. 删除 v2 表：DROP TABLE IF EXISTS stock_moves_v2, stocks_v2, doc_lines_v2, docs_v2, items_v2, operators_v2, categories;
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';

function getDbPath(): string {
  const userDataDir = path.join(os.homedir(), '.warehouse-app');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  return path.join(userDataDir, 'warehouse.db');
}

function backupDb(dbPath: string): string {
  const timestamp = Date.now();
  const backupPath = dbPath + '.bak.' + timestamp;
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ 数据库已备份到: ${backupPath}`);
  }
  return backupPath;
}

function createV2Tables(db: Database.Database) {
  console.log('📋 创建 v2 表结构...');
  
  db.exec(`
    -- 创建 categories 表（如果不存在）
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 创建 items_v2
    CREATE TABLE IF NOT EXISTS items_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      spec_default TEXT,
      unit_default TEXT NOT NULL,
      min_stock INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 创建 operators_v2
    CREATE TABLE IF NOT EXISTS operators_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 创建 docs_v2
    CREATE TABLE IF NOT EXISTS docs_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('claim','inbound','outbound')),
      doc_no TEXT NOT NULL,
      biz_date TEXT NOT NULL,
      company_name TEXT,
      requester TEXT,
      operator TEXT,
      status TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(doc_no, doc_type)
    );
    CREATE INDEX IF NOT EXISTS idx_docs_v2_type_date ON docs_v2(doc_type, biz_date);
    CREATE INDEX IF NOT EXISTS idx_docs_v2_doc_no ON docs_v2(doc_no);

    -- 创建 doc_lines_v2
    CREATE TABLE IF NOT EXISTS doc_lines_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id INTEGER NOT NULL REFERENCES docs_v2(id),
      item_id INTEGER NOT NULL REFERENCES items_v2(id),
      item_name TEXT,
      spec TEXT,
      qty INTEGER NOT NULL,
      unit TEXT NOT NULL,
      remark TEXT,
      category_id INTEGER REFERENCES categories(id),
      sort_no INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_doc_lines_v2_doc ON doc_lines_v2(doc_id);
    CREATE INDEX IF NOT EXISTS idx_doc_lines_v2_item ON doc_lines_v2(item_id);

    -- 创建 stocks_v2
    CREATE TABLE IF NOT EXISTS stocks_v2 (
      item_id INTEGER PRIMARY KEY REFERENCES items_v2(id),
      qty INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- 创建 stock_moves_v2
    CREATE TABLE IF NOT EXISTS stock_moves_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      move_type TEXT NOT NULL CHECK(move_type IN ('in','out','adjust')),
      biz_date TEXT NOT NULL,
      item_id INTEGER NOT NULL REFERENCES items_v2(id),
      qty_delta INTEGER NOT NULL,
      doc_id INTEGER REFERENCES docs_v2(id),
      operator TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_stock_moves_v2_item_date ON stock_moves_v2(item_id, biz_date);
    CREATE INDEX IF NOT EXISTS idx_stock_moves_v2_doc ON stock_moves_v2(doc_id);
  `);
  
  console.log('✅ v2 表结构创建完成');
}

function migrateMasterData(db: Database.Database) {
  console.log('📦 迁移主数据...');
  
  // 检查是否有 categories 表，如果没有则创建（从 claim_items 中提取分类）
  const hasCategories = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='categories'
  `).get();
  
  if (!hasCategories) {
    // 从 claim_items 中提取唯一的 category_id（如果有）
    const categoryIds = db.prepare(`
      SELECT DISTINCT category_id FROM claim_items WHERE category_id IS NOT NULL
    `).all() as Array<{ category_id: number }>;
    
    if (categoryIds.length > 0) {
      console.log(`  ⚠️  发现 ${categoryIds.length} 个分类ID，但 categories 表不存在`);
      console.log('  ⚠️  建议：手动创建分类数据或留空 category_id');
    }
  }
  
  // 迁移 items → items_v2
  const itemsCount = db.prepare('SELECT COUNT(*) as count FROM items').get() as { count: number };
  if (itemsCount.count > 0) {
    db.exec(`
      INSERT INTO items_v2 (id, name, unit_default, min_stock, is_active, created_at, updated_at)
      SELECT id, name, unit, min_stock, is_active, COALESCE(created_at, datetime('now','localtime')), COALESCE(created_at, datetime('now','localtime')) FROM items
      WHERE NOT EXISTS (SELECT 1 FROM items_v2 WHERE items_v2.id = items.id)
    `);
    console.log(`  ✅ 迁移 items: ${itemsCount.count} 条`);
  }
  
  // 迁移 operators → operators_v2
  const opsCount = db.prepare('SELECT COUNT(*) as count FROM operators').get() as { count: number };
  if (opsCount.count > 0) {
    db.exec(`
      INSERT INTO operators_v2 (id, name, created_at)
      SELECT id, name, COALESCE(created_at, datetime('now','localtime')) FROM operators
      WHERE NOT EXISTS (SELECT 1 FROM operators_v2 WHERE operators_v2.id = operators.id)
    `);
    console.log(`  ✅ 迁移 operators: ${opsCount.count} 条`);
  }
  
  console.log('✅ 主数据迁移完成');
}

function migrateClaims(db: Database.Database) {
  console.log('📝 迁移申报单...');
  
  // 迁移 claims → docs_v2
  const claimsCount = db.prepare('SELECT COUNT(*) as count FROM claims').get() as { count: number };
  if (claimsCount.count > 0) {
    db.exec(`
      INSERT INTO docs_v2 (id, doc_type, doc_no, biz_date, requester, status, remark, created_at, updated_at)
      SELECT id, 'claim', claim_no, biz_date, requester, status, note, COALESCE(created_at, datetime('now','localtime')), COALESCE(created_at, datetime('now','localtime'))
      FROM claims
      WHERE NOT EXISTS (SELECT 1 FROM docs_v2 WHERE docs_v2.id = claims.id AND docs_v2.doc_type = 'claim')
    `);
    console.log(`  ✅ 迁移 claims → docs_v2: ${claimsCount.count} 条`);
  }
  
  // 迁移 claim_items → doc_lines_v2
  const claimItemsCount = db.prepare('SELECT COUNT(*) as count FROM claim_items').get() as { count: number };
  if (claimItemsCount.count > 0) {
    db.exec(`
      INSERT INTO doc_lines_v2 (doc_id, item_id, item_name, spec, qty, unit, remark, category_id, sort_no, created_at)
      SELECT 
        ci.claim_id,
        ci.item_id,
        i.name,
        ci.spec,
        ci.requested_qty,
        i.unit,
        ci.remark,
        ci.category_id,
        ci.id,
        COALESCE((SELECT created_at FROM claims WHERE id = ci.claim_id), datetime('now','localtime'))
      FROM claim_items ci
      JOIN items i ON i.id = ci.item_id
      WHERE NOT EXISTS (SELECT 1 FROM doc_lines_v2 WHERE doc_lines_v2.doc_id = ci.claim_id AND doc_lines_v2.item_id = ci.item_id)
    `);
    console.log(`  ✅ 迁移 claim_items → doc_lines_v2: ${claimItemsCount.count} 条`);
  }
  
  console.log('✅ 申报单迁移完成');
}

function migrateMovements(db: Database.Database) {
  console.log('📦 迁移出入库...');
  
  // 先为每个 movement 创建对应的 doc
  const movementsIn = db.prepare('SELECT COUNT(*) as count FROM movements WHERE type = ?').get('IN') as { count: number };
  const movementsOut = db.prepare('SELECT COUNT(*) as count FROM movements WHERE type = ?').get('OUT') as { count: number };
  
  if (movementsIn.count > 0 || movementsOut.count > 0) {
    // 为每个 movement 创建唯一的 doc
    db.exec(`
      INSERT INTO docs_v2 (doc_type, doc_no, biz_date, operator, remark, created_at, updated_at)
      SELECT DISTINCT
        CASE WHEN type = 'IN' THEN 'inbound' ELSE 'outbound' END,
        CASE WHEN type = 'IN' THEN 'IN-' || biz_date || '-' || id ELSE 'OUT-' || biz_date || '-' || id END,
        biz_date,
        operator,
        note,
        created_at,
        created_at
      FROM movements
      WHERE NOT EXISTS (
        SELECT 1 FROM docs_v2 
        WHERE docs_v2.doc_no = (
          CASE 
            WHEN movements.type = 'IN' THEN 'IN-' || movements.biz_date || '-' || movements.id
            ELSE 'OUT-' || movements.biz_date || '-' || movements.id
          END
        )
        AND docs_v2.doc_type = (
          CASE 
            WHEN movements.type = 'IN' THEN 'inbound'
            ELSE 'outbound'
          END
        )
      )
    `);
    console.log(`  ✅ 创建 docs_v2: ${movementsIn.count + movementsOut.count} 条`);
    
    // 迁移 movements → doc_lines_v2
    db.exec(`
      INSERT INTO doc_lines_v2 (doc_id, item_id, item_name, qty, unit, remark, created_at)
      SELECT 
        d.id,
        m.item_id,
        i.name,
        m.qty,
        i.unit,
        m.note,
        m.created_at
      FROM movements m
      JOIN items i ON i.id = m.item_id
      JOIN docs_v2 d ON d.doc_no = (
        CASE 
          WHEN m.type = 'IN' THEN 'IN-' || m.biz_date || '-' || m.id
          WHEN m.type = 'OUT' THEN 'OUT-' || m.biz_date || '-' || m.id
        END
      ) AND d.doc_type = (
        CASE 
          WHEN m.type = 'IN' THEN 'inbound'
          WHEN m.type = 'OUT' THEN 'outbound'
        END
      )
      WHERE NOT EXISTS (
        SELECT 1 FROM doc_lines_v2 
        WHERE doc_lines_v2.doc_id = d.id AND doc_lines_v2.item_id = m.item_id
      )
    `);
    console.log(`  ✅ 迁移 movements → doc_lines_v2: ${movementsIn.count + movementsOut.count} 条`);
    
    // 迁移 movements → stock_moves_v2
    db.exec(`
      INSERT INTO stock_moves_v2 (move_type, biz_date, item_id, qty_delta, doc_id, operator, remark, created_at)
      SELECT 
        CASE WHEN type = 'IN' THEN 'in' ELSE 'out' END,
        biz_date,
        item_id,
        CASE WHEN type = 'IN' THEN qty ELSE -qty END,
        (SELECT id FROM docs_v2 WHERE doc_no = (
          CASE 
            WHEN m.type = 'IN' THEN 'IN-' || m.biz_date || '-' || m.id
            WHEN m.type = 'OUT' THEN 'OUT-' || m.biz_date || '-' || m.id
          END
        ) AND doc_type = (
          CASE 
            WHEN m.type = 'IN' THEN 'inbound'
            WHEN m.type = 'OUT' THEN 'outbound'
          END
        )),
        operator,
        note,
        created_at
      FROM movements m
      WHERE NOT EXISTS (
        SELECT 1 FROM stock_moves_v2 
        WHERE stock_moves_v2.doc_id = (
          SELECT id FROM docs_v2 WHERE doc_no = (
            CASE 
              WHEN m.type = 'IN' THEN 'IN-' || m.biz_date || '-' || m.id
              WHEN m.type = 'OUT' THEN 'OUT-' || m.biz_date || '-' || m.id
            END
          ) AND doc_type = (
            CASE 
              WHEN m.type = 'IN' THEN 'inbound'
              WHEN m.type = 'OUT' THEN 'outbound'
            END
          )
        )
        AND stock_moves_v2.item_id = m.item_id
      )
    `);
    console.log(`  ✅ 迁移 movements → stock_moves_v2: ${movementsIn.count + movementsOut.count} 条`);
  }
  
  console.log('✅ 出入库迁移完成');
}

function migrateStocks(db: Database.Database) {
  console.log('📊 迁移库存...');
  
  const stocksCount = db.prepare('SELECT COUNT(*) as count FROM stocks').get() as { count: number };
  if (stocksCount.count > 0) {
    db.exec(`
      INSERT INTO stocks_v2 (item_id, qty, updated_at)
      SELECT item_id, qty, updated_at FROM stocks
      WHERE NOT EXISTS (SELECT 1 FROM stocks_v2 WHERE stocks_v2.item_id = stocks.item_id)
    `);
    console.log(`  ✅ 迁移 stocks: ${stocksCount.count} 条`);
  }
  
  console.log('✅ 库存迁移完成');
}

function validateMigration(db: Database.Database) {
  console.log('🔍 数据校验...');
  
  // 校验1：每个 doc 必须有对应的 lines
  const docsWithoutLines = db.prepare(`
    SELECT d.id, d.doc_no, d.doc_type
    FROM docs_v2 d
    LEFT JOIN doc_lines_v2 dl ON dl.doc_id = d.id
    WHERE dl.id IS NULL
  `).all();
  
  if (docsWithoutLines.length > 0) {
    console.warn(`  ⚠️  警告：有 ${docsWithoutLines.length} 个 doc 没有对应的 lines`);
    console.warn('    ', docsWithoutLines);
  } else {
    console.log('  ✅ 每个 doc 都有对应的 lines');
  }
  
  // 校验2：doc_lines 的 item_id 必须存在于 items_v2
  const invalidItems = db.prepare(`
    SELECT dl.id, dl.item_id
    FROM doc_lines_v2 dl
    LEFT JOIN items_v2 i ON i.id = dl.item_id
    WHERE i.id IS NULL
  `).all();
  
  if (invalidItems.length > 0) {
    console.error(`  ❌ 错误：有 ${invalidItems.length} 个 doc_line 的 item_id 不存在于 items_v2`);
    console.error('    ', invalidItems);
  } else {
    console.log('  ✅ 所有 doc_line 的 item_id 都存在于 items_v2');
  }
  
  // 校验3：库存数 = moves 累加结果（仅检查新增数据，历史数据可能有差异）
  const stockMismatches = db.prepare(`
    SELECT 
      s.item_id,
      s.qty as stock_qty,
      COALESCE(SUM(sm.qty_delta), 0) as moves_sum,
      s.qty - COALESCE(SUM(sm.qty_delta), 0) as diff
    FROM stocks_v2 s
    LEFT JOIN stock_moves_v2 sm ON sm.item_id = s.item_id
    GROUP BY s.item_id, s.qty
    HAVING ABS(s.qty - COALESCE(SUM(sm.qty_delta), 0)) > 0.01
  `).all();
  
  if (stockMismatches.length > 0) {
    console.warn(`  ⚠️  警告：有 ${stockMismatches.length} 个物资的库存数与 moves 累加结果不一致`);
    console.warn('    （这可能是历史数据导致的，需要手动调整初始库存）');
    console.warn('    ', stockMismatches.slice(0, 5)); // 只显示前5个
  } else {
    console.log('  ✅ 库存数 = moves 累加结果（一致）');
  }
  
  console.log('✅ 数据校验完成');
}

function main() {
  const dbPath = getDbPath();
  console.log(`\n📂 [迁移] 数据库路径: ${dbPath}`);
  console.log(`📂 [迁移] 数据库文件存在: ${fs.existsSync(dbPath) ? '是' : '否'}`);
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ 数据库文件不存在，请先初始化数据库');
    process.exit(1);
  }
  
  // 备份数据库
  const backupPath = backupDb(dbPath);
  console.log(`📦 [迁移] 备份文件: ${backupPath}`);
  
  // 打开数据库
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  try {
    // 创建 v2 表结构
    createV2Tables(db);
    
    // 迁移主数据
    migrateMasterData(db);
    
    // 迁移申报单
    migrateClaims(db);
    
    // 迁移出入库
    migrateMovements(db);
    
    // 迁移库存
    migrateStocks(db);
    
    // 数据校验
    validateMigration(db);
    
    console.log('\n✅ 迁移完成！');
    console.log(`📦 备份文件: ${backupPath}`);
    console.log('⚠️  请测试应用功能正常后，再考虑删除旧表');
    
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    console.error(`🔄 请恢复备份: cp ${backupPath} ${dbPath}`);
    process.exit(1);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  main();
}

export { main as migrateToV2 };
