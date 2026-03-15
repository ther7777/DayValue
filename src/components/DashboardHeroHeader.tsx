import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CategoryInfo } from '../types';
import { THEME } from '../utils/constants';
import { formatCurrency } from '../utils/formatters';
import { AssetFilterChip } from './AssetFilterChip';

type DashboardTabKey = 'assets' | 'debts' | 'stored_cards';

interface DashboardHeroHeaderProps {
  activeTab: DashboardTabKey;
  topPadding: number;
  chrome: {
    backgroundColor: string;
    borderColor: string;
    subtitleColor?: string;
    costColor?: string;
    hintColor?: string;
  };
  assetDailyCost: number;
  assetSummary: string;
  selectedAssetCategory: CategoryInfo | null;
  isAssetFiltered: boolean;
  totalDebtDailyCost: number;
  totalInstallmentDebt: number;
  totalSubscriptionCost: number;
  totalPrincipal: number;
  activeStoredCardCount: number;
  onPressStatistics: () => void;
  onPressSettings: () => void;
  onPressHelp: () => void;
  onPressAssetFilterTrigger: () => void;
  onClearAssetFilter: () => void;
}

export function DashboardHeroHeader({
  activeTab,
  topPadding,
  chrome,
  assetDailyCost,
  assetSummary,
  selectedAssetCategory,
  isAssetFiltered,
  totalDebtDailyCost,
  totalInstallmentDebt,
  totalSubscriptionCost,
  totalPrincipal,
  activeStoredCardCount,
  onPressStatistics,
  onPressSettings,
  onPressHelp,
  onPressAssetFilterTrigger,
  onClearAssetFilter,
}: DashboardHeroHeaderProps) {
  return (
    <View
      style={[
        styles.hero,
        {
          backgroundColor: chrome.backgroundColor,
          borderBottomColor: chrome.borderColor,
          paddingTop: topPadding,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>DayValue</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPressStatistics}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPressSettings}
            activeOpacity={0.7}
          >
            <Text style={styles.iconText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={onPressHelp}
            activeOpacity={0.7}
          >
            <Text style={styles.helpText}>?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'assets' && (
        <>
          <View style={styles.assetSubtitleRow}>
            <Text
              style={styles.assetSubtitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              今日日均成本 ·
            </Text>
            <AssetFilterChip
              selectedCategory={selectedAssetCategory}
              isFiltered={isAssetFiltered}
              onPressTrigger={onPressAssetFilterTrigger}
              onClear={onClearAssetFilter}
            />
          </View>
          <Text style={styles.cost}>
            {formatCurrency(assetDailyCost)}
            <Text style={styles.unit}>/天</Text>
          </Text>
          <Text style={styles.assetHint}>{assetSummary}</Text>
        </>
      )}

      {activeTab === 'debts' && (
        <>
          <Text style={[styles.subtitle, styles.debtSubtitle]}>今日固定流失</Text>
          <Text style={styles.cost}>
            {formatCurrency(totalDebtDailyCost)}
            <Text style={styles.unit}>/天</Text>
          </Text>
          <Text style={styles.assetHint}>
            分期日供 {formatCurrency(totalInstallmentDebt)} · 订阅日均 {formatCurrency(totalSubscriptionCost)}
          </Text>
        </>
      )}

      {activeTab === 'stored_cards' && (
        <>
          <Text style={[styles.subtitle, styles.storedSubtitle]}>实际沉睡本金</Text>
          <Text style={[styles.cost, chrome.costColor ? { color: chrome.costColor } : null]}>
            {formatCurrency(totalPrincipal)}
          </Text>
          <Text
            style={[
              styles.storedHint,
              chrome.hintColor ? { color: chrome.hintColor } : null,
            ]}
          >
            共 {activeStoredCardCount} 张在用卡包 · 越早更新越不容易遗忘
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: THEME.spacing.xl,
    paddingBottom: THEME.spacing.lg,
    borderBottomWidth: 2,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontFamily: THEME.fontFamily.pixel,
    color: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: 14,
  },
  helpButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  assetSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    minWidth: 0,
    marginTop: 6,
    marginBottom: 4,
  },
  assetSubtitle: {
    fontSize: THEME.fontSize.sm,
    color: '#FFFFFFCC',
    fontWeight: '700',
    marginRight: THEME.spacing.xs,
    flexShrink: 0,
  },
  subtitle: {
    fontSize: THEME.fontSize.sm,
    color: '#FFFFFFAA',
    marginBottom: 4,
    marginTop: 6,
  },
  debtSubtitle: {
    color: '#FFD8CC',
  },
  storedSubtitle: {
    color: '#FFE89A',
  },
  cost: {
    fontSize: 22,
    fontFamily: THEME.fontFamily.pixel,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  unit: {
    fontSize: THEME.fontSize.sm,
    fontFamily: undefined,
  },
  assetHint: {
    fontSize: THEME.fontSize.xs,
    color: '#FFFFFFCC',
    lineHeight: 18,
  },
  storedHint: {
    fontSize: THEME.fontSize.xs,
    color: '#FFE89ACC',
    fontWeight: '700',
    lineHeight: 18,
  },
});
