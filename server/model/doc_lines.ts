/**
 * 单据明细模型
 */
import { getDb } from './db';
import { itemGet } from './items';

export interface DocLine {
  id: number;
  doc_id: number;
  item_id: number;
  item_name?: string;
  spec?: string;
  qty: number;
  unit: string;
  remark?: string;
  category_id?: number;
  category_name?: string;
  sort_no: number;
  created_at: string;
}

export interface DocLineCreateInput {
  item_id: number;
  spec?: string;
  qty: number;
  unit: string;
  remark?: string;
  category_id?: number;
  sort_no?: number;
}

export function docLinesList(docId: number): DocLine[] {
  const d = getDb();
  return d.prepare(`
    SELECT dl.*, c.name AS category_name
    FROM doc_lines_v2 dl
    LEFT JOIN categories c ON c.id = dl.category_id
    WHERE dl.doc_id = ?
    ORDER BY dl.sort_no, dl.id
  `).all(docId) as DocLine[];
}

export function docLineCreate(docId: number, input: DocLineCreateInput, sortNo?: number): { id: number } {
  const d = getDb();
  
  // 获取物资信息（用于填充 item_name）
  const item = itemGet(input.item_id);
  if (!item) {
    throw new Error(`物资不存在: ${input.item_id}`);
  }
  
  // 如果 unit 为空，使用 item 的默认单位
  const unit = input.unit || item.unit_default;
  
  const r = d.prepare(`
    INSERT INTO doc_lines_v2 (doc_id, item_id, item_name, spec, qty, unit, remark, category_id, sort_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    docId,
    input.item_id,
    item.name,
    input.spec ?? item.spec_default ?? null,
    input.qty,
    unit,
    input.remark ?? null,
    input.category_id ?? item.category_id ?? null,
    sortNo ?? input.sort_no ?? 0
  );
  
  return { id: Number(r.lastInsertRowid) };
}

export function docLineUpdate(
  id: number,
  input: Partial<{
    spec: string;
    qty: number;
    unit: string;
    remark: string;
    category_id: number;
    sort_no: number;
  }>
): { ok: boolean } {
  const d = getDb();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (input.spec !== undefined) { fields.push('spec = ?'); vals.push(input.spec ?? null); }
  if (input.qty !== undefined) { fields.push('qty = ?'); vals.push(input.qty); }
  if (input.unit !== undefined) { fields.push('unit = ?'); vals.push(input.unit); }
  if (input.remark !== undefined) { fields.push('remark = ?'); vals.push(input.remark ?? null); }
  if (input.category_id !== undefined) { fields.push('category_id = ?'); vals.push(input.category_id ?? null); }
  if (input.sort_no !== undefined) { fields.push('sort_no = ?'); vals.push(input.sort_no); }
  if (fields.length === 0) return { ok: true };
  vals.push(id);
  d.prepare(`UPDATE doc_lines_v2 SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  return { ok: true };
}

export function docLineDelete(id: number): { ok: boolean } {
  const d = getDb();
  d.prepare('DELETE FROM doc_lines_v2 WHERE id = ?').run(id);
  return { ok: true };
}
