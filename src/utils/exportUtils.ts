import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { downloadPdfAsFile } from './pdfDownload';

/**
 * PDF导出配置选项
 */
export interface PDFExportOptions {
  /** 页面方向：'portrait' 纵向 | 'landscape' 横向 */
  orientation?: 'portrait' | 'landscape';
  /** 页面边距（mm） */
  margin?: number;
  /** HTML内容 */
  html: string;
  /** 文件名 */
  filename: string;
  /** 缩放比例，默认2 */
  scale?: number;
}

/**
 * 通用PDF导出函数
 * 使用html2canvas将HTML转换为图片，然后生成PDF
 */
export function exportHTMLToPDF(options: PDFExportOptions) {
  const { html, filename, orientation = 'portrait', margin = 10, scale = 2 } = options;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      html2canvas(printWindow.document.body, { scale }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF(orientation === 'landscape' ? 'l' : 'p', 'mm', 'a4');
        const pageWidth = orientation === 'landscape' ? 297 : 210;
        const pageHeight = orientation === 'landscape' ? 210 : 297;
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - margin * 2;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage(orientation === 'landscape' ? 'l' : 'p', 'a4');
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
          heightLeft -= pageHeight - margin * 2;
        }

        downloadPdfAsFile(pdf, filename);
        printWindow.close();
      });
    }, 500);
  };
}

/**
 * 打印配置选项
 */
export interface PrintOptions {
  /** HTML内容 */
  html: string;
  /** 窗口标题 */
  title?: string;
}

/**
 * 通用打印函数
 * 打开新窗口并调用浏览器打印
 */
export function printHTML(options: PrintOptions) {
  const { html, title = '打印' } = options;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

/**
 * Excel导出通用样式配置
 */
export const excelStyles = {
  /** 细边框 */
  borderThin: { style: 'thin' as const },
  /** 完整边框 */
  border: {
    top: { style: 'thin' as const },
    left: { style: 'thin' as const },
    bottom: { style: 'thin' as const },
    right: { style: 'thin' as const },
  },
  /** 居中对齐 */
  alignCenter: { vertical: 'middle' as const, horizontal: 'center' as const },
  /** 居中并自动换行 */
  alignCenterWrap: { vertical: 'middle' as const, horizontal: 'center' as const, wrapText: true },
  /** 左对齐并自动换行 */
  alignLeft: { vertical: 'middle' as const, horizontal: 'left' as const, wrapText: true },
  /** 右对齐并自动换行 */
  alignRight: { vertical: 'middle' as const, horizontal: 'right' as const, wrapText: true },
  /** 表头填充色 */
  headerFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8E8E8' } },
  /** 表头字体 */
  headerFont: { bold: true },
  /** 标题字体 */
  titleFont: { bold: true, size: 16 },
};

/**
 * Excel页面设置配置
 */
export const excelPageSetup = {
  /** 纵向A4 */
  portrait: {
    orientation: 'portrait' as const,
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.6, right: 0.6, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    horizontalCentered: true,
  },
  /** 横向A4 */
  landscape: {
    orientation: 'landscape' as const,
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.6, right: 0.6, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    horizontalCentered: true,
  },
};

/**
 * Excel导出配置选项
 */
export interface ExcelExportOptions {
  /** 工作表名称 */
  sheetName: string;
  /** 标题 */
  title: string;
  /** 列配置 */
  columns: Array<{
    /** 列宽 */
    width: number;
    /** 列标题 */
    header?: string;
  }>;
  /** 数据行 */
  rows: Array<Array<string | number>>;
  /** 页面方向 */
  orientation?: 'portrait' | 'landscape';
  /** 冻结行号（表头行号，从1开始） */
  freezeRow?: number;
  /** 是否添加合计行 */
  showTotal?: boolean;
  /** 合计列索引（需要合计的列，从0开始） */
  totalColumns?: number[];
}

/**
 * 创建Excel工作表并应用通用样式
 */
export function createExcelWorksheet(
  workbook: ExcelJS.Workbook,
  options: ExcelExportOptions
): ExcelJS.Worksheet {
  const {
    sheetName,
    title,
    columns,
    rows,
    orientation = 'portrait',
    freezeRow,
    showTotal = false,
    totalColumns = [],
  } = options;

  const ws = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: false }],
    pageSetup: orientation === 'landscape' ? excelPageSetup.landscape : excelPageSetup.portrait,
  });

  // 设置列宽
  ws.columns = columns.map((col) => ({ width: col.width }));

  // 标题行
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = excelStyles.titleFont;
  titleRow.getCell(1).alignment = excelStyles.alignCenter;
  ws.mergeCells(1, 1, 1, columns.length);
  titleRow.height = 26;

  // 表头行
  const headerRowNum = 3;
  const headerRow = ws.getRow(headerRowNum);
  columns.forEach((col, i) => {
    if (col.header) {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.border = excelStyles.border;
      cell.alignment = excelStyles.alignCenterWrap;
      cell.fill = excelStyles.headerFill;
      cell.font = excelStyles.headerFont;
    }
  });
  headerRow.height = 22;

  // 数据行
  const dataStartRow = headerRowNum + 1;
  rows.forEach((row, idx) => {
    const r = ws.getRow(dataStartRow + idx);
    row.forEach((val, c) => {
      const cell = r.getCell(c + 1);
      cell.value = val;
      cell.border = excelStyles.border;
      cell.alignment = excelStyles.alignLeft;
      // 奇偶行背景色
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
      }
    });
    r.height = 20;
  });

  // 合计行
  if (showTotal && rows.length > 0) {
    const totalRowNum = dataStartRow + rows.length;
    const totalRow = ws.getRow(totalRowNum);
    totalRow.getCell(1).value = '合计';
    totalRow.getCell(1).font = excelStyles.headerFont;
    totalRow.getCell(1).border = excelStyles.border;
    totalRow.getCell(1).alignment = excelStyles.alignCenter;
    
    // 合并合计行的前几列
    const mergeCols = Math.min(columns.length - totalColumns.length, columns.length - 1);
    if (mergeCols > 0) {
      ws.mergeCells(totalRowNum, 1, totalRowNum, mergeCols);
    }

    // 计算合计
    totalColumns.forEach((colIdx) => {
      const total = rows.reduce((sum, row) => sum + (Number(row[colIdx]) || 0), 0);
      const cell = totalRow.getCell(colIdx + 1);
      cell.value = total;
      cell.numFmt = '0';
      cell.font = excelStyles.headerFont;
      cell.border = excelStyles.border;
      cell.alignment = excelStyles.alignRight;
    });

    // 填充剩余列
    for (let c = mergeCols + 1; c <= columns.length; c++) {
      if (!totalColumns.includes(c - 1)) {
        totalRow.getCell(c).border = excelStyles.border;
      }
    }
    totalRow.height = 20;
    // 合计行上边框加粗
    totalRow.eachCell((cell) => {
      if (cell.border) {
        cell.border = { ...cell.border, top: { style: 'medium' as const } };
      }
    });
  }

  // 冻结行
  if (freezeRow) {
    ws.views = [{ state: 'frozen' as const, ySplit: freezeRow, activeCell: `A${freezeRow + 1}` }];
    ws.pageSetup.printTitlesRow = `${freezeRow}:${freezeRow}`;
  }

  return ws;
}

/**
 * 下载Excel文件
 */
export async function downloadExcel(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

/**
 * HTML模板生成配置
 */
export interface HTMLTemplateOptions {
  /** 标题 */
  title: string;
  /** 页面方向 */
  orientation?: 'portrait' | 'landscape';
  /** 表格HTML */
  tableHTML: string;
  /** 额外的HTML内容（在表格之前） */
  extraHTML?: string;
  /** 页脚内容 */
  footer?: string;
  /** 列宽百分比数组（用于生成列样式） */
  columnWidths?: number[];
  /** 自定义样式 */
  customStyles?: string;
}

/**
 * 生成打印/PDF导出的HTML模板
 */
export function generateHTMLTemplate(options: HTMLTemplateOptions): string {
  const {
    title,
    orientation = 'portrait',
    tableHTML,
    extraHTML = '',
    footer,
    columnWidths = [],
    customStyles = '',
  } = options;

  const colStyles =
    columnWidths.length > 0
      ? columnWidths.map((p, i) => `.col-${i} { width: ${p.toFixed(2)}%; }`).join('\n        ')
      : '';

  const pageSize = orientation === 'landscape' ? 'A4 landscape' : 'A4';
  const margin = orientation === 'landscape' ? '12mm' : '10mm';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page { size: ${pageSize}; margin: ${margin}; }
        body { font-family: Arial, "Microsoft YaHei", sans-serif; padding: ${orientation === 'landscape' ? '16px' : '20px'}; font-size: 12px; }
        h1 { text-align: center; margin-bottom: ${orientation === 'landscape' ? '16px' : '20px'}; font-size: 16px; font-weight: bold; }
        h2 { margin-top: 20px; margin-bottom: 10px; font-size: 14px; font-weight: bold; }
        .info { margin-bottom: 15px; }
        .info p { margin: 5px 0; }
        thead { display: table-header-group; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 30px; table-layout: fixed; }
        th, td { border: 1px solid #333; padding: ${orientation === 'landscape' ? '6px 8px' : '8px'}; text-align: left; }
        th { background-color: ${orientation === 'landscape' ? '#f0f0f0' : '#e8e8e8'}; font-weight: bold; }
        ${colStyles}
        .footer { margin-top: ${orientation === 'landscape' ? '16px' : '30px'}; font-size: 12px; color: #666; }
        @media print { body { padding: 0; } .no-print { display: none; } }
        ${customStyles}
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      ${extraHTML}
      ${tableHTML}
      ${footer ? `<div class="footer">${footer}</div>` : ''}
    </body>
    </html>
  `;
}

/**
 * 将列宽数组转换为百分比数组
 */
export function widthsToPercentages(widths: number[]): number[] {
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  return widths.map((w) => (w / total) * 100);
}
