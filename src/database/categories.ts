import type { SQLiteDatabase } from 'expo-sqlite';
import type { Category, CategoryType } from '../types';

export interface CreateCategoryInput {
  name: string;
  icon: string;
  type: CategoryType;
}

const DEFAULT_CATEGORIES: Array<{ id: string; name: string; icon: string; type: CategoryType }> = [
  { id: 'digital', name: '数码设备', icon: '📱', type: 'item' },
  { id: 'computer', name: '电脑办公', icon: '💻', type: 'item' },
  { id: 'home', name: '家电家居', icon: '🏠', type: 'item' },
  { id: 'transport', name: '出行装备', icon: '🚗', type: 'item' },
  { id: 'clothing', name: '穿戴配件', icon: '⌚', type: 'item' },
  { id: 'entertainment', name: '影音游戏', icon: '🎮', type: 'item' },
  { id: 'education', name: '学习设备', icon: '🎓', type: 'item' },
  { id: 'sports', name: '运动器材', icon: '🏋️', type: 'item' },
  { id: 'other', name: '其他资产', icon: '📦', type: 'item' },
  { id: 'software', name: '软件服务', icon: '💿', type: 'subscription' },
  { id: 'education', name: '学习订阅', icon: '🎓', type: 'subscription' },
  { id: 'entertainment', name: '影音会员', icon: '🎬', type: 'subscription' },
  { id: 'other', name: '其他服务', icon: '📦', type: 'subscription' },
  { id: 'beauty', name: '护理疗程', icon: '🪪', type: 'stored_card' },
  { id: 'fitness', name: '健身课程', icon: '🏋️', type: 'stored_card' },
  { id: 'food', name: '车主服务', icon: '🔧', type: 'stored_card' },
  { id: 'coffee', name: '出行服务', icon: '🎫', type: 'stored_card' },
  { id: 'other', name: '其他卡包', icon: '💳', type: 'stored_card' },
];

const LEGACY_DEFAULT_CATEGORIES: Array<{
  id: string;
  type: CategoryType;
  previousName: string;
  previousIcon: string;
  nextName: string;
  nextIcon: string;
}> = [
  { id: 'digital', type: 'item', previousName: '数码', previousIcon: '📱', nextName: '数码设备', nextIcon: '📱' },
  { id: 'computer', type: 'item', previousName: '电脑', previousIcon: '💻', nextName: '电脑办公', nextIcon: '💻' },
  { id: 'home', type: 'item', previousName: '居家', previousIcon: '🏠', nextName: '家电家居', nextIcon: '🏠' },
  { id: 'transport', type: 'item', previousName: '出行', previousIcon: '🚗', nextName: '出行装备', nextIcon: '🚗' },
  { id: 'clothing', type: 'item', previousName: '服饰', previousIcon: '👕', nextName: '穿戴配件', nextIcon: '⌚' },
  { id: 'entertainment', type: 'item', previousName: '娱乐', previousIcon: '🎮', nextName: '影音游戏', nextIcon: '🎮' },
  { id: 'education', type: 'item', previousName: '学习', previousIcon: '📚', nextName: '学习设备', nextIcon: '🎓' },
  { id: 'sports', type: 'item', previousName: '运动', previousIcon: '⚽', nextName: '运动器材', nextIcon: '🏋️' },
  { id: 'other', type: 'item', previousName: '其他', previousIcon: '📝', nextName: '其他资产', nextIcon: '📦' },
  { id: 'software', type: 'subscription', previousName: '软件', previousIcon: '💒', nextName: '软件服务', nextIcon: '💿' },
  { id: 'education', type: 'subscription', previousName: '学习', previousIcon: '📚', nextName: '学习订阅', nextIcon: '🎓' },
  { id: 'entertainment', type: 'subscription', previousName: '娱乐', previousIcon: '🎮', nextName: '影音会员', nextIcon: '🎬' },
  { id: 'other', type: 'subscription', previousName: '其他', previousIcon: '📝', nextName: '其他服务', nextIcon: '📦' },
  { id: 'beauty', type: 'stored_card', previousName: '美容', previousIcon: '💆', nextName: '护理疗程', nextIcon: '🪪' },
  { id: 'fitness', type: 'stored_card', previousName: '健身', previousIcon: '🏋️', nextName: '健身课程', nextIcon: '🏋️' },
  { id: 'food', type: 'stored_card', previousName: '餐饮', previousIcon: '🍝', nextName: '车主服务', nextIcon: '🔧' },
  { id: 'coffee', type: 'stored_card', previousName: '咖啡', previousIcon: '☕', nextName: '出行服务', nextIcon: '🎫' },
  { id: 'other', type: 'stored_card', previousName: '其他', previousIcon: '📝', nextName: '其他卡包', nextIcon: '💳' },
];

const LEGACY_RECORD_ICON_MIGRATIONS: Array<{
  table: 'OneTimeItems' | 'Subscriptions' | 'StoredCards';
  categoryId: string;
  previousIcon: string;
  nextIcon: string;
}> = [
  { table: 'OneTimeItems', categoryId: 'clothing', previousIcon: '👕', nextIcon: '⌚' },
  { table: 'OneTimeItems', categoryId: 'education', previousIcon: '📚', nextIcon: '🎓' },
  { table: 'OneTimeItems', categoryId: 'sports', previousIcon: '⚽', nextIcon: '🏋️' },
  { table: 'OneTimeItems', categoryId: 'other', previousIcon: '📝', nextIcon: '📦' },
  { table: 'Subscriptions', categoryId: 'software', previousIcon: '💒', nextIcon: '💿' },
  { table: 'Subscriptions', categoryId: 'education', previousIcon: '📚', nextIcon: '🎓' },
  { table: 'Subscriptions', categoryId: 'entertainment', previousIcon: '🎮', nextIcon: '🎬' },
  { table: 'Subscriptions', categoryId: 'other', previousIcon: '📝', nextIcon: '📦' },
  { table: 'StoredCards', categoryId: 'beauty', previousIcon: '💆', nextIcon: '🪪' },
  { table: 'StoredCards', categoryId: 'beauty', previousIcon: '💇', nextIcon: '🪪' },
  { table: 'StoredCards', categoryId: 'food', previousIcon: '🍝', nextIcon: '🔧' },
  { table: 'StoredCards', categoryId: 'coffee', previousIcon: '☕', nextIcon: '🎫' },
  { table: 'StoredCards', categoryId: 'other', previousIcon: '📝', nextIcon: '💳' },
];

let ensureCategoriesReadyPromise: Promise<void> | null = null;

async function syncLegacyDefaults(db: SQLiteDatabase): Promise<void> {
  for (const category of LEGACY_DEFAULT_CATEGORIES) {
    await db.runAsync(
      `UPDATE Categories
       SET name = ?, icon = ?
       WHERE id = ? AND type = ? AND name = ? AND icon = ?`,
      [
        category.nextName,
        category.nextIcon,
        category.id,
        category.type,
        category.previousName,
        category.previousIcon,
      ],
    );
  }

  for (const migration of LEGACY_RECORD_ICON_MIGRATIONS) {
    await db.runAsync(
      `UPDATE ${migration.table}
       SET icon = ?
       WHERE category = ? AND icon = ?`,
      [migration.nextIcon, migration.categoryId, migration.previousIcon],
    );
  }
}

/**
 * 兜底确保分类表存在且默认分类可用。
 * 用于兼容旧库、初始化中断或热更新后出现的缺表状态。
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

      await syncLegacyDefaults(db);
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

/** 获取指定类型的全部分类。 */
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

/** 新增分类，自动生成 id 以避免冲突。 */
export async function createCategory(
  db: SQLiteDatabase,
  input: CreateCategoryInput,
): Promise<string> {
  await ensureCategoriesTable(db);
  const name = input.name.trim();
  if (!name) throw new Error('分类名称不能为空');

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = generateCategoryId();
    try {
      await db.runAsync(
        `INSERT INTO Categories (id, name, icon, type) VALUES (?, ?, ?, ?)`,
        [id, name, input.icon, input.type],
      );
      return id;
    } catch (error) {
      if (attempt === 4) throw error;
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
