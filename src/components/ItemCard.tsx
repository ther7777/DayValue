import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import {
  calculateDaysUsed,
  calculateDailyCost,
  calculateDailyDebt,
  calculateOneTimeItemActiveDays,
  calculateRealizedProfit,
  isProfitableSale,
} from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
import { CardShell, CARD_VARIANT_COLORS } from './CardShell';
import { EntityCover } from './EntityCover';
import type { OneTimeItem } from '../types';

type ItemCardLayout = 'list' | 'grid';

interface ItemCardProps {
  item: OneTimeItem;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  layout?: ItemCardLayout;
}

export function ItemCard({ item, onPress, style, layout = 'list' }: ItemCardProps) {
  const { getCategoryInfo } = useCategories();
  const category = getCategoryInfo('item', item.category ?? 'other');
  const icon = item.icon ?? category.icon;
  const imageUri = item.image_uri ?? null;
  const isGrid = layout === 'grid';

  const isUnredeemed = item.status === 'unredeemed';
  const activeDays = calculateOneTimeItemActiveDays(item);
  const archivedReason = item.archived_reason ?? (item.salvage_value > 0 ? 'sold' : 'paused');
  const isSold = item.status === 'archived' && archivedReason === 'sold';
  const isProfitableSold = isSold && isProfitableSale(item.total_price, item.salvage_value);
  const realizedProfit = isSold ? calculateRealizedProfit(item.total_price, item.salvage_value) : 0;
  const dailyCost = calculateDailyCost(item.total_price, isSold ? item.salvage_value : 0, activeDays);
  const dailyDebt = calculateDailyDebt(item.monthly_payment ?? 0);

  const archivedLabel =
    item.status !== 'archived'
      ? undefined
      : archivedReason === 'sold'
        ? '已售出'
        : '已停用';

  const totalMonths = item.installment_months ?? 0;
  const monthsPaid = isUnredeemed && totalMonths > 0
    ? Math.min(Math.floor(calculateDaysUsed(item.buy_date, null) / 30), totalMonths)
    : 0;
  const barBlocks = 10;
  const filledBlocks = totalMonths > 0 ? Math.round((monthsPaid / totalMonths) * barBlocks) : 0;

  const variant = isUnredeemed ? 'debt' : 'asset';
  const variantColors = CARD_VARIANT_COLORS[variant];
  const highlightLabel = isUnredeemed ? '日供' : isProfitableSold ? '盈利' : '日均';
  const highlightValue = isUnredeemed
    ? formatCurrency(dailyDebt)
    : isProfitableSold
      ? formatCurrency(realizedProfit)
      : formatCurrency(dailyCost);

  if (isGrid) {
    return (
      <CardShell onPress={onPress} variant={variant} style={[styles.gridCard, style]}>
        <View style={styles.gridTop}>
          <EntityCover
            imageUri={imageUri}
            icon={icon}
            size={52}
            iconSize={26}
            backgroundColor={variantColors.iconBg + '30'}
          />
          <View style={styles.gridTopContent}>
            <View style={styles.gridBadgeRow}>
              <StatusBadge status={item.status} labelOverride={archivedLabel} />
            </View>
            <Text style={styles.gridName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.gridCategory} numberOfLines={1}>{category.name}</Text>
          </View>
        </View>

        <View style={styles.gridStats}>
          <View style={styles.gridStatBlock}>
            <Text style={styles.gridStatLabel}>{isUnredeemed ? '月供' : '买入'}</Text>
            <Text style={styles.gridStatValue}>
              {formatCurrency(isUnredeemed ? (item.monthly_payment ?? 0) : item.total_price)}
            </Text>
          </View>
          <View style={styles.gridStatBlock}>
            <Text style={styles.gridStatLabel}>{isUnredeemed ? '期数' : '激活'}</Text>
            <Text style={styles.gridStatValue}>
              {isUnredeemed ? `${item.installment_months ?? 0} 个月` : `${activeDays} 天`}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.gridHighlight,
            { backgroundColor: variantColors.statHighlightBg + '18' },
          ]}
        >
          <Text style={styles.gridHighlightLabel}>{highlightLabel}</Text>
          <Text style={[styles.gridHighlightValue, { color: variantColors.accentText }]}>
            {highlightValue}
          </Text>
        </View>
      </CardShell>
    );
  }

  return (
    <CardShell onPress={onPress} variant={variant} style={style}>
      <View style={styles.header}>
        <EntityCover
          imageUri={imageUri}
          icon={icon}
          backgroundColor={variantColors.iconBg + '30'}
          style={styles.iconBox}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.category}>{category.name}</Text>
        </View>
        <StatusBadge status={item.status} labelOverride={archivedLabel} />
      </View>

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
            <View style={[styles.statItem, styles.statHighlight, { backgroundColor: variantColors.statHighlightBg + '18' }]}>
              <Text style={styles.statLabel}>日供</Text>
              <Text style={[styles.statValue, styles.dailyCost, { color: variantColors.accentText }]}>
                {formatCurrency(dailyDebt)}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>买入</Text>
              <Text style={styles.statValue}>{formatCurrency(item.total_price)}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>激活</Text>
              <Text style={styles.statValue}>{activeDays} 天</Text>
            </View>
            <View style={[styles.statItem, styles.statHighlight, { backgroundColor: variantColors.statHighlightBg + '18' }]}>
              <Text style={styles.statLabel}>{isProfitableSold ? '盈利' : '日均'}</Text>
              <Text style={[styles.statValue, styles.dailyCost, { color: variantColors.accentText }]}>
                {isProfitableSold ? formatCurrency(realizedProfit) : formatCurrency(dailyCost)}
              </Text>
            </View>
          </>
        )}
      </View>

      {isUnredeemed && totalMonths > 0 && (
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>赎身进度</Text>
          <View style={styles.progressBar}>
            {Array.from({ length: barBlocks }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressBlock,
                  index < filledBlocks ? styles.progressBlockFilled : styles.progressBlockEmpty,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressText}>{monthsPaid} / {totalMonths} 月</Text>
        </View>
      )}
    </CardShell>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: THEME.spacing.md,
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
  gridCard: {
    minHeight: 188,
    marginBottom: 0,
    padding: THEME.spacing.sm + 2,
  },
  gridTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.sm,
    gap: THEME.spacing.sm,
  },
  gridTopContent: {
    flex: 1,
    minHeight: 52,
  },
  gridBadgeRow: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  gridName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    minHeight: 34,
  },
  gridCategory: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
    marginBottom: THEME.spacing.xs,
  },
  gridStats: {
    flexDirection: 'row',
    gap: THEME.spacing.xs,
    marginBottom: THEME.spacing.xs,
  },
  gridStatBlock: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: THEME.spacing.xs,
    borderRadius: 4,
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  gridStatLabel: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  gridStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  gridHighlight: {
    borderRadius: 4,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.sm,
    marginTop: 'auto',
  },
  gridHighlightLabel: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  gridHighlightValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: THEME.fontFamily.pixel,
  },
});
