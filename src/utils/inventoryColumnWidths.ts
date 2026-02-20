/**
 * 库存总表列宽管理
 * localStorage key: inventory_column_width_v1
 * 格式: [{ key, width }, ...] 或 Record<string, number>（兼容）
 */
const STORAGE_KEY = 'inventory_column_width_v1';

export const DEFAULT_INVENTORY_COLUMN_WIDTHS: Record<string, number> = {
  name: 120,
  category_name: 100,
  spec: 120,
  unit: 80,
  qty: 100,
  min_stock: 90,
  last_in_date: 120,
  updated_at: 160,
  detail: 90,
};

/** 导出自用列顺序（不含 detail） */
export const EXPORT_COLUMN_KEYS = ['name', 'category_name', 'spec', 'unit', 'qty', 'min_stock', 'last_in_date', 'updated_at'];

function parseStoredWidths(raw: string | null): Record<string, number> {
  if (!raw) return { ...DEFAULT_INVENTORY_COLUMN_WIDTHS };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const out = { ...DEFAULT_INVENTORY_COLUMN_WIDTHS };
      (parsed as { key: string; width: number }[]).forEach(({ key, width }) => {
        if (key && typeof width === 'number') out[key] = width;
      });
      return out;
    }
    if (parsed && typeof parsed === 'object') {
      return { ...DEFAULT_INVENTORY_COLUMN_WIDTHS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_INVENTORY_COLUMN_WIDTHS };
}

export function getInventoryColumnWidths(): Record<string, number> {
  return parseStoredWidths(localStorage.getItem(STORAGE_KEY));
}

export function setInventoryColumnWidths(widths: Record<string, number>) {
  try {
    const arr = Object.entries(widths).map(([key, width]) => ({ key, width }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.warn('保存库存列宽失败', e);
  }
}

export function clearInventoryColumnWidths() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 导出用：从 localStorage 读取列宽，转换为 Excel 列宽（像素/7.5） */
export function getInventoryExportColumnWidths(): number[] {
  const stored = getInventoryColumnWidths();
  return EXPORT_COLUMN_KEYS.map((key) => {
    const px = stored[key] ?? DEFAULT_INVENTORY_COLUMN_WIDTHS[key];
    return Math.max(6, Math.round((px ?? 100) / 7.5));
  });
}

/** 导出用：从 localStorage 读取列宽，转换为百分比数组（用于 PDF/打印） */
export function getInventoryExportWidthPercentages(): number[] {
  const stored = getInventoryColumnWidths();
  const widths = EXPORT_COLUMN_KEYS.map((key) => stored[key] ?? DEFAULT_INVENTORY_COLUMN_WIDTHS[key] ?? 100);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  return widths.map((w) => (w / total) * 100);
}
