import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import { calculateSubscriptionDailyCost } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
import { CardShell, CARD_VARIANT_COLORS } from './CardShell';
import type { Subscription } from '../types';

interface SubscriptionCardProps {
  subscription: Subscription;
  onPress: () => void;
  style?: ViewStyle;
}

export function SubscriptionCard({ subscription, onPress, style }: SubscriptionCardProps) {
  const { getCategoryInfo } = useCategories();
  const category = getCategoryInfo('subscription', subscription.category ?? 'other');
  const icon = subscription.icon ?? category.icon;
  const dailyCost = calculateSubscriptionDailyCost(
    subscription.cycle_price,
    subscription.billing_cycle,
  );
  const cycleLabel =
    subscription.billing_cycle === 'monthly'
      ? '月付'
      : subscription.billing_cycle === 'quarterly'
        ? '季付'
        : '年付';

  const variantColors = CARD_VARIANT_COLORS['subscription'];

  return (
    <CardShell
      onPress={onPress}
      variant="subscription"
      style={style}
    >
      {/* 顶部：图标 + 名称 + 状态 */}
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: variantColors.iconBg + '30' }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>{subscription.name}</Text>
          <Text style={styles.category}>{category.name}</Text>
        </View>
        <StatusBadge status={subscription.status} />
      </View>

      {/* 底部：关键数值 */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{cycleLabel}</Text>
          <Text style={styles.statValue}>{formatCurrency(subscription.cycle_price)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>开始</Text>
          <Text style={styles.statValue}>{subscription.start_date}</Text>
        </View>
        <View style={[styles.statItem, styles.statHighlight, { backgroundColor: variantColors.statHighlightBg + '18' }]}>
          <Text style={styles.statLabel}>日均</Text>
          <Text style={[styles.statValue, styles.dailyCost, { color: variantColors.accentText }]}>
            {formatCurrency(dailyCost)}
          </Text>
        </View>
      </View>
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
});
