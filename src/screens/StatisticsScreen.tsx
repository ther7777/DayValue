import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PieChart } from 'react-native-chart-kit';

import type { CategoryInfo, OneTimeItem, RootStackParamList, StoredCard, Subscription } from '../types';
import { getAllOneTimeItems, getAllStoredCards, getAllSubscriptions } from '../database';
import { useCategories } from '../contexts/CategoriesContext';
import {
  calculateDailyDebt,
  calculateStoredPrincipal,
  calculateSubscriptionDailyCost,
} from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { THEME } from '../utils/constants';
import { EmptyState } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Statistics'>;

type PieSeriesItem = {
  categoryId: string;
  name: string;
  icon: string;
  value: number;
  color: string;
};

const PALETTE = [
  '#6C5CE7',
  '#00CEC9',
  '#0984E3',
  '#00B894',
  '#FDCB6E',
  '#E17055',
  '#D63031',
  '#A29BFE',
  '#81ECEC',
  '#74B9FF',
];

function fallbackCategory(
  categoryId: string,
  type: 'item' | 'subscription' | 'stored_card',
): CategoryInfo {
  if (categoryId === 'other') {
    if (type === 'subscription') return { id: 'other', name: '其他服务', icon: '📦' };
    if (type === 'stored_card') return { id: 'other', name: '其他卡包', icon: '💳' };
    return { id: 'other', name: '其他资产', icon: '📦' };
  }

  return { id: categoryId, name: categoryId, icon: '📦' };
}

function buildPieSeries(
  sumsByCategoryId: Map<string, number>,
  resolveInfo: (categoryId: string) => CategoryInfo,
): PieSeriesItem[] {
  const entries = Array.from(sumsByCategoryId.entries())
    .filter(([, value]) => value > 0)
    .sort(([left], [right]) => left.localeCompare(right));

  return entries.map(([categoryId, value], index) => {
    const info = resolveInfo(categoryId);
    return {
      categoryId,
      name: info.name,
      icon: info.icon,
      value,
      color: PALETTE[index % PALETTE.length],
    };
  });
}

function toPieChartData(series: PieSeriesItem[]) {
  return series.map(item => ({
    name: `${item.icon} ${item.name}`,
    population: item.value,
    color: item.color,
    legendFontColor: THEME.colors.textSecondary,
    legendFontSize: 12,
  }));
}

function formatPercent(value: number, total: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return '0%';
  const percent = (value / total) * 100;
  if (!Number.isFinite(percent) || percent <= 0) return '0%';
  if (percent < 0.1) return '<0.1%';
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${percent.toFixed(0)}%`;
}

function LegendList({
  series,
  total,
  valueSuffix,
}: {
  series: PieSeriesItem[];
  total: number;
  valueSuffix?: string;
}) {
  return (
    <View style={styles.legend}>
      {series.map(item => (
        <View key={item.categoryId} style={styles.legendRow}>
          <View style={styles.legendLeft}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {item.icon} {item.name}
            </Text>
          </View>
          <Text style={styles.legendMeta} numberOfLines={1}>
            {formatPercent(item.value, total)} · {formatCurrency(item.value)}
            {valueSuffix ?? ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function StatisticsScreen({}: Props) {
  const db = useSQLiteContext();
  const { itemCategories, subscriptionCategories, storedCardCategories } = useCategories();
  const [items, setItems] = useState<OneTimeItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [storedCards, setStoredCards] = useState<StoredCard[]>([]);

  const load = useCallback(async () => {
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
      console.error('加载统计数据失败', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const chartWidth = Math.min(Dimensions.get('window').width - THEME.spacing.xl * 2, 520);
  const piePaddingLeft = String(Math.round(chartWidth / 4));

  const resolveItemCategory = useCallback(
    (categoryId: string) =>
      itemCategories.find(category => category.id === categoryId) ??
      fallbackCategory(categoryId, 'item'),
    [itemCategories],
  );

  const resolveSubscriptionCategory = useCallback(
    (categoryId: string) =>
      subscriptionCategories.find(category => category.id === categoryId) ??
      itemCategories.find(category => category.id === categoryId) ??
      fallbackCategory(categoryId, 'subscription'),
    [itemCategories, subscriptionCategories],
  );

  const resolveStoredCardCategory = useCallback(
    (categoryId: string) =>
      storedCardCategories.find(category => category.id === categoryId) ??
      fallbackCategory(categoryId, 'stored_card'),
    [storedCardCategories],
  );

  const assetSeries = useMemo(() => {
    const sums = new Map<string, number>();
    for (const item of items) {
      if (item.status !== 'active') continue;
      const categoryId = item.category ?? 'other';
      sums.set(categoryId, (sums.get(categoryId) ?? 0) + item.total_price);
    }
    return buildPieSeries(sums, resolveItemCategory);
  }, [items, resolveItemCategory]);

  const dailySeries = useMemo(() => {
    const sums = new Map<string, number>();

    for (const item of items) {
      if (item.status !== 'unredeemed') continue;
      const categoryId = item.category ?? 'other';
      const dailyDebt = calculateDailyDebt(item.monthly_payment ?? 0);
      sums.set(categoryId, (sums.get(categoryId) ?? 0) + dailyDebt);
    }

    for (const subscription of subscriptions) {
      if (subscription.status !== 'active') continue;
      const categoryId = subscription.category ?? 'other';
      const dailyCost = calculateSubscriptionDailyCost(
        subscription.cycle_price,
        subscription.billing_cycle,
      );
      sums.set(categoryId, (sums.get(categoryId) ?? 0) + dailyCost);
    }

    return buildPieSeries(sums, resolveSubscriptionCategory);
  }, [items, resolveSubscriptionCategory, subscriptions]);

  const storedCardSeries = useMemo(() => {
    const sums = new Map<string, number>();
    for (const card of storedCards) {
      if (card.status !== 'active') continue;
      const categoryId = card.category ?? 'other';
      const principal = calculateStoredPrincipal(
        card.actual_paid,
        card.face_value,
        card.current_balance,
      );
      sums.set(categoryId, (sums.get(categoryId) ?? 0) + principal);
    }
    return buildPieSeries(sums, resolveStoredCardCategory);
  }, [resolveStoredCardCategory, storedCards]);

  const totalAssets = useMemo(
    () => assetSeries.reduce((sum, item) => sum + item.value, 0),
    [assetSeries],
  );
  const totalDaily = useMemo(
    () => dailySeries.reduce((sum, item) => sum + item.value, 0),
    [dailySeries],
  );
  const totalStoredPrincipal = useMemo(
    () => storedCardSeries.reduce((sum, item) => sum + item.value, 0),
    [storedCardSeries],
  );

  const chartConfig = useMemo(
    () => ({
      color: () => THEME.colors.textPrimary,
      labelColor: () => THEME.colors.textSecondary,
      backgroundGradientFrom: THEME.colors.surface,
      backgroundGradientTo: THEME.colors.surface,
    }),
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>在用资产 · 分类价值占比</Text>
          <Text style={styles.subTitle}>合计：{formatCurrency(totalAssets)}</Text>
          {assetSeries.length === 0 ? (
            <EmptyState message="暂无在用资产数据，先去添加一些大件资产吧。" icon="📦" />
          ) : (
            <>
              <PieChart
                data={toPieChartData(assetSeries)}
                width={chartWidth}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft={piePaddingLeft}
                hasLegend={false}
              />
              <LegendList series={assetSeries} total={totalAssets} />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>每日成本 · 分类金额占比</Text>
          <Text style={styles.subTitle}>合计：{formatCurrency(totalDaily)} / 天</Text>
          {dailySeries.length === 0 ? (
            <EmptyState message="暂无分期或订阅数据，先去添加长期成本项目吧。" icon="🧾" />
          ) : (
            <>
              <PieChart
                data={toPieChartData(dailySeries)}
                width={chartWidth}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft={piePaddingLeft}
                hasLegend={false}
              />
              <LegendList series={dailySeries} total={totalDaily} valueSuffix="/天" />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>卡包本金 · 分类占比</Text>
          <Text style={styles.subTitle}>合计：{formatCurrency(totalStoredPrincipal)}</Text>
          {storedCardSeries.length === 0 ? (
            <EmptyState message="暂无卡包数据，去首页卡包标签页添加一项吧。" icon="💳" />
          ) : (
            <>
              <PieChart
                data={toPieChartData(storedCardSeries)}
                width={chartWidth}
                height={220}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft={piePaddingLeft}
                hasLegend={false}
              />
              <LegendList series={storedCardSeries} total={totalStoredPrincipal} />
            </>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.xl,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subTitle: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  legend: {
    alignSelf: 'stretch',
    marginTop: THEME.spacing.sm,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: THEME.colors.borderDark,
  },
  legendName: {
    flex: 1,
    minWidth: 0,
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  legendMeta: {
    fontSize: THEME.fontSize.xs,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
});
