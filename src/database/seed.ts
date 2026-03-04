import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * 首次启动时插入示例数据，方便用户快速了解功能
 * 使用 `_meta` 表记录是否已经 seed 过
 */
export async function seedSampleData(db: SQLiteDatabase): Promise<void> {
  // 创建 meta 表（如不存在）
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // 检查是否已播种
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'seeded'`,
  );
  if (row) return; // 已有数据，不再插入

  // ---------- 一次性资产示例 ----------
  // 已赎身 / 在用（全款）
  await db.runAsync(
    `INSERT INTO OneTimeItems (name, category, icon, total_price, buy_date, status, salvage_value, is_installment, installment_months, monthly_payment, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['iPhone 15', 'digital', '📱', 6999, '2024-09-20', 'active', 0, 0, null, null, null],
  );

  // 未赎身 / 分期中（生存负债）
  await db.runAsync(
    `INSERT INTO OneTimeItems (name, category, icon, total_price, buy_date, status, salvage_value, is_installment, installment_months, monthly_payment, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['MacBook Air M2（分期）', 'computer', '💻', 8999, '2026-02-01', 'unredeemed', 0, 1, 12, 799, null],
  );

  // 已归档（锁定成本：写入 end_date）
  await db.runAsync(
    `INSERT INTO OneTimeItems (name, category, icon, total_price, buy_date, status, salvage_value, is_installment, installment_months, monthly_payment, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Nintendo Switch', 'entertainment', '🎮', 2099, '2022-03-01', 'archived', 800, 0, null, null, '2024-12-01'],
  );

  // ---------- 周期订阅示例 ----------
  await db.runAsync(
    `INSERT INTO Subscriptions (name, category, icon, billing_cycle, cycle_price, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['网易云音乐', 'software', '💿', 'monthly', 15, '2024-01-01', 'active'],
  );

  await db.runAsync(
    `INSERT INTO Subscriptions (name, category, icon, billing_cycle, cycle_price, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['iCloud+ 200GB', 'software', '💿', 'monthly', 21, '2023-08-01', 'active'],
  );

  await db.runAsync(
    `INSERT INTO Subscriptions (name, category, icon, billing_cycle, cycle_price, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['ChatGPT Plus', 'software', '💿', 'yearly', 1680, '2024-06-01', 'active'],
  );

  // 标记已播种
  await db.runAsync(
    `INSERT INTO _meta (key, value) VALUES ('seeded', '1')`,
  );
}
