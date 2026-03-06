import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { ensureCategoriesTable } from './categories';
import { seedSampleData } from './seed';

interface TableColumnInfo {
  name: string;
}

async function getTableColumnNames(
  db: SQLiteDatabase,
  tableName: string,
): Promise<Set<string>> {
  const rows = await db.getAllAsync<TableColumnInfo>(`PRAGMA table_info(${tableName})`);
  return new Set(rows.map((row) => row.name));
}

async function ensureColumn(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string,
): Promise<void> {
  const columns = await getTableColumnNames(db, tableName);
  if (columns.has(columnName)) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

/**
 * Initialize database schema and apply supported migrations.
 * Used by SQLiteProvider.onInit.
 */
export async function initDB(db: SQLiteDatabase): Promise<void> {
  const SCHEMA_VERSION = 7;

  async function migrate(current: SQLiteDatabase) {
    const versionRow = await current.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const userVersion = versionRow?.user_version ?? 0;

    if (__DEV__ && userVersion !== SCHEMA_VERSION) {
      await current.execAsync(`
        DROP TABLE IF EXISTS OneTimeItems;
        DROP TABLE IF EXISTS Subscriptions;
        DROP TABLE IF EXISTS StoredCards;
        DROP TABLE IF EXISTS Categories;
        DROP TABLE IF EXISTS one_time_items;
        DROP TABLE IF EXISTS subscriptions;
        DROP TABLE IF EXISTS stored_cards;
        DROP TABLE IF EXISTS _meta;
      `);
    } else if (
      !__DEV__
      && userVersion !== 0
      && userVersion !== SCHEMA_VERSION
      && userVersion !== 4
      && userVersion !== 5
      && userVersion !== 6
    ) {
      throw new Error(
        `数据库版本不匹配（当前 ${userVersion}，期望 ${SCHEMA_VERSION}）。请实现迁移后再发布。`,
      );
    } else if (userVersion === 4) {
      await current.execAsync(`
        CREATE TABLE IF NOT EXISTS Categories_new (
          id   TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('item', 'subscription', 'stored_card')),
          PRIMARY KEY (id, type)
        );

        INSERT INTO Categories_new (id, name, icon, type)
        SELECT id, name, icon, type FROM Categories;

        DROP TABLE Categories;
        ALTER TABLE Categories_new RENAME TO Categories;
        CREATE INDEX IF NOT EXISTS idx_categories_type ON Categories(type);
      `);
    } else if (userVersion === 5) {
      await current.execAsync(`
        ALTER TABLE OneTimeItems ADD COLUMN active_days INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE OneTimeItems ADD COLUMN active_start_date TEXT;
        ALTER TABLE OneTimeItems ADD COLUMN archived_reason TEXT;

        UPDATE OneTimeItems
        SET active_start_date = buy_date
        WHERE status IN ('active', 'unredeemed') AND (active_start_date IS NULL OR active_start_date = '');

        UPDATE OneTimeItems
        SET
          active_days = CASE
            WHEN end_date IS NOT NULL
              THEN MAX(CAST(julianday(end_date) - julianday(buy_date) + 1 AS INTEGER), 1)
            ELSE 0
          END,
          active_start_date = NULL,
          archived_reason = CASE
            WHEN salvage_value > 0 THEN 'sold'
            ELSE 'paused'
          END
        WHERE status = 'archived';
      `);
    } else if (userVersion === 6) {
      await current.execAsync(`
        ALTER TABLE OneTimeItems ADD COLUMN image_uri TEXT;
        ALTER TABLE Subscriptions ADD COLUMN image_uri TEXT;
        ALTER TABLE StoredCards ADD COLUMN image_uri TEXT;
      `);
    }

    await current.execAsync(`
      CREATE TABLE IF NOT EXISTS OneTimeItems (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        name               TEXT    NOT NULL,
        category           TEXT,
        icon               TEXT,
        image_uri          TEXT,
        total_price        REAL    NOT NULL CHECK(total_price > 0),
        buy_date           TEXT    NOT NULL,
        status             TEXT    NOT NULL CHECK(status IN ('unredeemed', 'active', 'archived')),
        salvage_value      REAL    DEFAULT 0 CHECK(salvage_value >= 0 AND salvage_value <= total_price),
        active_days        INTEGER NOT NULL DEFAULT 0 CHECK(active_days >= 0),
        active_start_date  TEXT,
        archived_reason    TEXT,
        is_installment     INTEGER DEFAULT 0 CHECK(is_installment IN (0, 1)),
        installment_months INTEGER,
        monthly_payment    REAL,
        down_payment       REAL    DEFAULT 0,
        end_date           TEXT,
        CHECK(is_installment = 1 OR (installment_months IS NULL AND monthly_payment IS NULL)),
        CHECK(is_installment = 0 OR (
          installment_months IS NOT NULL
          AND installment_months > 0
          AND monthly_payment IS NOT NULL
          AND monthly_payment > 0
        )),
        CHECK(status != 'unredeemed' OR is_installment = 1),
        CHECK(status = 'archived' OR end_date IS NULL),
        CHECK(status != 'archived' OR end_date IS NOT NULL)
      );

      CREATE INDEX IF NOT EXISTS idx_one_time_items_status ON OneTimeItems(status);
      CREATE INDEX IF NOT EXISTS idx_one_time_items_buy_date ON OneTimeItems(buy_date);
    `);

    await current.execAsync(`
      CREATE TABLE IF NOT EXISTS Subscriptions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT    NOT NULL,
        category      TEXT,
        icon          TEXT,
        image_uri     TEXT,
        cycle_price   REAL    NOT NULL CHECK(cycle_price > 0),
        billing_cycle TEXT    NOT NULL CHECK(billing_cycle IN ('monthly', 'quarterly', 'yearly')),
        start_date    TEXT    NOT NULL,
        status        TEXT    NOT NULL CHECK(status IN ('active', 'archived'))
      );

      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON Subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_start_date ON Subscriptions(start_date);
    `);

    await current.execAsync(`
      CREATE TABLE IF NOT EXISTS StoredCards (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        name              TEXT    NOT NULL,
        category          TEXT,
        icon              TEXT,
        image_uri         TEXT,
        card_type         TEXT    NOT NULL CHECK(card_type IN ('amount', 'count')),
        actual_paid       REAL    NOT NULL CHECK(actual_paid > 0),
        face_value        REAL    NOT NULL CHECK(face_value > 0),
        current_balance   REAL    NOT NULL CHECK(current_balance >= 0 AND current_balance <= face_value),
        last_updated_date TEXT    NOT NULL,
        reminder_days     INTEGER NOT NULL DEFAULT 30 CHECK(reminder_days >= 0),
        status            TEXT    NOT NULL CHECK(status IN ('active', 'archived'))
      );

      CREATE INDEX IF NOT EXISTS idx_stored_cards_status ON StoredCards(status);
      CREATE INDEX IF NOT EXISTS idx_stored_cards_last_updated ON StoredCards(last_updated_date);
      CREATE INDEX IF NOT EXISTS idx_stored_cards_category ON StoredCards(category);
      CREATE INDEX IF NOT EXISTS idx_stored_cards_type ON StoredCards(card_type);
    `);

    // Some historical databases ended up with user_version advanced but the
    // image_uri columns never actually added. Repair that state on every init.
    await ensureColumn(current, 'OneTimeItems', 'image_uri', 'TEXT');
    await ensureColumn(current, 'Subscriptions', 'image_uri', 'TEXT');
    await ensureColumn(current, 'StoredCards', 'image_uri', 'TEXT');

    await current.execAsync(`
      CREATE TABLE IF NOT EXISTS Categories (
        id   TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('item', 'subscription', 'stored_card')),
        PRIMARY KEY (id, type)
      );

      CREATE INDEX IF NOT EXISTS idx_categories_type ON Categories(type);
    `);

    await ensureCategoriesTable(current);

    await current.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => {
      await migrate(db);
    });
  } else {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migrate(txn);
    });
  }

  await seedSampleData(db);
}
