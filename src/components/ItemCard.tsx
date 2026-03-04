import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { THEME, getCategoryInfo } from '../utils/constants';
import { calculateDaysUsed, calculateDailyCost, calculateDailyDebt } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
import type { OneTimeItem } from '../types';

interface ItemCardProps {
  item: OneTimeItem;
  onPress: () => void;
  style?: ViewStyle;
}

export function ItemCard({ item, onPress, style }: ItemCardProps) {
  const category = getCategoryInfo(item.category ?? 'other');
  const icon = item.icon ?? category.icon;

  const isUnredeemed = item.status === 'unredeemed';
  const daysUsed = calculateDaysUsed(item.buy_date, item.end_date);
  const dailyCost = calculateDailyCost(item.total_price, item.salvage_value, daysUsed);
  const dailyDebt = calculateDailyDebt(item.monthly_payment ?? 0);

  // 赎身进度计算：以 30天为一个月供估算已还期数
  const totalMonths = item.installment_months ?? 0;
  const monthsPaid = isUnredeemed && totalMonths > 0
    ? Math.min(Math.floor(calculateDaysUsed(item.buy_date, null) / 30), totalMonths)
    : 0;
  const BAR_BLOCKS = 10;
  const filledBlocks = totalMonths > 0 ? Math.round((monthsPaid / totalMonths) * BAR_BLOCKS) : 0;

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* 顶部：图标 + 名称 + 状态 */}
      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.category}>{category.name}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {/* 底部：关键数值 */}
      <View style={styles.stats}>
        {isUnredeemed ? (
          <>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>月供</Text>
              <Text style={styles.statValue}>{formatCurrency(item.monthly_payment ?? 0)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>期数</Text>
              <Text style={styles.statValue}>{item.installment_months ?? 0} 个月</Text>
            </View>
            <View style={[styles.statItem, styles.statHighlight]}>
              <Text style={styles.statLabel}>日供</Text>
              <Text style={[styles.statValue, styles.dailyCost]}>
                {formatCurrency(dailyDebt)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>购入</Text>
              <Text style={styles.statValue}>{formatCurrency(item.total_price)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>已用</Text>
              <Text style={styles.statValue}>{daysUsed} 天</Text>
            </View>
            <View style={[styles.statItem, styles.statHighlight]}>
              <Text style={styles.statLabel}>日均</Text>
              <Text style={[styles.statValue, styles.dailyCost]}>
                {formatCurrency(dailyCost)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* 赎身进度条（仅分期未赎身物品显示） */}
      {isUnredeemed && totalMonths > 0 && (
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>赎身进度</Text>
          <View style={styles.progressBar}>
            {Array.from({ length: BAR_BLOCKS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressBlock,
                  i < filledBlocks ? styles.progressBlockFilled : styles.progressBlockEmpty,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressText}>{monthsPaid} / {totalMonths} 期</Text>
        </View>
      )}

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: THEME.colors.primaryLight + '30',
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: THEME.spacing.md,
  },
  iconText: {
    fontSize: 22,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  category: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: 1,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: THEME.spacing.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statHighlight: {
    backgroundColor: THEME.colors.primaryLight + '18',
    marginHorizontal: -2,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statLabel: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  dailyCost: {
    color: THEME.colors.primary,
    fontFamily: THEME.fontFamily.pixel,
    fontSize: THEME.fontSize.sm,
  },
  progressSection: {
    marginTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    paddingTop: THEME.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
  },
  progressLabel: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    width: 42,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 2,
    flex: 1,
  },
  progressBlock: {
    flex: 1,
    height: 8,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: THEME.colors.borderDark,
  },
  progressBlockFilled: {
    backgroundColor: THEME.colors.warning,
  },
  progressBlockEmpty: {
    backgroundColor: THEME.colors.background,
  },
  progressText: {
    fontSize: THEME.fontSize.xs,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    minWidth: 48,
    textAlign: 'right',
  },
});
