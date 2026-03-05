import type { SQLiteDatabase } from 'expo-sqlite';
import type { StoredCard, StoredCardInput } from '../types';

/** 获取全部沉睡卡包，默认按状态与最后更新时间排序 */
export async function getAllStoredCards(db: SQLiteDatabase): Promise<StoredCard[]> {
  return db.getAllAsync<StoredCard>(
    `
    SELECT *
    FROM StoredCards
    ORDER BY
      CASE status
        WHEN 'active' THEN 0
        ELSE 1
      END,
      last_updated_date ASC,
      id DESC
    `,
  );
}

/** 根据 ID 获取单张卡 */
export async function getStoredCardById(
  db: SQLiteDatabase,
  id: number,
): Promise<StoredCard | null> {
  return db.getFirstAsync<StoredCard>(
    'SELECT * FROM StoredCards WHERE id = ?',
    [id],
  );
}

/** 新增沉睡卡 */
export async function createStoredCard(
  db: SQLiteDatabase,
  card: StoredCardInput,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO StoredCards (
      name,
      category,
      icon,
      card_type,
      actual_paid,
      face_value,
      current_balance,
      last_updated_date,
      reminder_days,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      card.name,
      card.category,
      card.icon,
      card.card_type,
      card.actual_paid,
      card.face_value,
      card.current_balance,
      card.last_updated_date,
      card.reminder_days ?? 30,
      card.status ?? 'active',
    ],
  );
  return result.lastInsertRowId;
}

/** 更新沉睡卡（仅写入传入字段） */
export async function updateStoredCard(
  db: SQLiteDatabase,
  id: number,
  card: Partial<StoredCardInput>,
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (card.name !== undefined) { fields.push('name = ?'); values.push(card.name); }
  if (card.category !== undefined) { fields.push('category = ?'); values.push(card.category); }
  if (card.icon !== undefined) { fields.push('icon = ?'); values.push(card.icon); }
  if (card.card_type !== undefined) { fields.push('card_type = ?'); values.push(card.card_type); }
  if (card.actual_paid !== undefined) { fields.push('actual_paid = ?'); values.push(card.actual_paid); }
  if (card.face_value !== undefined) { fields.push('face_value = ?'); values.push(card.face_value); }
  if (card.current_balance !== undefined) { fields.push('current_balance = ?'); values.push(card.current_balance); }
  if (card.last_updated_date !== undefined) { fields.push('last_updated_date = ?'); values.push(card.last_updated_date); }
  if (card.reminder_days !== undefined) { fields.push('reminder_days = ?'); values.push(card.reminder_days); }
  if (card.status !== undefined) { fields.push('status = ?'); values.push(card.status); }

  if (fields.length === 0) return;

  values.push(id);
  await db.runAsync(
    `UPDATE StoredCards SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

/** 删除沉睡卡 */
export async function deleteStoredCard(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM StoredCards WHERE id = ?', [id]);
}

/** 归档沉睡卡 */
export async function archiveStoredCard(
  db: SQLiteDatabase,
  id: number,
  status: 'active' | 'archived' = 'archived',
): Promise<void> {
  await db.runAsync(
    `UPDATE StoredCards SET status = ? WHERE id = ?`,
    [status, id],
  );
}

/** 金额卡：按本次消费扣减余额，并刷新最后更新时间 */
export async function deductStoredCardAmount(
  db: SQLiteDatabase,
  id: number,
  amount: number,
  today: string,
): Promise<void> {
  await db.runAsync(
    `
    UPDATE StoredCards
    SET current_balance = MAX(current_balance - ?, 0),
        last_updated_date = ?
    WHERE id = ? AND card_type = 'amount'
    `,
    [amount, today, id],
  );
}

/** 金额卡：直接设置当前剩余，并刷新最后更新时间 */
export async function setStoredCardBalance(
  db: SQLiteDatabase,
  id: number,
  balance: number,
  today: string,
): Promise<void> {
  await db.runAsync(
    `
    UPDATE StoredCards
    SET current_balance = ?,
        last_updated_date = ?
    WHERE id = ? AND card_type = 'amount'
    `,
    [balance, today, id],
  );
}

/** 计次卡：打卡 -1，并刷新最后更新时间 */
export async function punchStoredCardCountMinusOne(
  db: SQLiteDatabase,
  id: number,
  today: string,
): Promise<boolean> {
  const result = await db.runAsync(
    `
    UPDATE StoredCards
    SET current_balance = current_balance - 1,
        last_updated_date = ?
    WHERE id = ? AND card_type = 'count' AND current_balance >= 1
    `,
    [today, id],
  );
  return result.changes > 0;
}
