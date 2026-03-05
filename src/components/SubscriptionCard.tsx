import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import { calculateSubscriptionDailyCost } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
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
        <View style={[styles.statItem, styles.statHighlight]}>
          <Text style={styles.statLabel}>日均</Text>
          <Text style={[styles.statValue, styles.dailyCost]}>
            {formatCurrency(dailyCost)}
          </Text>
        </View>
      </View>
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
    backgroundColor: THEME.colors.accentLight + '30',
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
    backgroundColor: THEME.colors.accentLight + '18',
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
    color: THEME.colors.accent,
    fontFamily: THEME.fontFamily.pixel,
    fontSize: THEME.fontSize.sm,
  },
});
