import type { SQLiteDatabase } from 'expo-sqlite';
import type { Subscription, SubscriptionInput } from '../types';

/** 获取全部订阅（active 优先，按开始日期倒序） */
export async function getAllSubscriptions(db: SQLiteDatabase): Promise<Subscription[]> {
  return db.getAllAsync<Subscription>(
    'SELECT * FROM Subscriptions ORDER BY status ASC, start_date DESC',
  );
}

/** 根据 ID 获取单条订阅 */
export async function getSubscriptionById(
  db: SQLiteDatabase,
  id: number,
): Promise<Subscription | null> {
  return db.getFirstAsync<Subscription>(
    'SELECT * FROM Subscriptions WHERE id = ?',
    [id],
  );
}

/** 新增订阅，返回插入 ID */
export async function createSubscription(
  db: SQLiteDatabase,
  sub: SubscriptionInput,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO Subscriptions (name, category, icon, image_uri, cycle_price, billing_cycle, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sub.name,
      sub.category,
      sub.icon,
      sub.image_uri ?? null,
      sub.cycle_price,
      sub.billing_cycle,
      sub.start_date,
      sub.status ?? 'active',
    ],
  );
  return result.lastInsertRowId;
}

/** 更新订阅（只更新传入的字段） */
export async function updateSubscription(
  db: SQLiteDatabase,
  id: number,
  sub: Partial<SubscriptionInput>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (sub.name !== undefined) { fields.push('name = ?'); values.push(sub.name); }
  if (sub.category !== undefined) { fields.push('category = ?'); values.push(sub.category); }
  if (sub.icon !== undefined) { fields.push('icon = ?'); values.push(sub.icon); }
  if (sub.image_uri !== undefined) { fields.push('image_uri = ?'); values.push(sub.image_uri ?? null); }
  if (sub.cycle_price !== undefined) { fields.push('cycle_price = ?'); values.push(sub.cycle_price); }
  if (sub.billing_cycle !== undefined) { fields.push('billing_cycle = ?'); values.push(sub.billing_cycle); }
  if (sub.start_date !== undefined) { fields.push('start_date = ?'); values.push(sub.start_date); }
  if (sub.status !== undefined) { fields.push('status = ?'); values.push(sub.status); }

  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE Subscriptions SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

/** 删除订阅 */
export async function deleteSubscription(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM Subscriptions WHERE id = ?', [id]);
}

/** 取消订阅：将状态置为 archived */
export async function archiveSubscription(
  db: SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE Subscriptions SET status = 'archived' WHERE id = ?`,
    [id],
  );
}
