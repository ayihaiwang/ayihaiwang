import React from 'react';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import 'react-resizable/css/styles.css';

interface ResizableTitleProps {
  onResize: (e: React.SyntheticEvent, data: ResizeCallbackData) => void;
  width: number;
  minWidth?: number;
  [key: string]: any;
}

export function ResizableTitle(props: ResizableTitleProps) {
  const { onResize, width, minWidth = 60, style, ...rest } = props;
  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', right: 0, bottom: 0, width: 10, height: '100%', cursor: 'col-resize', zIndex: 1 }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
      minConstraints={[minWidth, Infinity]}
      maxConstraints={[Infinity, Infinity]}
    >
      <th {...rest} style={{ ...style, width, minWidth, position: 'relative' }} />
    </Resizable>
  );
}

export const STORAGE_KEY_INVENTORY_COLUMNS = 'inventory_column_widths';
export const STORAGE_KEY_CLAIM_EXPORT_COLUMNS = 'claim_export_column_widths';

export function getStoredColumnWidths<T extends Record<string, number>>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function setStoredColumnWidths(key: string, widths: Record<string, number>) {
  try {
    localStorage.setItem(key, JSON.stringify(widths));
  } catch (e) {
    console.warn('保存列宽失败', e);
  }
}
