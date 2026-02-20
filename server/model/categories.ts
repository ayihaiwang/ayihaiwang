/**
 * 分类模型
 */
import { getDb } from './db';

export interface Category {
  id: number;
  name: string;
  created_at: string;
}

export function categoriesList(): Category[] {
  const d = getDb();
  return d.prepare('SELECT * FROM categories ORDER BY name').all() as Category[];
}

export function categoryCreate(name: string): { id: number; name: string } | { error: string; existingId: number } {
  const d = getDb();
  try {
    const r = d.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    return { id: Number(r.lastInsertRowid), name };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // 查找已存在的分类
      const existing = d.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number } | undefined;
      if (existing) {
        return { error: 'NAME_EXISTS', existingId: existing.id };
      }
      throw new Error('分类名称已存在');
    }
    throw e;
  }
}

export function categoryGet(id: number): Category | null {
  const d = getDb();
  return d.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Category | null;
}
