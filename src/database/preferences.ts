import type { SQLiteDatabase } from 'expo-sqlite';

/** 读取单个偏好值，不存在则返回 null */
export async function getPreference(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM AppPreferences WHERE key = ?',
    [key],
  );

  return row?.value ?? null;
}

/** 写入单个偏好值，已存在则覆盖 */
export async function setPreference(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    `
    INSERT INTO AppPreferences (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    [key, value],
  );
}
