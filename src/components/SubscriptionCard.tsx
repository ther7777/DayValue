import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import { calculateSubscriptionDailyCost } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { StatusBadge } from './StatusBadge';
import { CardShell, CARD_VARIANT_COLORS } from './CardShell';
import { EntityCover } from './EntityCover';
import type { Subscription } from '../types';

type SubscriptionCardLayout = 'list' | 'grid';

interface SubscriptionCardProps {
  subscription: Subscription;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  layout?: SubscriptionCardLayout;
}

export function SubscriptionCard({
  subscription,
  onPress,
  style,
  layout = 'list',
}: SubscriptionCardProps) {
  const { getCategoryInfo } = useCategories();
  const category = getCategoryInfo('subscription', subscription.category ?? 'other');
  const icon = subscription.icon ?? category.icon;
  const imageUri = subscription.image_uri ?? null;
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

  const variantColors = CARD_VARIANT_COLORS.subscription;
  const isGrid = layout === 'grid';

  if (isGrid) {
    return (
      <CardShell
        onPress={onPress}
        variant="subscription"
        style={[styles.gridCard, style]}
      >
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
              <StatusBadge status={subscription.status} type="subscription" />
            </View>
            <Text style={styles.gridName} numberOfLines={2}>{subscription.name}</Text>
            <Text style={styles.gridCategory} numberOfLines={1}>{category.name}</Text>
          </View>
        </View>

        <View style={styles.gridStats}>
          <View style={styles.gridStatBlock}>
            <Text style={styles.gridStatLabel}>{cycleLabel}</Text>
            <Text style={styles.gridStatValue}>
              {formatCurrency(subscription.cycle_price)}
            </Text>
          </View>
          <View style={styles.gridStatBlock}>
            <Text style={styles.gridStatLabel}>开始</Text>
            <Text style={styles.gridStatValue} numberOfLines={1}>
              {subscription.start_date}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.gridHighlight,
            { backgroundColor: variantColors.statHighlightBg + '18' },
          ]}
        >
          <Text style={styles.gridHighlightLabel}>日均</Text>
          <Text style={[styles.gridHighlightValue, { color: variantColors.accentText }]}>
            {formatCurrency(dailyCost)}
          </Text>
        </View>
      </CardShell>
    );
  }

  return (
    <CardShell
      onPress={onPress}
      variant="subscription"
      style={style}
    >
      <View style={styles.header}>
        <EntityCover
          imageUri={imageUri}
          icon={icon}
          backgroundColor={variantColors.iconBg + '30'}
          style={styles.iconBox}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name} numberOfLines={1}>{subscription.name}</Text>
          <Text style={styles.category}>{category.name}</Text>
        </View>
        <StatusBadge status={subscription.status} type="subscription" />
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{cycleLabel}</Text>
          <Text style={styles.statValue}>{formatCurrency(subscription.cycle_price)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>开始</Text>
          <Text style={styles.statValue}>{subscription.start_date}</Text>
        </View>
        <View
          style={[
            styles.statItem,
            styles.statHighlight,
            { backgroundColor: variantColors.statHighlightBg + '18' },
          ]}
        >
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
