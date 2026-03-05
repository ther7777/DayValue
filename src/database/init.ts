import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { seedSampleData } from './seed';

/**
 * 初始化数据库：建表 +（开发期）按版本清理旧表
 * 用于 SQLiteProvider 的 onInit 回调
 */
export async function initDB(db: SQLiteDatabase): Promise<void> {
  const SCHEMA_VERSION = 5;

  async function migrate(current: SQLiteDatabase) {
    const versionRow = await current.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const userVersion = versionRow?.user_version ?? 0;

    // 开发期：表结构大改时直接清空旧数据，避免历史表结构导致运行时报错
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
    } else if (!__DEV__ && userVersion !== 0 && userVersion !== SCHEMA_VERSION && userVersion !== 4) {
      // 非开发环境：不做破坏性迁移，避免误删用户数据
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
    }

    // 一次性资产表（含“赎身”状态机）
    await current.execAsync(`
      CREATE TABLE IF NOT EXISTS OneTimeItems (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        name               TEXT    NOT NULL,
        category           TEXT,
        icon               TEXT,
        total_price        REAL    NOT NULL CHECK(total_price > 0),
        buy_date           TEXT    NOT NULL,
        status             TEXT    NOT NULL CHECK(status IN ('unredeemed', 'active', 'archived')),
        salvage_value      REAL    DEFAULT 0 CHECK(salvage_value >= 0 AND salvage_value <= total_price),
        is_installment     INTEGER DEFAULT 0 CHECK(is_installment IN (0, 1)),
        installment_months INTEGER,
        monthly_payment    REAL,
        down_payment       REAL    DEFAULT 0,
        end_date           TEXT,
        CHECK(is_installment = 1 OR (installment_months IS NULL AND monthly_payment IS NULL)),
        CHECK(is_installment = 0 OR (installment_months IS NOT NULL AND installment_months > 0 AND monthly_payment IS NOT NULL AND monthly_payment > 0)),
        CHECK(status != 'unredeemed' OR is_installment = 1),
        CHECK(status = 'archived' OR end_date IS NULL),
        CHECK(status != 'archived' OR end_date IS NOT NULL)
      );

      CREATE INDEX IF NOT EXISTS idx_one_time_items_status ON OneTimeItems(status);
      CREATE INDEX IF NOT EXISTS idx_one_time_items_buy_date ON OneTimeItems(buy_date);
    `);

    // 周期订阅表
    await current.execAsync(`
      CREATE TABLE IF NOT EXISTS Subscriptions (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT    NOT NULL,
        category      TEXT,
        icon          TEXT,
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

    // 分类表：支持用户自定义分类与图标（按 type 区分物品/订阅）
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

    // 写入默认分类：即便已有 seed 数据，也要保证分类表可用
    await current.execAsync(`
      INSERT OR IGNORE INTO Categories (id, name, icon, type) VALUES
        ('digital',        '数码', '📱', 'item'),
        ('computer',       '电脑', '💻', 'item'),
        ('home',           '居家', '🏠', 'item'),
        ('transport',      '出行', '🛵', 'item'),
        ('clothing',       '服饰', '👕', 'item'),
        ('entertainment',  '娱乐', '🎮', 'item'),
        ('education',      '学习', '📚', 'item'),
        ('sports',         '运动', '⚽', 'item'),
        ('other',          '其他', '📦', 'item'),

        ('software',       '软件', '💿', 'subscription'),
        ('education',      '学习', '📚', 'subscription'),
        ('entertainment',  '娱乐', '🎮', 'subscription'),
        ('other',          '其他', '📦', 'subscription'),

        ('beauty',         '美容', '💇', 'stored_card'),
        ('fitness',        '健身', '🏋️', 'stored_card'),
        ('food',           '餐饮', '🍔', 'stored_card'),
        ('coffee',         '咖啡', '☕', 'stored_card'),
        ('other',          '其他', '📦', 'stored_card');
    `);

    await current.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  // withExclusiveTransactionAsync 不支持 web：在 web 上退化为普通事务（或顺序执行）
  if (Platform.OS === 'web') {
    await db.withTransactionAsync(async () => {
      await migrate(db);
    });
  } else {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await migrate(txn);
    });
  }

  // 首次启动时插入示例数据
  await seedSampleData(db);
}
