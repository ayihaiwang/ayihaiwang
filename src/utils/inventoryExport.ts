import ExcelJS from 'exceljs';
import type { StockRow } from '../vite-env.d';
import { getInventoryExportColumnWidths, getInventoryExportWidthPercentages, EXPORT_COLUMN_KEYS } from './inventoryColumnWidths';
import { getInventoryFileName } from './exportFileName';
import {
  exportHTMLToPDF,
  printHTML,
  generateHTMLTemplate,
  excelStyles,
  excelPageSetup,
  downloadExcel,
} from './exportUtils';

const INVENTORY_COLUMN_TITLES: Record<string, string> = {
  name: '物资名称',
  category_name: '物品分类',
  spec: '规格型号',
  unit: '单位',
  qty: '当前数量',
  min_stock: '最低预警',
  last_in_date: '最近入库日期',
  updated_at: '更新时间',
};


export function exportInventoryToPDF(list: StockRow[], companyName = '') {
  const mainTitle = (companyName || '').trim() ? `${companyName.trim()}库存总表` : '库存总表';
  const pcts = getInventoryExportWidthPercentages();
  const headerCells = EXPORT_COLUMN_KEYS.map((key, i) => `<th class="col-${i}">${INVENTORY_COLUMN_TITLES[key]}</th>`).join('');
  const rows = list.map(
    (row) =>
      `<tr>
        <td class="col-0">${row.name || ''}</td>
        <td class="col-1">${row.category_name ?? ''}</td>
        <td class="col-2">${row.spec ?? ''}</td>
        <td class="col-3">${row.unit || ''}</td>
        <td class="col-4">${row.qty ?? ''}</td>
        <td class="col-5">${row.min_stock ?? ''}</td>
        <td class="col-6">${row.last_in_date ?? ''}</td>
        <td class="col-7">${row.updated_at ?? ''}</td>
      </tr>`
  ).join('');

  const tableHTML = `
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = generateHTMLTemplate({
    title: mainTitle,
    orientation: 'portrait',
    tableHTML,
    footer: `生成时间：${new Date().toLocaleString('zh-CN')} | 共 ${list.length} 条`,
    columnWidths: pcts,
    customStyles: `
      th, td { padding: 4px 6px; }
      .footer { font-size: 11px; }
    `,
  });

  exportHTMLToPDF({
    html,
    filename: getInventoryFileName(companyName, new Date().toISOString().slice(0, 10), 'pdf'),
    orientation: 'portrait',
  });
}

export async function exportInventoryToExcel(list: StockRow[], companyName = '') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('库存总表', {
    views: [{ rightToLeft: false }],
    pageSetup: excelPageSetup.portrait,
  });

  const { border } = excelStyles;

  const excelWidths = getInventoryExportColumnWidths();
  ws.columns = excelWidths.map((w) => ({ width: w }));

  const colCount = EXPORT_COLUMN_KEYS.length;
  const mainTitle = (companyName || '').trim() ? `${companyName.trim()}库存总表` : '库存总表';
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = mainTitle;
  titleRow.getCell(1).font = excelStyles.titleFont;
  titleRow.getCell(1).alignment = excelStyles.alignCenter;
  ws.mergeCells(1, 1, 1, colCount);
  titleRow.height = 26;

  ws.getRow(2).getCell(1).value = '生成时间';
  ws.getRow(2).getCell(2).value = new Date().toLocaleString('zh-CN');
  ws.getRow(3).height = 6;

  const headerRowNum = 4;
  const headerRow = ws.getRow(headerRowNum);
  EXPORT_COLUMN_KEYS.forEach((key, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = INVENTORY_COLUMN_TITLES[key];
    cell.border = border;
    cell.alignment = excelStyles.alignCenterWrap;
    cell.fill = excelStyles.headerFill;
    cell.font = excelStyles.headerFont;
  });
  headerRow.height = 22;

  const dataStartRow = 5;
  list.forEach((row, idx) => {
    const r = ws.getRow(dataStartRow + idx);
    EXPORT_COLUMN_KEYS.forEach((colKey, c) => {
      const cell = r.getCell(c + 1);
      let val: string | number = (row as any)[colKey] ?? '';
      const isNum = colKey === 'qty' || colKey === 'min_stock';
      const isDate = colKey === 'last_in_date' || colKey === 'updated_at';
      if (isNum) {
        const n = Number(val);
        cell.value = typeof val === 'number' || val === '' ? val : n;
        cell.numFmt = '0';
      } else {
        cell.value = String(val);
      }
      cell.border = border;
      cell.alignment = {
        vertical: 'middle',
        horizontal: isNum ? 'right' : isDate ? 'center' : 'left',
        wrapText: true,
      };
    });
    r.height = 18;
  });

  ws.views = [{ state: 'frozen' as const, ySplit: headerRowNum, activeCell: 'A5' }];
  ws.pageSetup.printTitlesRow = `${headerRowNum}:${headerRowNum}`;

  Object.assign(ws.pageSetup, excelPageSetup.portrait);

  await downloadExcel(wb, getInventoryFileName(companyName, new Date().toISOString().slice(0, 10), 'xlsx'));
}

export function printInventory(list: StockRow[], companyName = '') {
  const mainTitle = (companyName || '').trim() ? `${companyName.trim()}库存总表` : '库存总表';
  const pcts = getInventoryExportWidthPercentages();
  const headerCells = EXPORT_COLUMN_KEYS.map((key, i) => `<th class="col-${i}">${INVENTORY_COLUMN_TITLES[key]}</th>`).join('');
  const rows = list.map(
    (row) =>
      `<tr>
        <td class="col-0">${row.name || ''}</td>
        <td class="col-1">${row.category_name ?? ''}</td>
        <td class="col-2">${row.spec ?? ''}</td>
        <td class="col-3">${row.unit || ''}</td>
        <td class="col-4">${row.qty ?? ''}${row.min_stock > 0 && row.qty < row.min_stock ? ' (低于预警)' : ''}</td>
        <td class="col-5">${row.min_stock ?? ''}</td>
        <td class="col-6">${row.last_in_date ?? ''}</td>
        <td class="col-7">${row.updated_at ?? ''}</td>
      </tr>`
  ).join('');

  const tableHTML = `
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const html = generateHTMLTemplate({
    title: mainTitle,
    orientation: 'portrait',
    tableHTML,
    footer: `生成时间：${new Date().toLocaleString('zh-CN')} | 共 ${list.length} 条`,
    columnWidths: pcts,
    customStyles: `
      th, td { border: 1px solid #ddd; }
      th { background-color: #f2f2f2; }
    `,
  });

  printHTML({ html, title: mainTitle });
}
