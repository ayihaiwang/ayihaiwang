/**
 * 操作员模型
 */
import { getDb } from './db';

export interface Operator {
  id: number;
  name: string;
  created_at: string;
}

export function operatorsList(): Operator[] {
  const d = getDb();
  // 从 operators_v2 表获取，如果没有则从旧表获取
  const fromV2 = d.prepare('SELECT * FROM operators_v2 ORDER BY name').all() as Operator[];
  if (fromV2.length > 0) {
    return fromV2;
  }
  // 兼容旧表
  const fromOld = d.prepare('SELECT * FROM operators ORDER BY name').all() as Operator[];
  return fromOld;
}

export function operatorCreate(name: string): { ok: boolean } {
  const d = getDb();
  try {
    d.prepare('INSERT INTO operators_v2 (name) VALUES (?)').run(name);
    return { ok: true };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: true }; // 已存在，不报错
    }
    throw e;
  }
}
