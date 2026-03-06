import type { SQLiteDatabase } from 'expo-sqlite';
import type { OneTimeItem, OneTimeItemInput } from '../types';
import { calculateDaysUsed } from '../utils/calculations';

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
  const nextStatus = item.status ?? 'active';
  const activeStartDate =
    nextStatus === 'active' || nextStatus === 'unredeemed' ? item.buy_date : null;

  const result = await db.runAsync(
    `INSERT INTO OneTimeItems (
      name,
      category,
      icon,
      image_uri,
      total_price,
      buy_date,
      status,
      salvage_value,
      active_days,
      active_start_date,
      archived_reason,
      is_installment,
      installment_months,
      monthly_payment,
      down_payment,
      end_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.name,
      item.category,
      item.icon,
      item.image_uri ?? null,
      item.total_price,
      item.buy_date,
      nextStatus,
      item.salvage_value ?? 0,
      item.active_days ?? 0,
      item.active_start_date ?? activeStartDate,
      item.archived_reason ?? null,
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
  if (item.image_uri !== undefined) { fields.push('image_uri = ?'); values.push(item.image_uri ?? null); }
  if (item.total_price !== undefined) { fields.push('total_price = ?'); values.push(item.total_price); }
  if (item.buy_date !== undefined) { fields.push('buy_date = ?'); values.push(item.buy_date); }
  if (item.status !== undefined) { fields.push('status = ?'); values.push(item.status); }
  if (item.salvage_value !== undefined) { fields.push('salvage_value = ?'); values.push(item.salvage_value ?? 0); }
  if (item.active_days !== undefined) { fields.push('active_days = ?'); values.push(item.active_days ?? 0); }
  if (item.active_start_date !== undefined) { fields.push('active_start_date = ?'); values.push(item.active_start_date ?? null); }
  if (item.archived_reason !== undefined) { fields.push('archived_reason = ?'); values.push(item.archived_reason ?? null); }
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

/** 隐藏：写入 end_date + salvage_value，并将状态置为 archived（锁定成本） */
export async function archiveOneTimeItem(
  db: SQLiteDatabase,
  id: number,
  endDate: string,
  salvageValue: number,
): Promise<void> {
  const current = await getOneTimeItemById(db, id);
  if (!current) return;

  const activeStartDate = current.active_start_date ?? current.buy_date;
  if (endDate < activeStartDate) {
    throw new Error('停用/售出日期不能早于激活开始日期');
  }

  const nextActiveDays =
    (current.active_days ?? 0) + calculateDaysUsed(activeStartDate, endDate);

  await updateOneTimeItem(db, id, {
    status: 'archived',
    end_date: endDate,
    salvage_value: salvageValue,
    active_days: nextActiveDays,
    active_start_date: null,
    archived_reason: salvageValue > 0 ? 'sold' : 'paused',
  });
}

/** 停用（可再用）：冻结激活天数，并写入 end_date */
export async function pauseOneTimeItem(
  db: SQLiteDatabase,
  id: number,
  pauseDate: string,
): Promise<void> {
  const current = await getOneTimeItemById(db, id);
  if (!current) return;
  if (current.status !== 'active') {
    throw new Error('只有“在用”资产可以停用');
  }

  const activeStartDate = current.active_start_date ?? current.buy_date;
  if (pauseDate < activeStartDate) {
    throw new Error('停用日期不能早于激活开始日期');
  }
  const nextActiveDays =
    (current.active_days ?? 0) + calculateDaysUsed(activeStartDate, pauseDate);

  await updateOneTimeItem(db, id, {
    status: 'archived',
    end_date: pauseDate,
    // 停用不记录卖出价：此字段在新语义下仅用于“已售出”
    salvage_value: 0,
    active_days: nextActiveDays,
    active_start_date: null,
    archived_reason: 'paused',
  });
}

/** 再用：恢复为 active，并从指定日期开始新的激活段 */
export async function resumeOneTimeItem(
  db: SQLiteDatabase,
  id: number,
  resumeDate: string,
): Promise<void> {
  const current = await getOneTimeItemById(db, id);
  if (!current) return;
  if (current.status !== 'archived') {
    throw new Error('只有“已停用”的资产可以再用');
  }
  if (current.archived_reason === 'sold') {
    throw new Error('已售出的资产不可再用');
  }
  if (current.end_date && resumeDate < current.end_date) {
    throw new Error('再用日期不能早于停用日期');
  }

  await updateOneTimeItem(db, id, {
    status: 'active',
    end_date: null,
    active_start_date: resumeDate,
    archived_reason: null,
  });
}

/** 售出（不可恢复）：冻结激活天数，并记录卖出价 */
export async function sellOneTimeItem(
  db: SQLiteDatabase,
  id: number,
  soldDate: string,
  soldPrice: number,
): Promise<void> {
  const current = await getOneTimeItemById(db, id);
  if (!current) return;
  if (current.status !== 'active') {
    throw new Error('只有“在用”资产可以售出');
  }

  const activeStartDate = current.active_start_date ?? current.buy_date;
  if (soldDate < activeStartDate) {
    throw new Error('售出日期不能早于激活开始日期');
  }
  const nextActiveDays =
    (current.active_days ?? 0) + calculateDaysUsed(activeStartDate, soldDate);

  await updateOneTimeItem(db, id, {
    status: 'archived',
    end_date: soldDate,
    salvage_value: soldPrice,
    active_days: nextActiveDays,
    active_start_date: null,
    archived_reason: 'sold',
  });
}
