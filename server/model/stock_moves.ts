/**
 * 库存流水模型
 */
import { getDb } from './db';

export type MoveType = 'in' | 'out' | 'adjust';

export interface StockMove {
  id: number;
  move_type: MoveType;
  biz_date: string;
  item_id: number;
  qty_delta: number;
  doc_id?: number;
  operator?: string;
  remark?: string;
  created_at: string;
  // 关联字段
  item_name?: string;
  unit?: string;
}

export interface StockMoveCreateInput {
  move_type: MoveType;
  biz_date: string;
  item_id: number;
  qty_delta: number;
  doc_id?: number;
  operator?: string;
  remark?: string;
}

export function stockMoveCreate(input: StockMoveCreateInput): { id: number } {
  const d = getDb();
  const r = d.prepare(`
    INSERT INTO stock_moves_v2 (move_type, biz_date, item_id, qty_delta, doc_id, operator, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.move_type,
    input.biz_date,
    input.item_id,
    input.qty_delta,
    input.doc_id ?? null,
    input.operator ?? null,
    input.remark ?? null
  );
  return { id: Number(r.lastInsertRowid) };
}

export function stockMovesList(params?: {
  item_id?: number;
  start?: string;
  end?: string;
  limit?: number;
}): StockMove[] {
  const d = getDb();
  let sql = `
    SELECT 
      sm.*,
      i.name as item_name,
      i.unit_default as unit
    FROM stock_moves_v2 sm
    JOIN items_v2 i ON i.id = sm.item_id
    WHERE 1=1
  `;
  const vals: unknown[] = [];
  
  if (params?.item_id) {
    sql += ' AND sm.item_id = ?';
    vals.push(params.item_id);
  }
  if (params?.start) {
    sql += ' AND sm.biz_date >= ?';
    vals.push(params.start);
  }
  if (params?.end) {
    sql += ' AND sm.biz_date <= ?';
    vals.push(params.end);
  }
  
  sql += ' ORDER BY sm.biz_date DESC, sm.created_at DESC';
  
  if (params?.limit) {
    sql += ' LIMIT ?';
    vals.push(params.limit);
  }
  
  return d.prepare(sql).all(...vals) as StockMove[];
}

export function stockMovesRecent(limit: number): StockMove[] {
  return stockMovesList({ limit });
}

/** 某物资的库存流水（用于详情 Drawer），含 doc_no、operator_name */
export interface ItemMoveRow {
  created_at: string;
  move_type: MoveType;
  qty_delta: number;
  doc_no: string | null;
  doc_id: number | null;
  operator_name: string | null;
  remark: string | null;
}

export function itemMovesByItemId(itemId: number, limit = 200): ItemMoveRow[] {
  const d = getDb();
  const rows = d.prepare(`
    SELECT sm.created_at, sm.move_type, sm.qty_delta, sm.doc_id, sm.operator, sm.remark, d.doc_no
    FROM stock_moves_v2 sm
    LEFT JOIN docs_v2 d ON d.id = sm.doc_id
    WHERE sm.item_id = ?
    ORDER BY sm.created_at DESC
    LIMIT ?
  `).all(itemId, limit) as Array<{
    created_at: string;
    move_type: MoveType;
    qty_delta: number;
    doc_id: number | null;
    operator: string | null;
    remark: string | null;
    doc_no: string | null;
  }>;
  return rows.map((r) => ({
    created_at: r.created_at,
    move_type: r.move_type,
    qty_delta: r.qty_delta,
    doc_no: r.doc_no ?? null,
    doc_id: r.doc_id,
    operator_name: r.operator ?? null,
    remark: r.remark ?? null,
  }));
}
