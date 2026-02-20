import ExcelJS from 'exceljs';
import type { DailyRow, TopItemRow, MovementRow } from '../vite-env.d';
import { getReportFileName } from './exportFileName';
import {
  exportHTMLToPDF,
  printHTML,
  generateHTMLTemplate,
  excelStyles,
  excelPageSetup,
  downloadExcel,
} from './exportUtils';

interface ReportData {
  dateRange: [string, string];
  daily: DailyRow[];
  topIn: TopItemRow[];
  topOut: TopItemRow[];
  movements: MovementRow[];
  itemId?: number;
  operator?: string;
}

const { border } = excelStyles;

export function exportReportToPDF(data: ReportData, companyName = '') {
  const mainTitle = (companyName || '').trim() ? `${companyName.trim()}统计报表` : '统计报表';

  const extraHTML = `
    <div class="info">
      <p><strong>日期范围：</strong>${data.dateRange[0]} 至 ${data.dateRange[1]}</p>
      ${data.itemId ? `<p><strong>物资筛选：</strong>已选择</p>` : ''}
      ${data.operator ? `<p><strong>经办人：</strong>${data.operator}</p>` : ''}
    </div>
    
    ${data.daily.length > 0 ? `
    <h2>按天入库/出库统计</h2>
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>入库</th>
          <th>出库</th>
        </tr>
      </thead>
      <tbody>
        ${data.daily.map((row) => `
          <tr>
            <td>${row.date || ''}</td>
            <td>${row.in_qty || 0}</td>
            <td>${row.out_qty || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${data.topOut.length > 0 ? `
    <h2>Top10 物资出库量</h2>
    <table>
      <thead>
        <tr>
          <th>物资名称</th>
          <th>出库量</th>
        </tr>
      </thead>
      <tbody>
        ${data.topOut.map((row) => `
          <tr>
            <td>${row.item_name || ''}</td>
            <td>${row.total_qty || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${data.movements.length > 0 ? `
    <h2>明细列表（前${Math.min(50, data.movements.length)}条）</h2>
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>类型</th>
          <th>物资名称</th>
          <th>数量</th>
          <th>经办人</th>
        </tr>
      </thead>
      <tbody>
        ${data.movements.slice(0, 50).map((row) => `
          <tr>
            <td>${row.biz_date || ''}</td>
            <td>${row.type === 'IN' ? '入库' : '出库'}</td>
            <td>${row.item_name || ''}</td>
            <td>${row.qty || 0}</td>
            <td>${row.operator || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
  `;

  const html = generateHTMLTemplate({
    title: mainTitle,
    orientation: 'portrait',
    tableHTML: '',
    extraHTML,
    footer: `<p>生成时间：${new Date().toLocaleString('zh-CN')}</p>`,
  });

  exportHTMLToPDF({
    html,
    filename: getReportFileName(companyName, data.dateRange[0], data.dateRange[1], 'pdf'),
    orientation: 'portrait',
  });
}

export async function exportReportToExcel(data: ReportData, companyName = '') {
  const wb = new ExcelJS.Workbook();
  const mainTitle = (companyName || '').trim() ? `${companyName.trim()}统计报表` : '统计报表';

  const addSheetPageSetup = (ws: ExcelJS.Worksheet, headerRowNum?: number) => {
    Object.assign(ws.pageSetup, excelPageSetup.portrait);
    if (headerRowNum) {
      ws.views = [{ state: 'frozen' as const, ySplit: headerRowNum, activeCell: `A${headerRowNum + 1}` }];
      ws.pageSetup.printTitlesRow = `${headerRowNum}:${headerRowNum}`;
    }
  };

  // Sheet 1: 按天统计
  const ws1 = wb.addWorksheet('按天统计', { views: [{ rightToLeft: false }] });
  ws1.getRow(1).getCell(1).value = mainTitle;
  ws1.getRow(1).getCell(1).font = excelStyles.titleFont;
  ws1.getRow(1).getCell(1).alignment = excelStyles.alignCenter;
  ws1.mergeCells(1, 1, 1, 3);
  ws1.getRow(2).getCell(1).value = '日期范围';
  ws1.getRow(2).getCell(2).value = `${data.dateRange[0]} 至 ${data.dateRange[1]}`;
  ws1.getRow(4).getCell(1).value = '日期';
  ws1.getRow(4).getCell(2).value = '入库';
  ws1.getRow(4).getCell(3).value = '出库';
  [1, 2, 3].forEach((c) => {
    const cell = ws1.getRow(4).getCell(c);
    cell.border = border;
    cell.fill = excelStyles.headerFill;
    cell.font = excelStyles.headerFont;
  });
  data.daily.forEach((row, i) => {
    const r = ws1.getRow(5 + i);
    r.getCell(1).value = row.date || '';
    r.getCell(2).value = row.in_qty || 0;
    r.getCell(3).value = row.out_qty || 0;
    [1, 2, 3].forEach((c) => r.getCell(c).border = border);
  });
  addSheetPageSetup(ws1, 4);

  // Sheet 2: Top10 出库
  if (data.topOut.length > 0) {
    const ws2 = wb.addWorksheet('Top10出库', { views: [{ rightToLeft: false }] });
    ws2.getRow(1).getCell(1).value = 'Top10 物资出库量';
    ws2.getRow(1).getCell(1).font = excelStyles.titleFont;
    ws2.getRow(3).getCell(1).value = '物资名称';
    ws2.getRow(3).getCell(2).value = '出库量';
    [1, 2].forEach((c) => {
      const cell = ws2.getRow(3).getCell(c);
      cell.border = border;
      cell.fill = excelStyles.headerFill;
      cell.font = excelStyles.headerFont;
    });
    data.topOut.forEach((row, i) => {
      const r = ws2.getRow(4 + i);
      r.getCell(1).value = row.item_name || '';
      r.getCell(2).value = row.total_qty || 0;
      [1, 2].forEach((c) => r.getCell(c).border = border);
    });
    addSheetPageSetup(ws2, 3);
  }

  // Sheet 3: 明细列表
  const ws3 = wb.addWorksheet('明细列表', { views: [{ rightToLeft: false }] });
  ws3.getRow(1).getCell(1).value = '明细列表';
  ws3.getRow(1).getCell(1).font = excelStyles.titleFont;
  ws3.getRow(2).getCell(1).value = '日期范围';
  ws3.getRow(2).getCell(2).value = `${data.dateRange[0]} 至 ${data.dateRange[1]}`;
  const headerRowNum = 5;
  const moveHeaders = ['日期', '类型', '物资名称', '数量', '经办人', '备注'];
  moveHeaders.forEach((h, c) => {
    const cell = ws3.getRow(headerRowNum).getCell(c + 1);
    cell.value = h;
    cell.border = border;
    cell.fill = excelStyles.headerFill;
    cell.font = excelStyles.headerFont;
  });
  data.movements.forEach((row, i) => {
    const r = ws3.getRow(headerRowNum + 1 + i);
    r.getCell(1).value = row.biz_date || '';
    r.getCell(2).value = row.type === 'IN' ? '入库' : '出库';
    r.getCell(3).value = row.item_name || '';
    r.getCell(4).value = row.qty || 0;
    r.getCell(5).value = row.operator || '';
    r.getCell(6).value = row.note || '';
    for (let c = 1; c <= 6; c++) r.getCell(c).border = border;
  });
  addSheetPageSetup(ws3, headerRowNum);

  await downloadExcel(wb, getReportFileName(companyName, data.dateRange[0], data.dateRange[1], 'xlsx'));
}

export function printReport(data: ReportData, companyName = '') {
  const mainTitle = (companyName || '').trim() ? `${companyName.trim()}统计报表` : '统计报表';

  const extraHTML = `
    <div class="info">
      <p><strong>日期范围：</strong>${data.dateRange[0]} 至 ${data.dateRange[1]}</p>
      ${data.itemId ? `<p><strong>物资筛选：</strong>已选择</p>` : ''}
      ${data.operator ? `<p><strong>经办人：</strong>${data.operator}</p>` : ''}
    </div>
    
    ${data.daily.length > 0 ? `
    <h2>按天入库/出库统计</h2>
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>入库</th>
          <th>出库</th>
        </tr>
      </thead>
      <tbody>
        ${data.daily.map((row) => `
          <tr>
            <td>${row.date || ''}</td>
            <td>${row.in_qty || 0}</td>
            <td>${row.out_qty || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${data.topOut.length > 0 ? `
    <h2>Top10 物资出库量</h2>
    <table>
      <thead>
        <tr>
          <th>物资名称</th>
          <th>出库量</th>
        </tr>
      </thead>
      <tbody>
        ${data.topOut.map((row) => `
          <tr>
            <td>${row.item_name || ''}</td>
            <td>${row.total_qty || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
    
    ${data.movements.length > 0 ? `
    <h2>明细列表</h2>
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>类型</th>
          <th>物资名称</th>
          <th>数量</th>
          <th>经办人</th>
          <th>备注</th>
        </tr>
      </thead>
      <tbody>
        ${data.movements.map((row) => `
          <tr>
            <td>${row.biz_date || ''}</td>
            <td>${row.type === 'IN' ? '入库' : '出库'}</td>
            <td>${row.item_name || ''}</td>
            <td>${row.qty || 0}</td>
            <td>${row.operator || ''}</td>
            <td>${row.note || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
  `;

  const html = generateHTMLTemplate({
    title: mainTitle,
    orientation: 'portrait',
    tableHTML: '',
    extraHTML,
    footer: `<p>生成时间：${new Date().toLocaleString('zh-CN')}</p>`,
    customStyles: `
      th, td { border: 1px solid #ddd; }
      th { background-color: #f2f2f2; }
    `,
  });

  printHTML({ html, title: mainTitle });
}
