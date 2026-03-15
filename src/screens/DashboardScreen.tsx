import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, OneTimeItem, Subscription, StoredCard } from '../types';
import {
  getAllOneTimeItems,
  getAllSubscriptions,
  getAllStoredCards,
  getPreference,
  setPreference,
} from '../database';
import {
  calculateDailyCost,
  calculateSubscriptionDailyCost,
  calculateDailyDebt,
  calculateStoredPrincipal,
  calculateRealizedProfit,
  calculateOneTimeItemActiveDays,
  isProfitableSale,
} from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import {
  ItemCard,
  SubscriptionCard,
  EmptyState,
  BrutalButton,
  StoredCardCard,
  AppBottomSheet,
  AssetCategorySheet,
  AssetSectionToolbar,
  DashboardHeroHeader,
} from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type TabKey = 'assets' | 'debts' | 'stored_cards';
type ItemSortField = 'buy_date' | 'total_price';
type DebtSortField = 'daily_cost' | 'date';
type StoredCardSortField = 'principal' | 'last_updated_date';
type SortDirection = 'desc' | 'asc';
type LayoutMode = 'list' | 'grid';

type DashboardChrome = {
  backgroundColor: string;
  borderColor: string;
  subtitleColor?: string;
  costColor?: string;
  hintColor?: string;
};

type SortSheetConfig = {
  title: string;
  fields: { value: string; label: string }[];
  currentField: string;
  currentDirection: SortDirection;
  onSelectField: (value: string) => void;
  onSelectDirection: (value: SortDirection) => void;
};

type SectionToolbarProps = {
  title: string;
  sortSummary: string;
  layoutMode: LayoutMode;
  onPressSort: () => void;
  onToggleLayout: () => void;
};

const ASSET_SORT_FIELD_KEY = 'asset_sort_field';
const ASSET_SORT_DIRECTION_KEY = 'asset_sort_direction';
const ASSET_LAYOUT_MODE_KEY = 'asset_layout_mode';
const DEBT_SORT_FIELD_KEY = 'debt_sort_field';
const DEBT_SORT_DIRECTION_KEY = 'debt_sort_direction';
const DEBT_LAYOUT_MODE_KEY = 'debt_layout_mode';
const STORED_CARD_SORT_FIELD_KEY = 'stored_card_sort_field';
const STORED_CARD_SORT_DIRECTION_KEY = 'stored_card_sort_direction';
const STORED_CARD_LAYOUT_MODE_KEY = 'stored_card_layout_mode';

function chunkItems<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function compareValues(primaryDiff: number, fallbackDiff: number): number {
  if (primaryDiff !== 0) return primaryDiff;
  return fallbackDiff;
}

function sortOneTimeItems(
  items: OneTimeItem[],
  field: ItemSortField,
  direction: SortDirection,
): OneTimeItem[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    if (field === 'total_price') {
      return compareValues(
        (a.total_price - b.total_price) * factor,
        (a.id - b.id) * -1,
      );
    }

    return compareValues(
      a.buy_date.localeCompare(b.buy_date) * factor,
      (a.id - b.id) * -1,
    );
  });
}

function sortDebtItems(
  items: OneTimeItem[],
  field: DebtSortField,
  direction: SortDirection,
): OneTimeItem[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    if (field === 'daily_cost') {
      return compareValues(
        (calculateDailyDebt(a.monthly_payment ?? 0) - calculateDailyDebt(b.monthly_payment ?? 0)) * factor,
        (a.id - b.id) * -1,
      );
    }

    return compareValues(
      a.buy_date.localeCompare(b.buy_date) * factor,
      (a.id - b.id) * -1,
    );
  });
}

function sortSubscriptions(
  items: Subscription[],
  field: DebtSortField,
  direction: SortDirection,
): Subscription[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    if (field === 'daily_cost') {
      return compareValues(
        (
          calculateSubscriptionDailyCost(a.cycle_price, a.billing_cycle) -
          calculateSubscriptionDailyCost(b.cycle_price, b.billing_cycle)
        ) * factor,
        (a.id - b.id) * -1,
      );
    }

    return compareValues(
      a.start_date.localeCompare(b.start_date) * factor,
      (a.id - b.id) * -1,
    );
  });
}

function sortStoredCards(
  items: StoredCard[],
  field: StoredCardSortField,
  direction: SortDirection,
): StoredCard[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    if (field === 'principal') {
      return compareValues(
        (
          calculateStoredPrincipal(a.actual_paid, a.face_value, a.current_balance) -
          calculateStoredPrincipal(b.actual_paid, b.face_value, b.current_balance)
        ) * factor,
        (a.id - b.id) * -1,
      );
    }

    return compareValues(
      a.last_updated_date.localeCompare(b.last_updated_date) * factor,
      (a.id - b.id) * -1,
    );
  });
}

function getSortSummary(label: string, direction: SortDirection): string {
  return `${label} ${direction === 'desc' ? '↓' : '↑'}`;
}

function SectionToolbar({
  title,
  sortSummary,
  layoutMode,
  onPressSort,
  onToggleLayout,
}: SectionToolbarProps) {
  return (
    <View style={styles.sectionToolbar}>
      <Text style={styles.sectionToolbarTitle} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity
        style={styles.sortTriggerButton}
        onPress={onPressSort}
        activeOpacity={0.75}
      >
        <Text style={styles.sortTriggerText} numberOfLines={1}>
          {sortSummary}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.layoutIconButton}
        onPress={onToggleLayout}
        activeOpacity={0.75}
      >
        <Text style={styles.layoutIconText}>{layoutMode === 'list' ? '⊞' : '≡'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function renderGridRows<T>(
  items: T[],
  keyPrefix: string,
  renderCard: (item: T) => React.ReactElement,
) {
  return chunkItems(items, 2).map((rowItems, rowIndex) => (
    <View key={`${keyPrefix}-${rowIndex}`} style={styles.gridRow}>
      {rowItems.map(item => renderCard(item))}
      {rowItems.length === 1 && <View style={styles.gridCardPlaceholder} />}
    </View>
  ));
}

export function DashboardScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { itemCategories } = useCategories();

  const [activeTab, setActiveTab] = useState<TabKey>('assets');
  const [items, setItems] = useState<OneTimeItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [storedCards, setStoredCards] = useState<StoredCard[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [sortSheetTarget, setSortSheetTarget] = useState<TabKey | null>(null);
  const [selectedAssetCategoryId, setSelectedAssetCategoryId] = useState<string | null>(null);
  const [assetFilterSheetVisible, setAssetFilterSheetVisible] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showArchivedCards, setShowArchivedCards] = useState(false);

  const [itemSortField, setItemSortField] = useState<ItemSortField>('buy_date');
  const [itemSortDirection, setItemSortDirection] = useState<SortDirection>('desc');
  const [assetLayoutMode, setAssetLayoutMode] = useState<LayoutMode>('list');

  const [debtSortField, setDebtSortField] = useState<DebtSortField>('daily_cost');
  const [debtSortDirection, setDebtSortDirection] = useState<SortDirection>('desc');
  const [debtLayoutMode, setDebtLayoutMode] = useState<LayoutMode>('list');

  const [storedCardSortField, setStoredCardSortField] = useState<StoredCardSortField>('principal');
  const [storedCardSortDirection, setStoredCardSortDirection] = useState<SortDirection>('desc');
  const [storedCardLayoutMode, setStoredCardLayoutMode] = useState<LayoutMode>('list');

  const loadData = useCallback(async () => {
    try {
      const [nextItems, nextSubscriptions, nextStoredCards] = await Promise.all([
        getAllOneTimeItems(db),
        getAllSubscriptions(db),
        getAllStoredCards(db),
      ]);
      setItems(nextItems);
      setSubscriptions(nextSubscriptions);
      setStoredCards(nextStoredCards);
    } catch (error) {
      console.error('加载首页数据失败', error);
    }
  }, [db]);

  const loadPreferences = useCallback(async () => {
    try {
      const [
        assetFieldValue,
        assetDirectionValue,
        assetLayoutValue,
        debtFieldValue,
        debtDirectionValue,
        debtLayoutValue,
        storedFieldValue,
        storedDirectionValue,
        storedLayoutValue,
      ] = await Promise.all([
        getPreference(db, ASSET_SORT_FIELD_KEY),
        getPreference(db, ASSET_SORT_DIRECTION_KEY),
        getPreference(db, ASSET_LAYOUT_MODE_KEY),
        getPreference(db, DEBT_SORT_FIELD_KEY),
        getPreference(db, DEBT_SORT_DIRECTION_KEY),
        getPreference(db, DEBT_LAYOUT_MODE_KEY),
        getPreference(db, STORED_CARD_SORT_FIELD_KEY),
        getPreference(db, STORED_CARD_SORT_DIRECTION_KEY),
        getPreference(db, STORED_CARD_LAYOUT_MODE_KEY),
      ]);

      if (assetFieldValue === 'buy_date' || assetFieldValue === 'total_price') {
        setItemSortField(assetFieldValue);
      }
      if (assetDirectionValue === 'asc' || assetDirectionValue === 'desc') {
        setItemSortDirection(assetDirectionValue);
      }
      if (assetLayoutValue === 'list' || assetLayoutValue === 'grid') {
        setAssetLayoutMode(assetLayoutValue);
      }

      if (debtFieldValue === 'daily_cost' || debtFieldValue === 'date') {
        setDebtSortField(debtFieldValue);
      }
      if (debtDirectionValue === 'asc' || debtDirectionValue === 'desc') {
        setDebtSortDirection(debtDirectionValue);
      }
      if (debtLayoutValue === 'list' || debtLayoutValue === 'grid') {
        setDebtLayoutMode(debtLayoutValue);
      }

      if (storedFieldValue === 'principal' || storedFieldValue === 'last_updated_date') {
        setStoredCardSortField(storedFieldValue);
      }
      if (storedDirectionValue === 'asc' || storedDirectionValue === 'desc') {
        setStoredCardSortDirection(storedDirectionValue);
      }
      if (storedLayoutValue === 'list' || storedLayoutValue === 'grid') {
        setStoredCardLayoutMode(storedLayoutValue);
      }
    } catch (error) {
      console.error('加载首页偏好失败', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      void loadPreferences();
      return () => {
        setSelectedAssetCategoryId(null);
        setAssetFilterSheetVisible(false);
      };
    }, [loadData, loadPreferences]),
  );

  useEffect(() => {
    if (
      selectedAssetCategoryId !== null &&
      !itemCategories.some(category => category.id === selectedAssetCategoryId)
    ) {
      setSelectedAssetCategoryId(null);
    }
  }, [itemCategories, selectedAssetCategoryId]);

  const persistPreference = useCallback((key: string, value: string) => {
    void setPreference(db, key, value).catch(error => {
      console.error('保存首页偏好失败', error);
    });
  }, [db]);

  const updateItemSortField = useCallback((nextField: ItemSortField) => {
    setItemSortField(nextField);
    persistPreference(ASSET_SORT_FIELD_KEY, nextField);
  }, [persistPreference]);

  const updateItemSortDirection = useCallback((nextDirection: SortDirection) => {
    setItemSortDirection(nextDirection);
    persistPreference(ASSET_SORT_DIRECTION_KEY, nextDirection);
  }, [persistPreference]);

  const updateAssetLayoutMode = useCallback((nextMode: LayoutMode) => {
    setAssetLayoutMode(nextMode);
    persistPreference(ASSET_LAYOUT_MODE_KEY, nextMode);
  }, [persistPreference]);

  const updateDebtSortField = useCallback((nextField: DebtSortField) => {
    setDebtSortField(nextField);
    persistPreference(DEBT_SORT_FIELD_KEY, nextField);
  }, [persistPreference]);

  const updateDebtSortDirection = useCallback((nextDirection: SortDirection) => {
    setDebtSortDirection(nextDirection);
    persistPreference(DEBT_SORT_DIRECTION_KEY, nextDirection);
  }, [persistPreference]);

  const updateDebtLayoutMode = useCallback((nextMode: LayoutMode) => {
    setDebtLayoutMode(nextMode);
    persistPreference(DEBT_LAYOUT_MODE_KEY, nextMode);
  }, [persistPreference]);

  const updateStoredCardSortField = useCallback((nextField: StoredCardSortField) => {
    setStoredCardSortField(nextField);
    persistPreference(STORED_CARD_SORT_FIELD_KEY, nextField);
  }, [persistPreference]);

  const updateStoredCardSortDirection = useCallback((nextDirection: SortDirection) => {
    setStoredCardSortDirection(nextDirection);
    persistPreference(STORED_CARD_SORT_DIRECTION_KEY, nextDirection);
  }, [persistPreference]);

  const updateStoredCardLayoutMode = useCallback((nextMode: LayoutMode) => {
    setStoredCardLayoutMode(nextMode);
    persistPreference(STORED_CARD_LAYOUT_MODE_KEY, nextMode);
  }, [persistPreference]);

  const toggleAssetLayoutMode = useCallback(() => {
    updateAssetLayoutMode(assetLayoutMode === 'list' ? 'grid' : 'list');
  }, [assetLayoutMode, updateAssetLayoutMode]);

  const toggleDebtLayoutMode = useCallback(() => {
    updateDebtLayoutMode(debtLayoutMode === 'list' ? 'grid' : 'list');
  }, [debtLayoutMode, updateDebtLayoutMode]);

  const toggleStoredCardLayoutMode = useCallback(() => {
    updateStoredCardLayoutMode(storedCardLayoutMode === 'list' ? 'grid' : 'list');
  }, [storedCardLayoutMode, updateStoredCardLayoutMode]);

  const activeItems = useMemo(() => items.filter(item => item.status === 'active'), [items]);
  const archivedItems = useMemo(() => items.filter(item => item.status === 'archived'), [items]);
  const unredeemedItems = useMemo(() => items.filter(item => item.status === 'unredeemed'), [items]);
  const activeSubscriptions = useMemo(
    () => subscriptions.filter(subscription => subscription.status === 'active'),
    [subscriptions],
  );
  const activeStoredCards = useMemo(
    () => storedCards.filter(card => card.status === 'active'),
    [storedCards],
  );
  const archivedStoredCards = useMemo(
    () => storedCards.filter(card => card.status === 'archived'),
    [storedCards],
  );

  const sortedActiveItems = useMemo(
    () => sortOneTimeItems(activeItems, itemSortField, itemSortDirection),
    [activeItems, itemSortDirection, itemSortField],
  );
  const sortedArchivedItems = useMemo(
    () => sortOneTimeItems(archivedItems, itemSortField, itemSortDirection),
    [archivedItems, itemSortDirection, itemSortField],
  );
  const sortedDebtItems = useMemo(
    () => sortDebtItems(unredeemedItems, debtSortField, debtSortDirection),
    [debtSortDirection, debtSortField, unredeemedItems],
  );
  const sortedActiveSubscriptions = useMemo(
    () => sortSubscriptions(activeSubscriptions, debtSortField, debtSortDirection),
    [activeSubscriptions, debtSortDirection, debtSortField],
  );
  const sortedActiveStoredCards = useMemo(
    () => sortStoredCards(activeStoredCards, storedCardSortField, storedCardSortDirection),
    [activeStoredCards, storedCardSortDirection, storedCardSortField],
  );
  const sortedArchivedStoredCards = useMemo(
    () => sortStoredCards(archivedStoredCards, storedCardSortField, storedCardSortDirection),
    [archivedStoredCards, storedCardSortDirection, storedCardSortField],
  );

  const matchesSelectedAssetCategory = useCallback((item: OneTimeItem) => {
    if (selectedAssetCategoryId === null) {
      return true;
    }

    return (item.category ?? 'other') === selectedAssetCategoryId;
  }, [selectedAssetCategoryId]);

  const selectedAssetCategory = useMemo(
    () =>
      selectedAssetCategoryId === null
        ? null
        : itemCategories.find(category => category.id === selectedAssetCategoryId) ?? null,
    [itemCategories, selectedAssetCategoryId],
  );

  const activeAssetCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    activeItems.forEach(item => {
      const categoryId = item.category ?? 'other';
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    });

    return counts;
  }, [activeItems]);

  const activeAssetCategoriesForSheet = useMemo(
    () =>
      itemCategories
        .filter(category => {
          const count = activeAssetCategoryCounts.get(category.id) ?? 0;
          return count > 0 || category.id === selectedAssetCategoryId;
        })
        .map(category => ({
          ...category,
          count: activeAssetCategoryCounts.get(category.id) ?? 0,
        })),
    [activeAssetCategoryCounts, itemCategories, selectedAssetCategoryId],
  );

  const filteredActiveItems = useMemo(
    () => sortedActiveItems.filter(matchesSelectedAssetCategory),
    [matchesSelectedAssetCategory, sortedActiveItems],
  );
  const filteredArchivedItems = useMemo(
    () => sortedArchivedItems.filter(matchesSelectedAssetCategory),
    [matchesSelectedAssetCategory, sortedArchivedItems],
  );
  const filteredPausedItems = useMemo(
    () => filteredArchivedItems.filter(item => (item.archived_reason ?? (item.salvage_value > 0 ? 'sold' : 'paused')) !== 'sold'),
    [filteredArchivedItems],
  );
  const filteredSoldItems = useMemo(
    () => filteredArchivedItems.filter(item => (item.archived_reason ?? (item.salvage_value > 0 ? 'sold' : 'paused')) === 'sold'),
    [filteredArchivedItems],
  );

  const filteredTotalAssetDailyCost = useMemo(() => {
    return filteredActiveItems.reduce((sum, item) => {
      const activeDays = calculateOneTimeItemActiveDays(item);
      return sum + calculateDailyCost(item.total_price, 0, activeDays);
    }, 0);
  }, [filteredActiveItems]);

  const filteredRealizedProfit = useMemo(() => {
    return filteredSoldItems.reduce((sum, item) => {
      if (!isProfitableSale(item.total_price, item.salvage_value)) {
        return sum;
      }
      return sum + calculateRealizedProfit(item.total_price, item.salvage_value);
    }, 0);
  }, [filteredSoldItems]);

  const totalSubscriptionCost = useMemo(() => {
    return activeSubscriptions.reduce(
      (sum, subscription) =>
        sum + calculateSubscriptionDailyCost(subscription.cycle_price, subscription.billing_cycle),
      0,
    );
  }, [activeSubscriptions]);

  const totalInstallmentDebt = useMemo(() => {
    return unredeemedItems.reduce(
      (sum, item) => sum + calculateDailyDebt(item.monthly_payment ?? 0),
      0,
    );
  }, [unredeemedItems]);

  const totalDebtDailyCost = totalInstallmentDebt + totalSubscriptionCost;

  const totalPrincipal = useMemo(() => {
    return activeStoredCards.reduce(
      (sum, card) =>
        sum + calculateStoredPrincipal(card.actual_paid, card.face_value, card.current_balance),
      0,
    );
  }, [activeStoredCards]);

  const assetSortSummary = useMemo(() => {
    return getSortSummary(
      itemSortField === 'buy_date' ? '按购买日期' : '按总金额',
      itemSortDirection,
    );
  }, [itemSortDirection, itemSortField]);

  const debtSortSummary = useMemo(() => {
    return getSortSummary(
      debtSortField === 'daily_cost' ? '按日消耗' : '按时间',
      debtSortDirection,
    );
  }, [debtSortDirection, debtSortField]);

  const storedCardSortSummary = useMemo(() => {
    return getSortSummary(
      storedCardSortField === 'principal' ? '按本金' : '按更新时间',
      storedCardSortDirection,
    );
  }, [storedCardSortDirection, storedCardSortField]);

  const isAssetFiltered = selectedAssetCategory !== null;
  const assetHeroSummary = useMemo(() => {
    if (selectedAssetCategory) {
      return `共 ${filteredActiveItems.length} 件${selectedAssetCategory.name}资产`;
    }

    if (filteredRealizedProfit > 0) {
      return `共 ${filteredActiveItems.length} 件在用资产 · 累计已盈利 ${formatCurrency(filteredRealizedProfit)}`;
    }

    return `共 ${filteredActiveItems.length} 件在用资产 · 数字越低越回本`;
  }, [filteredActiveItems.length, filteredRealizedProfit, selectedAssetCategory]);

  const chrome = useMemo<DashboardChrome>(() => {
    if (activeTab === 'debts') {
      return {
        backgroundColor: '#E17055',
        borderColor: '#C56B4B',
        subtitleColor: '#FFD8CC',
      };
    }
    if (activeTab === 'stored_cards') {
      return {
        backgroundColor: '#B8860B',
        borderColor: '#856404',
        subtitleColor: '#FFE89A',
        costColor: '#FFE066',
        hintColor: '#FFE89ACC',
      };
    }
    return {
      backgroundColor: THEME.colors.primary,
      borderColor: THEME.colors.borderDark,
    };
  }, [activeTab]);

  const sortSheetConfig = useMemo<SortSheetConfig | null>(() => {
    if (sortSheetTarget === 'assets') {
      return {
        title: '买断资产排序',
        fields: [
          { value: 'buy_date', label: '按购买日期' },
          { value: 'total_price', label: '按总金额' },
        ],
        currentField: itemSortField,
        currentDirection: itemSortDirection,
        onSelectField: value => updateItemSortField(value as ItemSortField),
        onSelectDirection: updateItemSortDirection,
      };
    }

    if (sortSheetTarget === 'debts') {
      return {
        title: '每日消耗排序',
        fields: [
          { value: 'daily_cost', label: '按日消耗' },
          { value: 'date', label: '按时间' },
        ],
        currentField: debtSortField,
        currentDirection: debtSortDirection,
        onSelectField: value => updateDebtSortField(value as DebtSortField),
        onSelectDirection: updateDebtSortDirection,
      };
    }

    if (sortSheetTarget === 'stored_cards') {
      return {
        title: '沉睡卡包排序',
        fields: [
          { value: 'principal', label: '按本金' },
          { value: 'last_updated_date', label: '按更新时间' },
        ],
        currentField: storedCardSortField,
        currentDirection: storedCardSortDirection,
        onSelectField: value => updateStoredCardSortField(value as StoredCardSortField),
        onSelectDirection: updateStoredCardSortDirection,
      };
    }

    return null;
  }, [
    debtSortDirection,
    debtSortField,
    itemSortDirection,
    itemSortField,
    sortSheetTarget,
    storedCardSortDirection,
    storedCardSortField,
    updateDebtSortDirection,
    updateDebtSortField,
    updateItemSortDirection,
    updateItemSortField,
    updateStoredCardSortDirection,
    updateStoredCardSortField,
  ]);

  const renderAssetList = (data: OneTimeItem[]) => {
    if (assetLayoutMode === 'grid') {
      return renderGridRows(data, 'asset', item => (
        <ItemCard
          key={item.id}
          item={item}
          layout="grid"
          style={styles.gridCard}
          onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
        />
      ));
    }

    return data.map(item => (
      <ItemCard
        key={item.id}
        item={item}
        onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
      />
    ));
  };

  const renderDebtItemList = (data: OneTimeItem[]) => {
    if (debtLayoutMode === 'grid') {
      return renderGridRows(data, 'debt-item', item => (
        <ItemCard
          key={item.id}
          item={item}
          layout="grid"
          style={styles.gridCard}
          onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
        />
      ));
    }

    return data.map(item => (
      <ItemCard
        key={item.id}
        item={item}
        onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
      />
    ));
  };

  const renderSubscriptionList = (data: Subscription[]) => {
    if (debtLayoutMode === 'grid') {
      return renderGridRows(data, 'debt-sub', subscription => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          layout="grid"
          style={styles.gridCard}
          onPress={() => navigation.navigate('SubscriptionDetail', { subscriptionId: subscription.id })}
        />
      ));
    }

    return data.map(subscription => (
      <SubscriptionCard
        key={subscription.id}
        subscription={subscription}
        onPress={() => navigation.navigate('SubscriptionDetail', { subscriptionId: subscription.id })}
      />
    ));
  };

  const renderStoredCardList = (data: StoredCard[]) => {
    if (storedCardLayoutMode === 'grid') {
      return renderGridRows(data, 'stored-card', card => (
        <StoredCardCard
          key={card.id}
          card={card}
          layout="grid"
          style={styles.gridCard}
          onPress={() => navigation.navigate('AddEditStoredCard', { storedCardId: card.id })}
          onDataChanged={loadData}
        />
      ));
    }

    return data.map(card => (
      <StoredCardCard
        key={card.id}
        card={card}
        onPress={() => navigation.navigate('AddEditStoredCard', { storedCardId: card.id })}
        onDataChanged={loadData}
      />
    ));
  };

  const renderAssetsTab = () => {
    const hasActiveAssets = filteredActiveItems.length > 0;
    const hasArchivedAssets = filteredArchivedItems.length > 0;
    const showHistoryFirst = !hasActiveAssets && hasArchivedAssets;
    const emptyMessage = isAssetFiltered ? '该分类下还没有买断资产记录' : '还没有买断资产记录';

    return (
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <AssetSectionToolbar
          title="在用资产"
          sortSummary={assetSortSummary}
          layoutMode={assetLayoutMode}
          onPressSort={() => setSortSheetTarget('assets')}
          onToggleLayout={toggleAssetLayoutMode}
        />

        {showHistoryFirst && (
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowArchived(value => !value)}
            activeOpacity={0.75}
          >
            <Text style={styles.historyToggleText}>
              {showArchived ? '收起' : '显示'}停用/售出 ({filteredArchivedItems.length})
            </Text>
          </TouchableOpacity>
        )}

        {hasActiveAssets && renderAssetList(filteredActiveItems)}

        {!hasActiveAssets && !hasArchivedAssets && (
          <EmptyState message={emptyMessage} icon="🧾" />
        )}

        {hasActiveAssets && hasArchivedAssets && (
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowArchived(value => !value)}
            activeOpacity={0.75}
          >
            <Text style={styles.historyToggleText}>
              {showArchived ? '收起' : '显示'}停用/售出 ({filteredArchivedItems.length})
            </Text>
          </TouchableOpacity>
        )}

        {showArchived && filteredPausedItems.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>已停用 ({filteredPausedItems.length})</Text>
            {renderAssetList(filteredPausedItems)}
          </>
        )}

        {showArchived && filteredSoldItems.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>已售出 ({filteredSoldItems.length})</Text>
            {renderAssetList(filteredSoldItems)}
          </>
        )}
      </ScrollView>
    );
  };

  const renderDebtsTab = () => {
    const hasDebtContent = sortedDebtItems.length > 0 || sortedActiveSubscriptions.length > 0;

    return (
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <SectionToolbar
          title="分期物品"
          sortSummary={debtSortSummary}
          layoutMode={debtLayoutMode}
          onPressSort={() => setSortSheetTarget('debts')}
          onToggleLayout={toggleDebtLayoutMode}
        />

        {!hasDebtContent && (
          <EmptyState message="还没有每日消耗记录" icon="📉" />
        )}

        {sortedDebtItems.length > 0 ? (
          renderDebtItemList(sortedDebtItems)
        ) : hasDebtContent ? (
          <Text style={styles.sectionEmptyHint}>暂无分期物品</Text>
        ) : null}

        <Text style={styles.subSectionTitle}>持续订阅</Text>
        {sortedActiveSubscriptions.length > 0 ? (
          renderSubscriptionList(sortedActiveSubscriptions)
        ) : hasDebtContent ? (
          <Text style={styles.sectionEmptyHint}>暂无持续订阅</Text>
        ) : null}
      </ScrollView>
    );
  };

  const renderStoredCardsTab = () => {
    const hasActiveCards = sortedActiveStoredCards.length > 0;
    const hasArchivedCards = archivedStoredCards.length > 0;
    const showHistoryFirst = !hasActiveCards && hasArchivedCards;

    return (
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <SectionToolbar
          title="在用卡包"
          sortSummary={storedCardSortSummary}
          layoutMode={storedCardLayoutMode}
          onPressSort={() => setSortSheetTarget('stored_cards')}
          onToggleLayout={toggleStoredCardLayoutMode}
        />

        {showHistoryFirst && (
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowArchivedCards(value => !value)}
            activeOpacity={0.75}
          >
            <Text style={styles.historyToggleText}>
              {showArchivedCards ? '收起' : '显示'}已隐藏 ({archivedStoredCards.length})
            </Text>
          </TouchableOpacity>
        )}

        {hasActiveCards && renderStoredCardList(sortedActiveStoredCards)}

        {!hasActiveCards && !hasArchivedCards && (
          <EmptyState message="还没有沉睡卡包记录" icon="💳" />
        )}

        {hasActiveCards && hasArchivedCards && (
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowArchivedCards(value => !value)}
            activeOpacity={0.75}
          >
            <Text style={styles.historyToggleText}>
              {showArchivedCards ? '收起' : '显示'}已隐藏 ({archivedStoredCards.length})
            </Text>
          </TouchableOpacity>
        )}

        {showArchivedCards && sortedArchivedStoredCards.length > 0 && (
          <>
            <Text style={styles.subSectionTitle}>已隐藏 ({sortedArchivedStoredCards.length})</Text>
            {renderStoredCardList(sortedArchivedStoredCards)}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <StatusBar style="light" translucent backgroundColor="transparent" animated />
      <View style={styles.container}>
        <DashboardHeroHeader
          activeTab={activeTab}
          topPadding={insets.top + THEME.spacing.xl}
          chrome={chrome}
          assetDailyCost={filteredTotalAssetDailyCost}
          assetSummary={assetHeroSummary}
          selectedAssetCategory={selectedAssetCategory}
          isAssetFiltered={isAssetFiltered}
          totalDebtDailyCost={totalDebtDailyCost}
          totalInstallmentDebt={totalInstallmentDebt}
          totalSubscriptionCost={totalSubscriptionCost}
          totalPrincipal={totalPrincipal}
          activeStoredCardCount={activeStoredCards.length}
          onPressStatistics={() => navigation.navigate('Statistics')}
          onPressSettings={() => navigation.navigate('Settings')}
          onPressHelp={() => setHelpModalVisible(true)}
          onPressAssetFilterTrigger={() => setAssetFilterSheetVisible(true)}
          onClearAssetFilter={() => setSelectedAssetCategoryId(null)}
        />

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assets' && styles.tabActive]}
            onPress={() => setActiveTab('assets')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'assets' && styles.tabTextActive]}>
              买断资产
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'debts' && styles.tabActiveDebt]}
            onPress={() => setActiveTab('debts')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'debts' && styles.tabTextActiveDebt]}>
              每日消耗
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stored_cards' && styles.tabActiveStored]}
            onPress={() => setActiveTab('stored_cards')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'stored_cards' && styles.tabTextActiveStored]}>
              沉睡卡包
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'assets' && renderAssetsTab()}
        {activeTab === 'debts' && renderDebtsTab()}
        {activeTab === 'stored_cards' && renderStoredCardsTab()}

        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => {
            if (activeTab === 'assets') {
              navigation.navigate('AddEditItem');
              return;
            }

            setAddModalVisible(true);
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <Modal visible={addModalVisible} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modal}>
              {activeTab === 'stored_cards' ? (
                <>
                  <Text style={styles.modalTitle}>新增沉睡卡包</Text>
                  <Text style={styles.modalDesc}>请选择卡片类型</Text>
                  <View style={styles.modalActions}>
                    <BrutalButton
                      title="储值卡"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditStoredCard', { defaultCardType: 'amount' });
                      }}
                      variant="accent"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="计次卡"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditStoredCard', { defaultCardType: 'count' });
                      }}
                      variant="primary"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="取消"
                      onPress={() => setAddModalVisible(false)}
                      variant="outline"
                      size="md"
                      style={styles.modalBtn}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>新增每日消耗</Text>
                  <Text style={styles.modalDesc}>请选择要新增的类型</Text>
                  <View style={styles.modalActions}>
                    <BrutalButton
                      title="新增分期物品"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditItem', { defaultIsInstallment: true });
                      }}
                      variant="danger"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="新增周期订阅"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditSubscription');
                      }}
                      variant="accent"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="取消"
                      onPress={() => setAddModalVisible(false)}
                      variant="outline"
                      size="md"
                      style={styles.modalBtn}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        <AssetCategorySheet
          visible={assetFilterSheetVisible}
          selectedCategoryId={selectedAssetCategoryId}
          categories={activeAssetCategoriesForSheet}
          onClose={() => setAssetFilterSheetVisible(false)}
          onSelect={categoryId => {
            setSelectedAssetCategoryId(categoryId);
            setAssetFilterSheetVisible(false);
          }}
          onPressManageCategories={() => {
            setAssetFilterSheetVisible(false);
            navigation.navigate('Categories');
          }}
        />

        <AppBottomSheet
          visible={sortSheetConfig !== null}
          title={sortSheetConfig?.title}
          onClose={() => setSortSheetTarget(null)}
          footer={(
            <BrutalButton
              title="完成"
              onPress={() => setSortSheetTarget(null)}
              variant="primary"
              size="sm"
              style={styles.sheetCloseButton}
            />
          )}
        >
          <Text style={styles.sheetSectionTitle}>按什么排</Text>
          <View style={styles.sheetOptionRow}>
            {sortSheetConfig?.fields.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sheetOptionChip,
                  sortSheetConfig?.currentField === option.value && styles.sheetOptionChipActive,
                ]}
                onPress={() => sortSheetConfig?.onSelectField(option.value)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    sortSheetConfig?.currentField === option.value && styles.sheetOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sheetSectionTitle}>顺序</Text>
          <View style={styles.sheetOptionRow}>
            <TouchableOpacity
              style={[
                styles.sheetOptionChip,
                sortSheetConfig?.currentDirection === 'desc' && styles.sheetOptionChipActive,
              ]}
              onPress={() => sortSheetConfig?.onSelectDirection('desc')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.sheetOptionText,
                  sortSheetConfig?.currentDirection === 'desc' && styles.sheetOptionTextActive,
                ]}
              >
                降序
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sheetOptionChip,
                sortSheetConfig?.currentDirection === 'asc' && styles.sheetOptionChipActive,
              ]}
              onPress={() => sortSheetConfig?.onSelectDirection('asc')}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.sheetOptionText,
                  sortSheetConfig?.currentDirection === 'asc' && styles.sheetOptionTextActive,
                ]}
              >
                升序
              </Text>
            </TouchableOpacity>
          </View>
        </AppBottomSheet>

        <Modal visible={helpModalVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.overlay}
            onPress={() => setHelpModalVisible(false)}
            activeOpacity={1}
          >
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>这笔账怎么算？</Text>

              <View style={styles.helpSection}>
                <View style={[styles.helpTag, { backgroundColor: THEME.colors.primary }]}>
                  <Text style={styles.helpTagText}>买断资产</Text>
                </View>
                <Text style={styles.helpBody}>
                  一次性买下来的东西，越用越回本。首页统计的是在用资产的日均成本。
                </Text>
                <View style={styles.helpFormula}>
                  <Text style={styles.helpFormulaText}>
                    日均成本 = (买入价格 - 卖出价格) / 激活天数
                  </Text>
                </View>
              </View>

              <View style={styles.helpDivider} />

              <View style={styles.helpSection}>
                <View style={[styles.helpTag, { backgroundColor: '#E17055' }]}>
                  <Text style={styles.helpTagText}>每日消耗</Text>
                </View>
                <Text style={styles.helpBody}>
                  分期和订阅都会构成每天的固定流失。它们的排序只在各自 section 内生效，不会混排。
                </Text>
                <View style={styles.helpFormula}>
                  <Text style={styles.helpFormulaText}>
                    分期日供 = 月供 / 30；订阅日均按周期价格折算
                  </Text>
                </View>
              </View>

              <View style={styles.helpDivider} />

              <View style={styles.helpSection}>
                <View style={[styles.helpTag, { backgroundColor: '#E6A817' }]}>
                  <Text style={styles.helpTagText}>沉睡卡包</Text>
                </View>
                <Text style={styles.helpBody}>
                  这里记录的是你已经付出去、却还躺在商家那里的余额或次数。越久不更新，越容易遗忘。
                </Text>
                <View style={styles.helpFormula}>
                  <Text style={styles.helpFormulaText}>
                    实际沉睡本金 = 当前剩余面值 × (实际支付 / 总面值)
                  </Text>
                </View>
              </View>

              <BrutalButton
                title="明白了"
                onPress={() => setHelpModalVisible(false)}
                variant="primary"
                size="sm"
                style={styles.helpCloseBtn}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: THEME.spacing.sm + 2,
    borderRadius: THEME.borderRadius,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.primaryLight + '30',
  },
  tabActiveDebt: {
    borderColor: '#C0392B',
    backgroundColor: 'rgba(231,76,60,0.2)',
  },
  tabActiveStored: {
    borderColor: '#B8860B',
    backgroundColor: THEME.colors.warning + '33',
  },
  tabText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  tabTextActiveDebt: {
    color: '#C0392B',
    fontWeight: '700',
  },
  tabTextActiveStored: {
    color: '#856404',
    fontWeight: '700',
  },
  list: {
    padding: THEME.spacing.lg,
    paddingBottom: 88,
  },
  sectionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  sectionToolbarTitle: {
    width: 72,
    fontSize: THEME.fontSize.lg,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  sortTriggerButton: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
  },
  sortTriggerText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  layoutIconButton: {
    width: 38,
    height: 38,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  layoutIconText: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  historyToggle: {
    alignSelf: 'flex-start',
    paddingVertical: THEME.spacing.xs,
    marginBottom: THEME.spacing.sm,
  },
  historyToggleText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  subSectionTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
  },
  sectionEmptyHint: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  gridCard: {
    flex: 1,
  },
  gridCardPlaceholder: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: THEME.spacing.xl,
    bottom: THEME.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: THEME.colors.primary,
    borderWidth: 2,
    borderColor: THEME.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.pixelShadow,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 32,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '88%',
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    padding: THEME.spacing.xl,
  },
  modalTitle: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  modalDesc: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
  },
  modalActions: {
    gap: THEME.spacing.sm,
  },
  modalBtn: {
    width: '100%',
  },
  sheetSectionTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.lg,
  },
  sheetOptionChip: {
    flex: 1,
    paddingVertical: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.sm,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
  },
  sheetOptionChipActive: {
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.primaryLight + '30',
  },
  sheetOptionText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  sheetOptionTextActive: {
    color: THEME.colors.primary,
  },
  sheetCloseButton: {
    width: '100%',
  },
  helpSection: {
    marginBottom: 4,
  },
  helpTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: THEME.spacing.xs,
  },
  helpTagText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  helpBody: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    marginBottom: THEME.spacing.sm,
  },
  helpFormula: {
    backgroundColor: THEME.colors.background,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.border,
  },
  helpFormulaText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  helpDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: THEME.spacing.md,
  },
  helpCloseBtn: {
    marginTop: THEME.spacing.md,
    width: '100%',
  },
});
