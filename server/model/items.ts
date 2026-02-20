/**
 * 物资模型
 */
import { getDb } from './db';

export interface Item {
  id: number;
  name: string;
  category_id?: number;
  spec_default?: string;
  unit_default: string;
  min_stock: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export function itemsList(activeOnly?: boolean): Item[] {
  const d = getDb();
  if (activeOnly) {
    return d.prepare('SELECT * FROM items_v2 WHERE is_active = 1 ORDER BY name').all() as Item[];
  }
  return d.prepare('SELECT * FROM items_v2 ORDER BY is_active DESC, name').all() as Item[];
}

export function itemCreate(row: {
  name: string;
  category_id?: number;
  spec_default?: string;
  unit_default: string;
  min_stock?: number;
}): { id: number } {
  const d = getDb();
  try {
    const r = d.prepare(
      'INSERT INTO items_v2 (name, category_id, spec_default, unit_default, min_stock) VALUES (?, ?, ?, ?, ?)'
    ).run(
      row.name,
      row.category_id ?? null,
      row.spec_default ?? null,
      row.unit_default,
      row.min_stock ?? 0
    );
    const itemId = Number(r.lastInsertRowid);
    // 自动创建库存记录
    d.prepare('INSERT OR IGNORE INTO stocks_v2 (item_id, qty) VALUES (?, 0)').run(itemId);
    return { id: itemId };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e) {
      const code = (e as { code: string }).code;
      if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('物资名称已存在');
      }
      if (code === 'SQLITE_CONSTRAINT_NOTNULL') {
        const message = (e as { message?: string }).message || '';
        const field = message.match(/\.(\w+)/)?.[1] || '字段';
        const fieldName = field === 'unit_default' ? '单位' : field === 'name' ? '物资名称' : field;
        throw new Error(`必填字段不能为空：${fieldName}`);
      }
    }
    throw e;
  }
}

export function itemUpdate(
  id: number,
  row: {
    name?: string;
    category_id?: number;
    spec_default?: string;
    unit_default?: string;
    min_stock?: number;
    is_active?: number;
  }
): Item | null {
  const d = getDb();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (row.name !== undefined) { fields.push('name = ?'); vals.push(row.name); }
  if (row.category_id !== undefined) { fields.push('category_id = ?'); vals.push(row.category_id ?? null); }
  if (row.spec_default !== undefined) { fields.push('spec_default = ?'); vals.push(row.spec_default ?? null); }
  if (row.unit_default !== undefined) { fields.push('unit_default = ?'); vals.push(row.unit_default); }
  if (row.min_stock !== undefined) { fields.push('min_stock = ?'); vals.push(row.min_stock); }
  if (row.is_active !== undefined) { fields.push('is_active = ?'); vals.push(row.is_active); }
  if (fields.length === 0) return itemGet(id);
  fields.push('updated_at = datetime(\'now\',\'localtime\')');
  vals.push(id);
  d.prepare(`UPDATE items_v2 SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  return itemGet(id);
}

export function itemGet(id: number): Item | null {
  const d = getDb();
  return d.prepare('SELECT * FROM items_v2 WHERE id = ?').get(id) as Item | null;
}

export interface ItemWithCategory extends Item {
  category_name: string | null;
}

/** 按名称/规格模糊搜索物资（用于物资资料修正），q 为空返回 [] 避免全表 */
export function itemsSearch(q: string): ItemWithCategory[] {
  const d = getDb();
  if (!q || !q.trim()) {
    return [];
  }
  const kw = `%${q.trim()}%`;
  return d.prepare(`
    SELECT i.*, c.name AS category_name
    FROM items_v2 i
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE i.name LIKE ? OR i.spec_default LIKE ?
    ORDER BY i.is_active DESC, i.name
    LIMIT 200
  `).all(kw, kw) as ItemWithCategory[];
}
