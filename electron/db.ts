import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db: Database.Database | null = null;

export function initDb(dbPath: string) {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

function getDb(): Database.Database {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function ensureTables() {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      min_stock INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS stocks (
      item_id INTEGER PRIMARY KEY REFERENCES items(id),
      qty INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_no TEXT UNIQUE NOT NULL,
      biz_date TEXT NOT NULL,
      requester TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('DRAFT','SUBMITTED','PARTIAL','ARRIVED','CLOSED')),
      note TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS claim_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL REFERENCES claims(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      requested_qty INTEGER NOT NULL,
      received_qty INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('IN','OUT')),
      item_id INTEGER NOT NULL REFERENCES items(id),
      qty INTEGER NOT NULL,
      biz_date TEXT NOT NULL,
      operator TEXT NOT NULL,
      note TEXT,
      claim_id INTEGER REFERENCES claims(id),
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_movements_biz_date ON movements(biz_date);
    CREATE INDEX IF NOT EXISTS idx_movements_item ON movements(item_id);
    CREATE INDEX IF NOT EXISTS idx_claim_items_claim ON claim_items(claim_id);
  `);
  try {
    const infoClaimItems = d.prepare('PRAGMA table_info(claim_items)').all() as { name: string }[];
    if (!infoClaimItems.some((c) => c.name === 'spec')) {
      d.exec('ALTER TABLE claim_items ADD COLUMN spec TEXT');
    }
    if (!infoClaimItems.some((c) => c.name === 'remark')) {
      d.exec('ALTER TABLE claim_items ADD COLUMN remark TEXT');
    }
    if (!infoClaimItems.some((c) => c.name === 'category_id')) {
      d.exec('ALTER TABLE claim_items ADD COLUMN category_id INTEGER');
    }
  } catch (e: any) {
    if (!/duplicate column/i.test(e?.message ?? '')) throw e;
  }
  return { ok: true };
}

// seed: 10 items, 2 operators, some movements, 1 claim
export function seed() {
  const d = getDb();
  const hasItems = d.prepare('SELECT 1 FROM items LIMIT 1').get();
  if (hasItems) return { ok: true, message: 'already seeded' };

  d.exec(`
    INSERT INTO operators (name) VALUES ('张三'), ('李四');
    INSERT INTO items (name, unit, min_stock) VALUES
      ('签字笔', '支', 20),
      ('A4纸', '包', 10),
      ('订书机', '个', 5),
      ('文件夹', '个', 15),
      ('胶带', '卷', 30),
      ('笔记本', '本', 20),
      ('橡皮', '块', 50),
      ('尺子', '把', 10),
      ('回形针', '盒', 20),
      ('便签纸', '包', 15);
  `);

  const today = new Date().toISOString().slice(0, 10);
  const items = d.prepare('SELECT id FROM items').all() as { id: number }[];
  const ops = d.prepare('SELECT name FROM operators').all() as { name: string }[];

  for (const it of items) {
    d.prepare('INSERT OR REPLACE INTO stocks (item_id, qty, updated_at) VALUES (?, ?, ?)').run(it.id, 50 + Math.floor(Math.random() * 100), today);
  }

  for (let i = 0; i < 15; i++) {
    const item = items[i % items.length];
    const op = ops[i % ops.length].name;
    const qty = 5 + Math.floor(Math.random() * 20);
    d.prepare(
      'INSERT INTO movements (type, item_id, qty, biz_date, operator, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('IN', item.id, qty, today, op, '种子入库');
  }
  for (let i = 0; i < 8; i++) {
    const item = items[i % items.length];
    const op = ops[i % ops.length].name;
    const qty = 1 + Math.floor(Math.random() * 10);
    d.prepare(
      'INSERT INTO movements (type, item_id, qty, biz_date, operator, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('OUT', item.id, qty, today, op, '种子出库');
  }

  const claimNo = 'CL' + Date.now();
  d.prepare(
    'INSERT INTO claims (claim_no, biz_date, requester, status, note) VALUES (?, ?, ?, ?, ?)'
  ).run(claimNo, today, '张三', 'SUBMITTED', '测试申报单');
  const claimId = d.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  for (let i = 0; i < 4; i++) {
    d.prepare(
      'INSERT INTO claim_items (claim_id, item_id, requested_qty, received_qty) VALUES (?, ?, ?, ?)'
    ).run(claimId.id, items[i].id, 20 + i * 5, i * 3);
  }

  return { ok: true };
}

// --- items
export function itemsList(activeOnly?: boolean) {
  const d = getDb();
  if (activeOnly) {
    return d.prepare('SELECT * FROM items WHERE is_active = 1 ORDER BY name').all();
  }
  return d.prepare('SELECT * FROM items ORDER BY is_active DESC, name').all();
}

export function itemCreate(row: { name: string; unit: string; min_stock?: number }) {
  const d = getDb();
  const r = d.prepare(
    'INSERT INTO items (name, unit, min_stock) VALUES (?, ?, ?)'
  ).run(row.name, row.unit, row.min_stock ?? 0);
  d.prepare('INSERT OR IGNORE INTO stocks (item_id, qty) VALUES (?, 0)').run(Number(r.lastInsertRowid));
  return { id: Number(r.lastInsertRowid) };
}

export function itemUpdate(id: number, row: { name?: string; unit?: string; min_stock?: number; is_active?: number }) {
  const d = getDb();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (row.name !== undefined) { fields.push('name = ?'); vals.push(row.name); }
  if (row.unit !== undefined) { fields.push('unit = ?'); vals.push(row.unit); }
  if (row.min_stock !== undefined) { fields.push('min_stock = ?'); vals.push(row.min_stock); }
  if (row.is_active !== undefined) { fields.push('is_active = ?'); vals.push(row.is_active); }
  if (fields.length === 0) return { ok: true };
  vals.push(id);
  d.prepare(`UPDATE items SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  return { ok: true };
}

// --- stocks
export function stocksList() {
  const d = getDb();
  return d.prepare(`
    SELECT s.item_id, s.qty, s.updated_at, i.name, i.unit, i.min_stock, i.is_active
    FROM stocks s
    JOIN items i ON i.id = s.item_id
    ORDER BY i.name
  `).all();
}

// --- operators (from movements + operators table)
export function operatorsList() {
  const d = getDb();
  const fromTable = d.prepare('SELECT name FROM operators ORDER BY name').all() as { name: string }[];
  const fromMovements = d.prepare('SELECT DISTINCT operator AS name FROM movements').all() as { name: string }[];
  const set = new Set<string>();
  fromTable.forEach(r => set.add(r.name));
  fromMovements.forEach(r => set.add(r.name));
  return Array.from(set).sort().map(name => ({ name }));
}

export function operatorAdd(name: string) {
  const d = getDb();
  try {
    d.prepare('INSERT INTO operators (name) VALUES (?)').run(name);
    return { ok: true };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: true };
    }
    throw e;
  }
}

// --- movements IN (transaction: movement + stock + claim if any)
export function movementIn(row: {
  item_id: number; qty: number; biz_date: string; operator: string; note?: string; claim_id?: number;
}) {
  const d = getDb();
  const run = d.transaction(() => {
    d.prepare(
      'INSERT INTO movements (type, item_id, qty, biz_date, operator, note, claim_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('IN', row.item_id, row.qty, row.biz_date, row.operator, row.note ?? null, row.claim_id ?? null);

    const existing = d.prepare('SELECT qty FROM stocks WHERE item_id = ?').get(row.item_id) as { qty: number } | undefined;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (existing) {
      d.prepare('UPDATE stocks SET qty = qty + ?, updated_at = ? WHERE item_id = ?').run(row.qty, now, row.item_id);
    } else {
      d.prepare('INSERT INTO stocks (item_id, qty, updated_at) VALUES (?, ?, ?)').run(row.item_id, row.qty, now);
    }

    if (row.claim_id) {
      d.prepare(
        'UPDATE claim_items SET received_qty = received_qty + ? WHERE claim_id = ? AND item_id = ?'
      ).run(row.qty, row.claim_id, row.item_id);
      refreshClaimStatus(d, row.claim_id);
    }
  });
  run();
  return { ok: true };
}

function refreshClaimStatus(d: Database.Database, claimId: number) {
  const rows = d.prepare('SELECT requested_qty, received_qty FROM claim_items WHERE claim_id = ?').all(claimId) as { requested_qty: number; received_qty: number }[];
  let status: string;
  const allArrived = rows.every(r => r.received_qty >= r.requested_qty);
  const anyArrived = rows.some(r => r.received_qty > 0);
  if (allArrived) status = 'ARRIVED';
  else if (anyArrived) status = 'PARTIAL';
  else status = 'SUBMITTED';
  d.prepare('UPDATE claims SET status = ? WHERE id = ?').run(status, claimId);
}

// --- movements OUT (transaction: check stock, movement, stock)
export function movementOut(row: {
  item_id: number; qty: number; biz_date: string; operator: string; note?: string;
}) {
  const d = getDb();
  d.transaction(() => {
    const st = d.prepare('SELECT qty FROM stocks WHERE item_id = ?').get(row.item_id) as { qty: number } | undefined;
    if (!st || st.qty < row.qty) throw new Error('库存不足，无法出库');
    d.prepare(
      'INSERT INTO movements (type, item_id, qty, biz_date, operator, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('OUT', row.item_id, row.qty, row.biz_date, row.operator, row.note ?? null);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    d.prepare('UPDATE stocks SET qty = qty - ?, updated_at = ? WHERE item_id = ?').run(row.qty, now, row.item_id);
  })();
  return { ok: true };
}

export function movementsRecent(limit: number) {
  const d = getDb();
  return d.prepare(`
    SELECT m.*, i.name as item_name, i.unit
    FROM movements m
    JOIN items i ON i.id = m.item_id
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(limit);
}

// --- claims
export function claimsList() {
  const d = getDb();
  return d.prepare('SELECT * FROM claims ORDER BY created_at DESC').all();
}

export function claimGet(id: number) {
  const d = getDb();
  const claim = d.prepare('SELECT * FROM claims WHERE id = ?').get(id);
  if (!claim) return null;
  const items = d.prepare(`
    SELECT ci.id, ci.claim_id, ci.item_id, ci.requested_qty, ci.received_qty,
           COALESCE(ci.spec, i.spec) as item_spec, ci.remark,
           i.name as item_name, i.unit, c.name as category_name
    FROM claim_items ci
    JOIN items i ON i.id = ci.item_id
    LEFT JOIN categories c ON c.id = COALESCE(ci.category_id, i.category_id)
    WHERE ci.claim_id = ?
  `).all(id);
  return { ...(claim as object), items };
}

export function claimCreate(row: {
  claim_no: string; biz_date: string; requester: string; status?: string; note?: string;
  items?: { item_id: number; requested_qty: number }[];
}) {
  const d = getDb();
  const r = d.prepare(
    'INSERT INTO claims (claim_no, biz_date, requester, status, note) VALUES (?, ?, ?, ?, ?)'
  ).run(row.claim_no, row.biz_date, row.requester, row.status ?? 'DRAFT', row.note ?? null);
  const claimId = Number(r.lastInsertRowid);
  if (row.items?.length) {
    const ins = d.prepare('INSERT INTO claim_items (claim_id, item_id, requested_qty, spec, remark, category_id) VALUES (?, ?, ?, ?, ?, ?)');
    for (const it of row.items) {
      ins.run(claimId, it.item_id, it.requested_qty, (it as any).spec ?? null, (it as any).remark ?? null, (it as any).category_id ?? null);
    }
  }
  return { id: claimId };
}

export function claimUpdateStatus(id: number, status: string) {
  const d = getDb();
  d.prepare('UPDATE claims SET status = ? WHERE id = ?').run(status, id);
  return { ok: true };
}

export function claimItemsByClaim(claimId: number) {
  const d = getDb();
  return d.prepare(`
    SELECT ci.id, ci.claim_id, ci.item_id, ci.requested_qty, ci.received_qty,
           COALESCE(ci.spec, i.spec) as item_spec, ci.remark,
           i.name as item_name, i.unit, c.name as category_name
    FROM claim_items ci
    JOIN items i ON i.id = ci.item_id
    LEFT JOIN categories c ON c.id = COALESCE(ci.category_id, i.category_id)
    WHERE ci.claim_id = ?
  `).all(claimId);
}

export function claimsForInbound() {
  const d = getDb();
  return d.prepare("SELECT * FROM claims WHERE status IN ('SUBMITTED','PARTIAL') ORDER BY created_at DESC").all();
}

// --- reports
export function reportsDaily(start: string, end: string, itemId?: number, operator?: string) {
  const d = getDb();
  let sql = `
    SELECT biz_date as date,
      SUM(CASE WHEN type = 'IN' THEN qty ELSE 0 END) as in_qty,
      SUM(CASE WHEN type = 'OUT' THEN qty ELSE 0 END) as out_qty
    FROM movements
    WHERE biz_date >= ? AND biz_date <= ?
  `;
  const params: (string | number)[] = [start, end];
  if (itemId) { sql += ' AND item_id = ?'; params.push(itemId); }
  if (operator) { sql += ' AND operator = ?'; params.push(operator); }
  sql += ' GROUP BY biz_date ORDER BY biz_date';
  return d.prepare(sql).all(...params);
}

export function reportsTopItems(start: string, end: string, type: string, limit: number) {
  const d = getDb();
  return d.prepare(`
    SELECT m.item_id, i.name as item_name, i.unit, SUM(m.qty) as total_qty
    FROM movements m
    JOIN items i ON i.id = m.item_id
    WHERE m.biz_date >= ? AND m.biz_date <= ? AND m.type = ?
    GROUP BY m.item_id
    ORDER BY total_qty DESC
    LIMIT ?
  `).all(start, end, type, limit);
}

export function reportsMovements(start: string, end: string, itemId?: number, operator?: string) {
  const d = getDb();
  let sql = `
    SELECT m.*, i.name as item_name, i.unit
    FROM movements m
    JOIN items i ON i.id = m.item_id
    WHERE m.biz_date >= ? AND m.biz_date <= ?
  `;
  const params: (string | number)[] = [start, end];
  if (itemId) { sql += ' AND m.item_id = ?'; params.push(itemId); }
  if (operator) { sql += ' AND m.operator = ?'; params.push(operator); }
  sql += ' ORDER BY m.biz_date DESC, m.created_at DESC';
  return d.prepare(sql).all(...params);
}

// --- backup
export function exportBackup(dbPath: string) {
  const buf = fs.readFileSync(dbPath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export function importBackup(buffer: ArrayBuffer, dbPath: string) {
  const backupPath = dbPath + '.bak.' + Date.now();
  if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, backupPath);
  fs.writeFileSync(dbPath, Buffer.from(buffer));
  return { ok: true, backup: backupPath };
}

// API object for main.ts
export const dbApi = {
  ensureTables,
  seed,
  close: () => { if (db) db.close(); db = null; },
  itemsList,
  itemCreate,
  itemUpdate,
  stocksList,
  operatorsList,
  operatorAdd,
  movementIn,
  movementOut,
  movementsRecent,
  claimsList,
  claimGet,
  claimCreate,
  claimUpdateStatus,
  claimItemsByClaim,
  claimsForInbound,
  reportsDaily,
  reportsTopItems,
  reportsMovements,
  exportBackup: (dbPath: string) => exportBackup(dbPath),
  importBackup: (buf: ArrayBuffer, dbPath: string) => importBackup(buf, dbPath),
};
