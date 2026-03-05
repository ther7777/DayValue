import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../utils/constants';

interface StatusBadgeProps {
  status: 'unredeemed' | 'active' | 'archived';
  /** 区分实体类型，影响"已隐藏"的文案 */
  type?: 'item' | 'subscription' | 'stored_card';
}

export function StatusBadge({ status, type = 'item' }: StatusBadgeProps) {
  const label =
    status === 'unredeemed'
      ? '未赎身'
      : status === 'active'
        ? '在用'
        : type === 'subscription'
          ? '已退订'
          : type === 'stored_card'
            ? '已隐藏'
          : '已隐藏';

  const backgroundColor =
    status === 'active'
      ? THEME.colors.success
      : status === 'unredeemed'
        ? THEME.colors.danger
        : THEME.colors.textLight;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor },
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
  },
  text: {
    fontSize: THEME.fontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
