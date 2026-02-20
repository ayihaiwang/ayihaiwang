/**
 * 统一单据模型（申报/入库/出库）
 */
import { getDb } from './db';
import { docLinesList, docLineCreate, DocLineCreateInput } from './doc_lines';
import { stockMoveCreate } from './stock_moves';
import { stocksUpdate } from './stocks';

export type DocType = 'claim' | 'inbound' | 'outbound';

export interface Doc {
  id: number;
  doc_type: DocType;
  doc_no: string;
  biz_date: string;
  company_name?: string;
  requester?: string;
  operator?: string;
  status?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface DocWithLines extends Doc {
  lines: import('./doc_lines').DocLine[];
}

export interface DocCreateInput {
  doc_type: DocType;
  doc_no: string;
  biz_date: string;
  company_name?: string;
  requester?: string;
  operator?: string;
  status?: string;
  remark?: string;
  lines: import('./doc_lines').DocLineCreateInput[];
}

export function docsList(params?: {
  type?: DocType;
  sort?: 'biz_date' | 'created_at';
  order?: 'asc' | 'desc';
}): Doc[] {
  const d = getDb();
  let sql = 'SELECT * FROM docs_v2 WHERE 1=1';
  const vals: unknown[] = [];
  
  if (params?.type) {
    sql += ' AND doc_type = ?';
    vals.push(params.type);
  }
  
  const sortField = params?.sort || 'created_at';
  const order = params?.order || 'desc';
  sql += ` ORDER BY ${sortField} ${order.toUpperCase()}`;
  
  return d.prepare(sql).all(...vals) as Doc[];
}

export function docGet(id: number): DocWithLines | null {
  const d = getDb();
  const doc = d.prepare('SELECT * FROM docs_v2 WHERE id = ?').get(id) as Doc | null;
  if (!doc) return null;
  const lines = docLinesList(id);
  return { ...doc, lines };
}

export function docCreate(input: DocCreateInput): { id: number } {
  const d = getDb();
  const run = d.transaction(() => {
    // 创建单据头
    const r = d.prepare(`
      INSERT INTO docs_v2 (doc_type, doc_no, biz_date, company_name, requester, operator, status, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.doc_type,
      input.doc_no,
      input.biz_date,
      input.company_name ?? null,
      input.requester ?? null,
      input.operator ?? null,
      input.status ?? null,
      input.remark ?? null
    );
    const docId = Number(r.lastInsertRowid);
    
    // 创建单据行
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      docLineCreate(docId, line, i);
    }
    
    // 如果是入库/出库，需要更新库存和生成流水
    if (input.doc_type === 'inbound' || input.doc_type === 'outbound') {
      for (const line of input.lines) {
        const qtyDelta = input.doc_type === 'inbound' ? line.qty : -line.qty;
        stockMoveCreate({
          move_type: input.doc_type === 'inbound' ? 'in' : 'out',
          biz_date: input.biz_date,
          item_id: line.item_id,
          qty_delta: qtyDelta,
          doc_id: docId,
          operator: input.operator ?? null,
          remark: line.remark ?? null,
        });
        stocksUpdate(line.item_id, qtyDelta);
      }
    }
    
    return { id: docId };
  });
  
  return run();
}

export function docUpdate(
  id: number,
  input: Partial<{
    biz_date: string;
    company_name: string;
    requester: string;
    operator: string;
    status: string;
    remark: string;
  }>
): { ok: boolean } {
  const d = getDb();
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (input.biz_date !== undefined) { fields.push('biz_date = ?'); vals.push(input.biz_date); }
  if (input.company_name !== undefined) { fields.push('company_name = ?'); vals.push(input.company_name ?? null); }
  if (input.requester !== undefined) { fields.push('requester = ?'); vals.push(input.requester ?? null); }
  if (input.operator !== undefined) { fields.push('operator = ?'); vals.push(input.operator ?? null); }
  if (input.status !== undefined) { fields.push('status = ?'); vals.push(input.status ?? null); }
  if (input.remark !== undefined) { fields.push('remark = ?'); vals.push(input.remark ?? null); }
  if (fields.length === 0) return { ok: true };
  fields.push('updated_at = datetime(\'now\',\'localtime\')');
  vals.push(id);
  d.prepare(`UPDATE docs_v2 SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  return { ok: true };
}

export function docUpdateStatus(id: number, status: string): { ok: boolean } {
  return docUpdate(id, { status });
}
