/** 文件名非法字符替换为 _ */
function sanitize(s: string): string {
  return (s || '').replace(/[/\\:*?"<>|]/g, '_');
}

/** 物资申报表：{company}_物资申报表_{doc_no}.xlsx/pdf */
export function getClaimFileName(companyName: string, docNo: string, ext: 'xlsx' | 'pdf'): string {
  const c = (companyName || '').trim();
  const no = sanitize(docNo || '未命名');
  const base = c ? `${sanitize(c)}_物资申报表_${no}` : `物资申报表_${no}`;
  return `${base}.${ext}`;
}

/** 库存总表：{company}_库存总表_{date}.xlsx/pdf */
export function getInventoryFileName(companyName: string, date: string, ext: 'xlsx' | 'pdf'): string {
  const c = (companyName || '').trim();
  const d = sanitize(date || new Date().toISOString().slice(0, 10));
  const base = c ? `${sanitize(c)}_库存总表_${d}` : `库存总表_${d}`;
  return `${base}.${ext}`;
}

/** 统计报表：{company}_统计报表_{from}_{to}.xlsx/pdf */
export function getReportFileName(companyName: string, from: string, to: string, ext: 'xlsx' | 'pdf'): string {
  const c = (companyName || '').trim();
  const f = sanitize(from || '');
  const t = sanitize(to || '');
  const base = c ? `${sanitize(c)}_统计报表_${f}_${t}` : `统计报表_${f}_${t}`;
  return `${base}.${ext}`;
}
