import type { ClaimDetail } from '../vite-env.d';
import ExcelJS from 'exceljs';
import { getClaimFileName } from './exportFileName';
import {
  exportHTMLToPDF,
  printHTML,
  generateHTMLTemplate,
  widthsToPercentages,
  excelStyles,
  excelPageSetup,
  downloadExcel,
} from './exportUtils';

/** 物资申请表 PDF 与 Excel 均统一为横向 A4（landscape A4）。 */
/** 申报表主标题，如 "XX公司物资申报表" 或 "物资申报表" */
function buildClaimTableRows(claim: ClaimDetail) {
  return (claim.items || []).map((item: any, idx: number) => [
    idx + 1,
    item.item_name || '',
    item.category_name ?? '',
    (item.item_spec ?? item.spec) ?? '',
    item.unit || '',
    item.requested_qty ?? item.qty ?? 0,
    item.remark ?? '',
  ]);
}

const COL_HEADERS = ['序号', '物资名称', '分类', '规格型号', '单位', '申报数量', '备注'];
const COL_COUNT = 7;
const CLAIM_COLUMN_KEYS = ['col0', 'col1', 'col2', 'col3', 'col4', 'col5', 'col6'];
const DEFAULT_CLAIM_WIDTHS = [6, 18, 12, 18, 6, 10, 20];

const STORAGE_KEY_CLAIM_EXPORT = 'claim_export_column_widths';

/** 读取自定义申报页列宽（与预览中使用的 key 一致），用于 PDF/Excel/打印 */
export function getClaimColumnWidths(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLAIM_EXPORT);
    if (!raw) return [...DEFAULT_CLAIM_WIDTHS];
    const obj = JSON.parse(raw) as Record<string, number>;
    return CLAIM_COLUMN_KEYS.map((k, i) => (obj[k] != null ? Number(obj[k]) : DEFAULT_CLAIM_WIDTHS[i]));
  } catch {
    return [...DEFAULT_CLAIM_WIDTHS];
  }
}

/** 保存自定义申报页列宽（供申报页预览「保存为默认格式」使用） */
export function setClaimColumnWidths(widths: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY_CLAIM_EXPORT, JSON.stringify(widths));
  } catch (e) {
    console.warn('保存申报页列宽失败', e);
  }
}

export { CLAIM_COLUMN_KEYS, DEFAULT_CLAIM_WIDTHS };

/** 生成按列宽比例的 width 样式（用于 HTML 表），总和 100% */
function claimWidthPercentages(): number[] {
  return widthsToPercentages(getClaimColumnWidths());
}

export function exportClaimToPDF(claim: ClaimDetail, mainTitle: string, companyName = '') {
  const rows = buildClaimTableRows(claim);
  const pcts = claimWidthPercentages();
  const docNo = (claim as any).claim_no ?? (claim as any).doc_no ?? '';

  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th class="col-0">序号</th>
          <th class="col-1">物资名称</th>
          <th class="col-2">分类</th>
          <th class="col-3">规格型号</th>
          <th class="col-4">单位</th>
          <th class="col-5">申报数量</th>
          <th class="col-6">备注</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row: any[]) => `
          <tr>
            <td class="col-0">${row[0]}</td>
            <td class="col-1">${row[1]}</td>
            <td class="col-2">${row[2]}</td>
            <td class="col-3">${row[3]}</td>
            <td class="col-4">${row[4]}</td>
            <td class="col-5">${row[5]}</td>
            <td class="col-6">${row[6]}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const html = generateHTMLTemplate({
    title: mainTitle,
    orientation: 'landscape',
    tableHTML,
    footer: `生成时间：${new Date().toLocaleString('zh-CN')}`,
    columnWidths: pcts,
    customStyles: `
      th { text-align: center; }
      .col-0, .col-4, .col-5 { text-align: center; }
      td.col-0, td.col-4, td.col-5 { text-align: center; }
    `,
  });

  exportHTMLToPDF({
    html,
    filename: getClaimFileName(companyName, docNo, 'pdf'),
    orientation: 'landscape',
    margin: 12,
  });
}

/** 生成导出文件名：{company}_物资申报表_{doc_no}.xlsx/pdf */
export function getClaimExcelFileName(companyName: string, docNo: string): string {
  return getClaimFileName(companyName, docNo, 'xlsx');
}

export async function exportClaimToExcel(claim: ClaimDetail, mainTitle: string, companyName = '') {
  const rows = buildClaimTableRows(claim);
  const docNo = (claim as any).claim_no ?? (claim as any).doc_no ?? '';
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('物资申报表', {
    views: [{ rightToLeft: false }],
    pageSetup: excelPageSetup.landscape,
  });

  const { border, alignCenter, alignCenterWrap, alignLeft, alignRight } = excelStyles;

  const colWidths = getClaimColumnWidths();
  const minWidths = [5, 14, 10, 16, 6, 10, 18];
  ws.columns = colWidths.slice(0, COL_COUNT).map((w, i) => ({ width: Math.max(minWidths[i] ?? 6, Math.round(w)) }));

  // 1) 标题区
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = mainTitle;
  titleRow.getCell(1).alignment = alignCenter;
  titleRow.getCell(1).font = { bold: true, size: 16 };
  ws.mergeCells(1, 1, 1, COL_COUNT);
  titleRow.height = 26;

  // 2) 单据信息区（两行：左列申报单号/日期，右列经办人/备注）
  const doc = claim as any;
  const infoRow1 = ws.getRow(2);
  infoRow1.getCell(1).value = `申报单号：${docNo}`;
  infoRow1.getCell(1).alignment = alignLeft;
  infoRow1.getCell(4).value = `申报日期：${claim.biz_date || ''}`;
  infoRow1.getCell(4).alignment = alignLeft;
  infoRow1.height = 18;
  const infoRow2 = ws.getRow(3);
  infoRow2.getCell(1).value = claim.requester ? `申请人：${claim.requester}` : '';
  infoRow2.getCell(1).alignment = alignLeft;
  infoRow2.getCell(4).value = doc.operator ? `经办人：${doc.operator}` : '';
  infoRow2.getCell(4).alignment = alignLeft;
  if (claim.note) {
    infoRow2.getCell(6).value = `备注：${claim.note}`;
    infoRow2.getCell(6).alignment = alignLeft;
  }
  infoRow2.height = 18;

  ws.getRow(4).height = 6;

  // 3) 明细表头（冻结到此处）
  const headerRowNum = 5;
  const headerRow = ws.getRow(headerRowNum);
  COL_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.border = border;
    cell.alignment = alignCenterWrap;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    cell.font = { bold: true };
  });
  headerRow.height = 22;

  // 4) 明细数据
  const dataStartRow = headerRowNum + 1;
  rows.forEach((row: (string | number)[], idx: number) => {
    const r = ws.getRow(dataStartRow + idx);
    row.forEach((val, c) => {
      const cell = r.getCell(c + 1);
      cell.value = val;
      cell.border = border;
      const isNumCol = c === 0 || c === 5; // 序号、申报数量
      cell.alignment = isNumCol ? alignCenter : alignLeft;
      if (c === 5) cell.numFmt = '0';
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
    });
    r.height = 20;
  });

  // 5) 汇总区
  const totalQty = rows.reduce((sum, r) => sum + (Number(r[5]) || 0), 0);
  const summaryRowNum = dataStartRow + rows.length;
  const summaryRow = ws.getRow(summaryRowNum);
  summaryRow.getCell(1).value = '合计';
  summaryRow.getCell(1).font = { bold: true };
  summaryRow.getCell(1).border = border;
  summaryRow.getCell(1).alignment = alignCenter;
  ws.mergeCells(summaryRowNum, 1, summaryRowNum, 5);
  summaryRow.getCell(6).value = totalQty;
  summaryRow.getCell(6).numFmt = '0';
  summaryRow.getCell(6).font = { bold: true };
  summaryRow.getCell(6).border = border;
  summaryRow.getCell(6).alignment = alignRight;
  summaryRow.getCell(7).border = border;
  summaryRow.height = 20;
  summaryRow.eachCell((cell) => {
    cell.border = { ...cell.border, top: { style: 'medium' as const } };
  });

  // 6) 签字区
  const signRowNum = summaryRowNum + 3;
  ws.getRow(signRowNum).getCell(1).value = '申请人：____________';
  ws.getRow(signRowNum + 1).getCell(1).value = '部门负责人：____________';
  ws.getRow(signRowNum + 2).getCell(1).value = '仓库/审核：____________';
  ws.getRow(signRowNum + 3).getCell(1).value = '日期：____________';

  ws.views = [{ state: 'frozen' as const, ySplit: headerRowNum, activeCell: 'A6' }];
  ws.pageSetup.printTitlesRow = `${headerRowNum}:${headerRowNum}`;

  Object.assign(ws.pageSetup, {
    orientation: 'landscape' as const,
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.6, right: 0.6, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
  });

  await downloadExcel(wb, getClaimExcelFileName(companyName, docNo));
}

export function printClaim(claim: ClaimDetail, mainTitle: string) {
  const rows = buildClaimTableRows(claim);
  const pcts = claimWidthPercentages();

  const tableHTML = `
    <table>
      <thead>
        <tr>
          <th class="col-0">序号</th>
          <th class="col-1">物资名称</th>
          <th class="col-2">分类</th>
          <th class="col-3">规格型号</th>
          <th class="col-4">单位</th>
          <th class="col-5">申报数量</th>
          <th class="col-6">备注</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row: any[]) => `
          <tr>
            <td class="col-0">${row[0]}</td>
            <td class="col-1">${row[1]}</td>
            <td class="col-2">${row[2]}</td>
            <td class="col-3">${row[3]}</td>
            <td class="col-4">${row[4]}</td>
            <td class="col-5">${row[5]}</td>
            <td class="col-6">${row[6]}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const html = generateHTMLTemplate({
    title: mainTitle,
    orientation: 'landscape',
    tableHTML,
    footer: `生成时间：${new Date().toLocaleString('zh-CN')}`,
    columnWidths: pcts,
    customStyles: `
      th { text-align: center; }
      .col-0, .col-4, .col-5 { text-align: center; }
      td.col-0, td.col-4, td.col-5 { text-align: center; }
    `,
  });

  printHTML({ html, title: mainTitle });
}
