/**
 * CardShell - 三轨卡片共享壳层
 *
 * 抽取 ItemCard / SubscriptionCard / StoredCardCard 共用的视觉 DNA：
 *  • 2px 纯黑描边
 *  • 右下 (2,2) 偏移硬阴影（Neobrutalism 标志）
 *  • 统一内边距 & 圆角
 *
 * 用法：
 *  <CardShell onPress={...} variant="asset">
 *    {children}
 *  </CardShell>
 *
 * variant 差异仅体现在「图标色块」背景色与高亮栏底色，
 * 壳层本身保持统一。
 */
import React from 'react';
import { TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { THEME } from '../utils/constants';

export type CardVariant = 'asset' | 'debt' | 'subscription' | 'stored_card';

interface CardShellProps {
  children: React.ReactNode;
  onPress: () => void;
  /** 控制边框左侧色条（可选，默认无） */
  variant?: CardVariant;
  /** 是否处于特殊状态（如沉睡预警），改变边框色 */
  alert?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * 变体色映射：左侧色条 & 图标色块由各卡片自行处理，
 * 此处仅暴露变体对应的主题色，供子组件读取。
 */
export const CARD_VARIANT_COLORS: Record<CardVariant, {
  /** 图标色块背景（30% 透明度拼接用） */
  iconBg: string;
  /** 高亮统计栏底色（18% 透明度拼接用） */
  statHighlightBg: string;
  /** 日均/日供等强调数字颜色 */
  accentText: string;
}> = {
  asset: {
    iconBg: THEME.colors.primaryLight,
    statHighlightBg: THEME.colors.primaryLight,
    accentText: THEME.colors.primary,
  },
  debt: {
    iconBg: THEME.colors.warning,
    statHighlightBg: THEME.colors.warning,
    accentText: THEME.colors.dangerDark,
  },
  subscription: {
    iconBg: THEME.colors.accentLight,
    statHighlightBg: THEME.colors.accentLight,
    accentText: THEME.colors.accent,
  },
  stored_card: {
    iconBg: THEME.colors.highlight,
    statHighlightBg: THEME.colors.highlight,
    accentText: THEME.colors.danger,
  },
};

export function CardShell({
  children,
  onPress,
  alert = false,
  disabled = false,
  style,
}: CardShellProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        alert && styles.cardAlert,
        disabled && styles.cardDisabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
    borderWidth: THEME.pixelBorder.borderWidth,
    borderColor: THEME.pixelBorder.borderColor,
    borderRadius: THEME.pixelBorder.borderRadius,
    shadowColor: THEME.pixelShadow.shadowColor,
    shadowOffset: THEME.pixelShadow.shadowOffset,
    shadowOpacity: THEME.pixelShadow.shadowOpacity,
    shadowRadius: THEME.pixelShadow.shadowRadius,
    elevation: THEME.pixelShadow.elevation,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  } as ViewStyle,
  cardAlert: {
    borderColor: THEME.colors.warning,
    shadowColor: '#B7860B',
  },
  cardDisabled: {
    opacity: 0.55,
  },
});
