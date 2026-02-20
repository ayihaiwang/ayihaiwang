/**
 * 库存模型
 */
import { getDb } from './db';

export interface Stock {
  item_id: number;
  qty: number;
  updated_at: string;
  // 关联字段（从 items_v2 带出）
  name?: string;
  unit?: string;
  min_stock?: number;
  is_active?: number;
  category_id?: number;
  spec?: string;
  category_name?: string;
  last_in_date?: string;
}

export interface StocksListParams {
  qField?: 'name' | 'spec' | 'category_name' | 'in_date';
  q?: string;
  date_from?: string;
  date_to?: string;
  sortBy?: 'name' | 'category' | 'spec' | 'qty' | 'last_in_date';
  sortOrder?: 'asc' | 'desc';
}

export function stocksList(params?: StocksListParams): Stock[] {
  const d = getDb();
  let sql = `
    SELECT 
      s.item_id, 
      s.qty, 
      s.updated_at,
      i.name,
      i.unit_default as unit,
      i.min_stock,
      i.is_active,
      i.category_id,
      i.spec_default as spec,
      c.name as category_name,
      (SELECT MAX(biz_date) FROM stock_moves_v2 sm WHERE sm.item_id = s.item_id AND sm.move_type = 'in') as last_in_date
    FROM stocks_v2 s
    JOIN items_v2 i ON i.id = s.item_id
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE 1=1
  `;
  const vals: unknown[] = [];
  
  // 搜索过滤
  if (params?.q && params?.qField) {
    if (params.qField === 'name') {
      sql += ' AND i.name LIKE ?';
      vals.push(`%${params.q}%`);
    } else if (params.qField === 'spec') {
      sql += ' AND i.spec_default LIKE ?';
      vals.push(`%${params.q}%`);
    } else if (params.qField === 'category_name') {
      sql += ' AND c.name LIKE ?';
      vals.push(`%${params.q}%`);
    } else if (params.qField === 'in_date') {
      if (params.date_from && params.date_to) {
        sql += ' AND EXISTS (SELECT 1 FROM stock_moves_v2 sm WHERE sm.item_id = s.item_id AND sm.move_type = \'in\' AND sm.biz_date >= ? AND sm.biz_date <= ?)';
        vals.push(params.date_from, params.date_to);
      } else if (params.date_from) {
        sql += ' AND EXISTS (SELECT 1 FROM stock_moves_v2 sm WHERE sm.item_id = s.item_id AND sm.move_type = \'in\' AND sm.biz_date >= ?)';
        vals.push(params.date_from);
      }
    }
  }
  
  // 排序
  const sortBy = params?.sortBy || 'name';
  const sortOrder = params?.sortOrder || 'asc';
  if (sortBy === 'name') {
    sql += ` ORDER BY i.name ${sortOrder.toUpperCase()}`;
  } else if (sortBy === 'category') {
    sql += ` ORDER BY c.name ${sortOrder.toUpperCase()}, i.name`;
  } else if (sortBy === 'spec') {
    sql += ` ORDER BY i.spec_default ${sortOrder.toUpperCase()}, i.name`;
  } else if (sortBy === 'qty') {
    sql += ` ORDER BY s.qty ${sortOrder.toUpperCase()}`;
  } else if (sortBy === 'last_in_date') {
    sql += ` ORDER BY last_in_date ${sortOrder.toUpperCase()}, i.name`;
  } else {
    sql += ` ORDER BY i.name ${sortOrder.toUpperCase()}`;
  }
  
  return d.prepare(sql).all(...vals) as Stock[];
}

export function stocksUpdate(itemId: number, qtyDelta: number): { ok: boolean } {
  const d = getDb();
  const existing = d.prepare('SELECT qty FROM stocks_v2 WHERE item_id = ?').get(itemId) as { qty: number } | undefined;
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  if (existing) {
    const newQty = existing.qty + qtyDelta;
    if (newQty < 0) {
      throw new Error('库存不足，无法出库');
    }
    d.prepare('UPDATE stocks_v2 SET qty = ?, updated_at = ? WHERE item_id = ?').run(newQty, now, itemId);
  } else {
    if (qtyDelta < 0) {
      throw new Error('库存不足，无法出库');
    }
    d.prepare('INSERT INTO stocks_v2 (item_id, qty, updated_at) VALUES (?, ?, ?)').run(itemId, qtyDelta, now);
  }
  
  return { ok: true };
}

export interface StockItemDetail {
  item: { id: number; name: string; spec: string | null; unit: string; category_name: string | null; min_stock: number };
  stock: { qty: number; updated_at?: string };
  last_inbound_at: string | null;
  outbounds: Array<{
    doc_id: number | null;
    doc_no: string | null;
    biz_date: string;
    occurred_at: string;
    qty: number;
    operator_name: string | null;
    remark: string | null;
  }>;
}

export function stockItemDetail(itemId: number): StockItemDetail | null {
  const d = getDb();
  const item = d.prepare(`
    SELECT i.id, i.name, i.spec_default as spec, i.unit_default as unit, c.name as category_name, COALESCE(i.min_stock, 0) as min_stock
    FROM items_v2 i
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE i.id = ?
  `).get(itemId) as { id: number; name: string; spec: string | null; unit: string; category_name: string | null; min_stock: number } | undefined;
  if (!item) return null;

  const stock = d.prepare('SELECT qty, updated_at FROM stocks_v2 WHERE item_id = ?').get(itemId) as
    | { qty: number; updated_at: string }
    | undefined;
  const stockData = stock ? { qty: stock.qty, updated_at: stock.updated_at } : { qty: 0, updated_at: undefined };

  const lastIn = d.prepare(`
    SELECT created_at FROM stock_moves_v2
    WHERE item_id = ? AND move_type = 'in'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(itemId) as { created_at: string } | undefined;
  const last_inbound_at = lastIn?.created_at ?? null;

  const outRows = d.prepare(`
    SELECT sm.doc_id, sm.biz_date, sm.created_at, sm.qty_delta, sm.operator, sm.remark, d.doc_no
    FROM stock_moves_v2 sm
    LEFT JOIN docs_v2 d ON d.id = sm.doc_id
    WHERE sm.item_id = ? AND sm.move_type = 'out'
    ORDER BY sm.created_at DESC, sm.biz_date DESC
  `).all(itemId) as Array<{
    doc_id: number | null;
    doc_no: string | null;
    biz_date: string;
    created_at: string;
    qty_delta: number;
    operator: string | null;
    remark: string | null;
  }>;

  const outbounds = outRows.map((r) => ({
    doc_id: r.doc_id,
    doc_no: r.doc_no ?? null,
    biz_date: r.biz_date,
    occurred_at: r.created_at || r.biz_date,
    qty: Math.abs(r.qty_delta),
    operator_name: r.operator ?? null,
    remark: r.remark ?? null,
  }));

  return {
    item: {
      id: item.id,
      name: item.name,
      spec: item.spec,
      unit: item.unit,
      category_name: item.category_name,
      min_stock: item.min_stock,
    },
    stock: stockData,
    last_inbound_at,
    outbounds,
  };
}

export function stocksAlerts(): Array<{
  item_id: number;
  qty: number;
  name: string;
  unit: string;
  min_stock: number;
  gap: number;
}> {
  const d = getDb();
  return d.prepare(`
    SELECT 
      s.item_id,
      s.qty,
      i.name,
      i.unit_default as unit,
      i.min_stock,
      (i.min_stock - s.qty) as gap
    FROM stocks_v2 s
    JOIN items_v2 i ON i.id = s.item_id
    WHERE i.is_active = 1
      AND i.min_stock > 0
      AND s.qty < i.min_stock
    ORDER BY gap DESC
  `).all() as Array<{
    item_id: number;
    qty: number;
    name: string;
    unit: string;
    min_stock: number;
    gap: number;
  }>;
}
