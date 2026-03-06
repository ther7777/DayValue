// ===================== 数据模型 =====================

export type OneTimeItemStatus = 'unredeemed' | 'active' | 'archived';
export type SubscriptionStatus = 'active' | 'archived';
export type StoredCardStatus = 'active' | 'archived';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';
export type CategoryType = 'item' | 'subscription' | 'stored_card';
export type StoredCardType = 'amount' | 'count';
export type OneTimeItemArchivedReason = 'paused' | 'sold';

/** 一次性资产（OneTimeItems 表） */
export interface OneTimeItem {
  id: number;
  name: string;
  category: string | null;
  icon: string | null;
  image_uri: string | null;
  total_price: number;
  buy_date: string;
  status: OneTimeItemStatus;
  salvage_value: number;
  /** 已累计的“激活天数”（不含当前激活段） */
  active_days: number;
  /** 当前激活段的起始日期（仅 active 时有值） */
  active_start_date: string | null;
  /** archived 的原因：停用（可再用）/售出（不可恢复） */
  archived_reason: OneTimeItemArchivedReason | null;
  is_installment: number; // 0 | 1
  installment_months: number | null;
  monthly_payment: number | null;
  down_payment: number;   // 首付金额，默认 0
  end_date: string | null;
}

/** 周期订阅资产（Subscriptions 表） */
export interface Subscription {
  id: number;
  name: string;
  category: string | null;
  icon: string | null;
  image_uri: string | null;
  cycle_price: number;
  billing_cycle: BillingCycle;
  start_date: string;
  status: SubscriptionStatus;
}

/** 沉睡卡包（StoredCards 表） */
export interface StoredCard {
  id: number;
  name: string;
  category: string | null;
  icon: string | null;
  image_uri: string | null;
  card_type: StoredCardType;
  actual_paid: number;
  face_value: number;
  current_balance: number;
  last_updated_date: string;
  reminder_days: number;
  status: StoredCardStatus;
}

// ===================== 输入 DTO =====================

export interface OneTimeItemInput {
  name: string;
  category: string;
  icon: string;
  image_uri?: string | null;
  total_price: number;
  buy_date: string;
  salvage_value?: number;
  active_days?: number;
  active_start_date?: string | null;
  archived_reason?: OneTimeItemArchivedReason | null;
  is_installment?: number; // 0 | 1
  installment_months?: number | null;
  monthly_payment?: number | null;
  down_payment?: number;   // 首付金额
  status?: OneTimeItemStatus;
  end_date?: string | null;
}

export interface SubscriptionInput {
  name: string;
  category: string;
  icon: string;
  image_uri?: string | null;
  cycle_price: number;
  billing_cycle: BillingCycle;
  start_date: string;
  status?: SubscriptionStatus;
}

export interface StoredCardInput {
  name: string;
  category: string;
  icon: string;
  image_uri?: string | null;
  card_type: StoredCardType;
  actual_paid: number;
  face_value: number;
  current_balance: number;
  last_updated_date: string;
  reminder_days?: number;
  status?: StoredCardStatus;
}

// ===================== 辅助类型 =====================

export interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
}

/** 分类表（Categories 表） */
export interface Category extends CategoryInfo {
  type: CategoryType;
}

// ===================== 导航参数 =====================

export type RootStackParamList = {
  Dashboard: undefined;
  Settings: undefined;
  AddEditItem: { itemId?: number; defaultIsInstallment?: boolean } | undefined;
  AddEditSubscription: { subscriptionId?: number } | undefined;
  AddEditStoredCard:
    | { storedCardId?: number; defaultCardType?: StoredCardType }
    | undefined;
  ItemDetail: { itemId: number };
  SubscriptionDetail: { subscriptionId: number };
  Categories: undefined;
  Statistics: undefined;
};
