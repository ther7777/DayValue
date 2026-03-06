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
import { calculateDailyDebt, calculateStoredPrincipal, calculateSubscriptionDailyCost } from '../utils/calculations';
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

function fallbackCategory(categoryId: string): CategoryInfo {
  if (categoryId === 'other') return { id: 'other', name: '其他', icon: '📦' };
  return { id: categoryId, name: categoryId, icon: '🏷️' };
}

function buildPieSeries(
  sumsByCategoryId: Map<string, number>,
  resolveInfo: (categoryId: string) => CategoryInfo,
): PieSeriesItem[] {
  const entries = Array.from(sumsByCategoryId.entries())
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([categoryId, value], idx) => {
    const info = resolveInfo(categoryId);
    return {
      categoryId,
      name: info.name,
      icon: info.icon,
      value,
      color: PALETTE[idx % PALETTE.length],
    };
  });
}

function toPieChartData(series: PieSeriesItem[]) {
  return series.map(s => ({
    name: `${s.icon} ${s.name}`,
    population: s.value,
    color: s.color,
    legendFontColor: THEME.colors.textSecondary,
    legendFontSize: 12,
  }));
}

function formatPercent(value: number, total: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return '0%';
  const pct = (value / total) * 100;
  if (!Number.isFinite(pct) || pct <= 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${pct.toFixed(0)}%`;
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
      {series.map(s => (
        <View key={s.categoryId} style={styles.legendRow}>
          <View style={styles.legendLeft}>
            <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {s.icon} {s.name}
            </Text>
          </View>
          <Text style={styles.legendMeta} numberOfLines={1}>
            {formatPercent(s.value, total)} · {formatCurrency(s.value)}
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
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [cards, setCards] = useState<StoredCard[]>([]);

  const load = useCallback(async () => {
    try {
      const [i, s, c] = await Promise.all([
        getAllOneTimeItems(db),
        getAllSubscriptions(db),
        getAllStoredCards(db),
      ]);
      setItems(i);
      setSubs(s);
      setCards(c);
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
      itemCategories.find(c => c.id === categoryId) ?? fallbackCategory(categoryId),
    [itemCategories],
  );

  const resolveAnyCategory = useCallback(
    (categoryId: string) =>
      subscriptionCategories.find(c => c.id === categoryId) ??
      itemCategories.find(c => c.id === categoryId) ??
      fallbackCategory(categoryId),
    [itemCategories, subscriptionCategories],
  );

  const resolveStoredCardCategory = useCallback(
    (categoryId: string) =>
      storedCardCategories.find(c => c.id === categoryId) ?? fallbackCategory(categoryId),
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
      const v = calculateDailyDebt(item.monthly_payment ?? 0);
      sums.set(categoryId, (sums.get(categoryId) ?? 0) + v);
    }

    for (const sub of subs) {
      if (sub.status !== 'active') continue;
      const categoryId = sub.category ?? 'other';
      const v = calculateSubscriptionDailyCost(sub.cycle_price, sub.billing_cycle);
      sums.set(categoryId, (sums.get(categoryId) ?? 0) + v);
    }

    return buildPieSeries(sums, resolveAnyCategory);
  }, [items, resolveAnyCategory, subs]);

  const totalAssets = useMemo(
    () => assetSeries.reduce((sum, d) => sum + d.value, 0),
    [assetSeries],
  );
  const totalDaily = useMemo(
    () => dailySeries.reduce((sum, d) => sum + d.value, 0),
    [dailySeries],
  );

  const storedCardSeries = useMemo(() => {
    const sums = new Map<string, number>();
    for (const card of cards) {
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
  }, [cards, resolveStoredCardCategory]);

  const totalStoredPrincipal = useMemo(
    () => storedCardSeries.reduce((sum, d) => sum + d.value, 0),
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
          <Text style={styles.title}>买断资产 · 分类价值占比</Text>
          <Text style={styles.subTitle}>合计：{formatCurrency(totalAssets)}</Text>
          {assetSeries.length === 0 ? (
            <EmptyState message="暂无数据，先去添加一些买断资产吧。" icon="🧾" />
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
          <Text style={styles.title}>每日消耗 · 分类金额占比</Text>
          <Text style={styles.subTitle}>合计：{formatCurrency(totalDaily)} / 天</Text>
          {dailySeries.length === 0 ? (
            <EmptyState message="暂无数据，先去添加分期物品或订阅吧。" icon="🪙" />
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
          <Text style={styles.title}>🟨 沉睡卡包 · 实际沉睡本金占比</Text>
          <Text style={styles.subTitle}>合计：{formatCurrency(totalStoredPrincipal)}</Text>
          {storedCardSeries.length === 0 ? (
            <EmptyState message="暂无储值卡数据，去首页卡包标签添加吧。" icon="💳" />
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
