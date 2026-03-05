import type { SQLiteDatabase } from 'expo-sqlite';
import type { Category, CategoryType } from '../types';

export interface CreateCategoryInput {
  name: string;
  icon: string;
  type: CategoryType;
}

const DEFAULT_CATEGORIES: Array<{ id: string; name: string; icon: string; type: CategoryType }> = [
  { id: 'digital', name: '数码', icon: '📱', type: 'item' },
  { id: 'computer', name: '电脑', icon: '💻', type: 'item' },
  { id: 'home', name: '居家', icon: '🏠', type: 'item' },
  { id: 'transport', name: '出行', icon: '🚗', type: 'item' },
  { id: 'clothing', name: '服饰', icon: '👕', type: 'item' },
  { id: 'entertainment', name: '娱乐', icon: '🎮', type: 'item' },
  { id: 'education', name: '学习', icon: '📚', type: 'item' },
  { id: 'sports', name: '运动', icon: '⚽', type: 'item' },
  { id: 'other', name: '其他', icon: '📝', type: 'item' },
  { id: 'software', name: '软件', icon: '💒', type: 'subscription' },
  { id: 'education', name: '学习', icon: '📚', type: 'subscription' },
  { id: 'entertainment', name: '娱乐', icon: '🎮', type: 'subscription' },
  { id: 'other', name: '其他', icon: '📝', type: 'subscription' },
  { id: 'beauty', name: '美容', icon: '💆', type: 'stored_card' },
  { id: 'fitness', name: '健身', icon: '🏋️', type: 'stored_card' },
  { id: 'food', name: '餐饮', icon: '🍝', type: 'stored_card' },
  { id: 'coffee', name: '咖啡', icon: '☕', type: 'stored_card' },
  { id: 'other', name: '其他', icon: '📝', type: 'stored_card' },
];

let ensureCategoriesReadyPromise: Promise<void> | null = null;

/**
 * 兜底确保分类表存在且默认分类可用。
 * 用于兼容旧库、异常中断初始化或热更新后出现的缺表状态。
 */
export async function ensureCategoriesTable(db: SQLiteDatabase): Promise<void> {
  if (!ensureCategoriesReadyPromise) {
    ensureCategoriesReadyPromise = (async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS Categories (
          id   TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('item', 'subscription', 'stored_card')),
          PRIMARY KEY (id, type)
        );

        CREATE INDEX IF NOT EXISTS idx_categories_type ON Categories(type);
      `);

      for (const category of DEFAULT_CATEGORIES) {
        await db.runAsync(
          `INSERT OR IGNORE INTO Categories (id, name, icon, type) VALUES (?, ?, ?, ?)`,
          [category.id, category.name, category.icon, category.type],
        );
      }
    })().finally(() => {
      ensureCategoriesReadyPromise = null;
    });
  }

  await ensureCategoriesReadyPromise;
}

function generateCategoryId(): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `cat_${Date.now().toString(36)}_${rand}`;
}

/** 获取指定类型（物品/订阅）的全部分类 */
export async function getCategories(
  db: SQLiteDatabase,
  type: CategoryType,
): Promise<Category[]> {
  await ensureCategoriesTable(db);
  return db.getAllAsync<Category>(
    `SELECT id, name, icon, type FROM Categories WHERE type = ? ORDER BY name ASC`,
    [type],
  );
}

/** 新增分类（自动生成 id，避免冲突） */
export async function createCategory(
  db: SQLiteDatabase,
  input: CreateCategoryInput,
): Promise<string> {
  await ensureCategoriesTable(db);
  const name = input.name.trim();
  if (!name) throw new Error('分类名称不能为空');

  // 极小概率碰撞：最多重试 5 次
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateCategoryId();
    try {
      await db.runAsync(
        `INSERT INTO Categories (id, name, icon, type) VALUES (?, ?, ?, ?)`,
        [id, name, input.icon, input.type],
      );
      return id;
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }

  throw new Error('创建分类失败，请重试');
}

export interface UpdateCategoryInput {
  id: string;
  type: CategoryType;
  name: string;
  icon: string;
}

export async function updateCategory(
  db: SQLiteDatabase,
  input: UpdateCategoryInput,
): Promise<void> {
  await ensureCategoriesTable(db);
  const name = input.name.trim();
  if (!name) throw new Error('分类名称不能为空');

  await db.runAsync(
    `UPDATE Categories
     SET name = ?, icon = ?
     WHERE id = ? AND type = ?`,
    [name, input.icon, input.id, input.type],
  );
}

function resolveUsageTable(type: CategoryType): string {
  if (type === 'item') return 'OneTimeItems';
  if (type === 'subscription') return 'Subscriptions';
  return 'StoredCards';
}

export async function getCategoryUsageCount(
  db: SQLiteDatabase,
  type: CategoryType,
  categoryId: string,
): Promise<number> {
  const tableName = resolveUsageTable(type);
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE category = ?`,
    [categoryId],
  );
  return row?.count ?? 0;
}

export async function deleteCategory(
  db: SQLiteDatabase,
  type: CategoryType,
  categoryId: string,
): Promise<void> {
  await ensureCategoriesTable(db);
  await db.runAsync(
    `DELETE FROM Categories WHERE id = ? AND type = ?`,
    [categoryId, type],
  );
}
