import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * 首次启动时插入示例数据，便于快速了解功能。
 * 使用 `_meta` 表记录是否已经播种，避免重复插入。
 */
export async function seedSampleData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'seeded'`,
  );
  if (row) return;

  await db.runAsync(
    `INSERT INTO OneTimeItems (name, category, icon, total_price, buy_date, status, salvage_value, is_installment, installment_months, monthly_payment, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['iPhone 15 (示例)', 'digital', '📱', 6999, '2024-09-20', 'active', 0, 0, null, null, null],
  );

  await db.runAsync(
    `INSERT INTO OneTimeItems (name, category, icon, total_price, buy_date, status, salvage_value, is_installment, installment_months, monthly_payment, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['MacBook Air M2（分期）(示例)', 'computer', '💻', 8999, '2026-02-01', 'unredeemed', 0, 1, 12, 799, null],
  );

  await db.runAsync(
    `INSERT INTO OneTimeItems (name, category, icon, total_price, buy_date, status, salvage_value, is_installment, installment_months, monthly_payment, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Nintendo Switch (示例)', 'entertainment', '🎮', 2099, '2022-03-01', 'archived', 800, 0, null, null, '2024-12-01'],
  );

  await db.runAsync(
    `INSERT INTO Subscriptions (name, category, icon, billing_cycle, cycle_price, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['网易云音乐 (示例)', 'software', '🎵', 'monthly', 15, '2024-01-01', 'active'],
  );

  await db.runAsync(
    `INSERT INTO Subscriptions (name, category, icon, billing_cycle, cycle_price, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['iCloud+ 200GB (示例)', 'software', '☁️', 'monthly', 21, '2023-08-01', 'active'],
  );

  await db.runAsync(
    `INSERT INTO Subscriptions (name, category, icon, billing_cycle, cycle_price, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['ChatGPT Plus (示例)', 'software', '💿', 'yearly', 1680, '2024-06-01', 'active'],
  );

  await db.runAsync(
    `INSERT INTO StoredCards (
      name, category, icon, card_type, actual_paid, face_value, current_balance,
      last_updated_date, reminder_days, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['康复护理疗程卡 (示例)', 'beauty', '🪪', 'amount', 800, 1000, 620, '2025-12-20', 30, 'active'],
  );

  await db.runAsync(
    `INSERT INTO StoredCards (
      name, category, icon, card_type, actual_paid, face_value, current_balance,
      last_updated_date, reminder_days, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['私教课程包 (示例)', 'fitness', '🏋️', 'count', 1200, 20, 15, '2026-02-25', 14, 'active'],
  );

  await db.runAsync(
    `INSERT INTO _meta (key, value) VALUES ('seeded', '1')`,
  );
}
