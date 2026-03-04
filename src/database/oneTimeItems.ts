import type { SQLiteDatabase } from 'expo-sqlite';
import type { OneTimeItem, OneTimeItemInput } from '../types';

/** 获取全部一次性资产（按状态排序：active -> unredeemed -> archived，再按购买日期倒序） */
export async function getAllOneTimeItems(db: SQLiteDatabase): Promise<OneTimeItem[]> {
  return db.getAllAsync<OneTimeItem>(
    `
    SELECT *
    FROM OneTimeItems
    ORDER BY
      CASE status
        WHEN 'active' THEN 0
        WHEN 'unredeemed' THEN 1
        ELSE 2
      END,
      buy_date DESC
    `,
  );
}

/** 根据 ID 获取单条一次性资产 */
export async function getOneTimeItemById(
  db: SQLiteDatabase,
  id: number,
): Promise<OneTimeItem | null> {
  return db.getFirstAsync<OneTimeItem>(
    'SELECT * FROM OneTimeItems WHERE id = ?',
    [id],
  );
}

/** 新增一次性资产，返回插入 ID */
export async function createOneTimeItem(
  db: SQLiteDatabase,
  item: OneTimeItemInput,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO OneTimeItems (
      name,
      category,
      icon,
      total_price,
      buy_date,
      status,
      salvage_value,
      is_installment,
      installment_months,
      monthly_payment,
      down_payment,
      end_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.name,
      item.category,
      item.icon,
      item.total_price,
      item.buy_date,
      item.status ?? 'active',
      item.salvage_value ?? 0,
      item.is_installment ?? 0,
      item.installment_months ?? null,
      item.monthly_payment ?? null,
      item.down_payment ?? 0,
      item.end_date ?? null,
    ],
  );
  return result.lastInsertRowId;
}

/** 更新一次性资产（只更新传入的字段） */
export async function updateOneTimeItem(
  db: SQLiteDatabase,
  id: number,
  item: Partial<OneTimeItemInput>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (item.name !== undefined) { fields.push('name = ?'); values.push(item.name); }
  if (item.category !== undefined) { fields.push('category = ?'); values.push(item.category); }
  if (item.icon !== undefined) { fields.push('icon = ?'); values.push(item.icon); }
  if (item.total_price !== undefined) { fields.push('total_price = ?'); values.push(item.total_price); }
  if (item.buy_date !== undefined) { fields.push('buy_date = ?'); values.push(item.buy_date); }
  if (item.status !== undefined) { fields.push('status = ?'); values.push(item.status); }
  if (item.salvage_value !== undefined) { fields.push('salvage_value = ?'); values.push(item.salvage_value ?? 0); }
  if (item.is_installment !== undefined) { fields.push('is_installment = ?'); values.push(item.is_installment); }
  if (item.installment_months !== undefined) { fields.push('installment_months = ?'); values.push(item.installment_months ?? null); }
  if (item.monthly_payment !== undefined) { fields.push('monthly_payment = ?'); values.push(item.monthly_payment ?? null); }
  if (item.down_payment !== undefined) { fields.push('down_payment = ?'); values.push(item.down_payment ?? 0); }
  if (item.end_date !== undefined) { fields.push('end_date = ?'); values.push(item.end_date ?? null); }

  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE OneTimeItems SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

/** 删除一次性资产 */
export async function deleteOneTimeItem(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM OneTimeItems WHERE id = ?', [id]);
}

/** 赎身：从 unredeemed -> active */
export async function redeemOneTimeItem(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(
    `UPDATE OneTimeItems SET status = 'active' WHERE id = ? AND status = 'unredeemed'`,
    [id],
  );
}

/** 归档：写入 end_date + salvage_value，并将状态置为 archived（锁定成本） */
export async function archiveOneTimeItem(
  db: SQLiteDatabase,
  id: number,
  endDate: string,
  salvageValue: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE OneTimeItems
     SET status = 'archived', end_date = ?, salvage_value = ?
     WHERE id = ?`,
    [endDate, salvageValue, id],
  );
}

