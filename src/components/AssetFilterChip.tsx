import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CategoryInfo } from '../types';
import { THEME } from '../utils/constants';

export interface AssetFilterChipProps {
  selectedCategory: CategoryInfo | null;
  isFiltered: boolean;
  onPressTrigger: () => void;
  onClear: () => void;
}

export function AssetFilterChip({
  selectedCategory,
  isFiltered,
  onPressTrigger,
  onClear,
}: AssetFilterChipProps) {
  if (!isFiltered) {
    return (
      <TouchableOpacity
        style={styles.inlineButton}
        onPress={onPressTrigger}
        activeOpacity={0.78}
      >
        <Text
          style={styles.inlineText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          全部分类
        </Text>
        <Text style={styles.inlineIcon}>▾</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.inlineGroup}>
      <TouchableOpacity
        style={styles.inlineButton}
        onPress={onPressTrigger}
        activeOpacity={0.82}
      >
        <Text
          style={styles.inlineText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : '已筛选'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.clearButton}
        onPress={onClear}
        activeOpacity={0.82}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.clearText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
  },
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  inlineText: {
    minWidth: 0,
    flexShrink: 1,
    fontSize: THEME.fontSize.sm,
    fontWeight: '400',
    color: '#FFFFFFCC',
  },
  clearButton: {
    marginLeft: 4,
  },
  inlineIcon: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '400',
    color: '#FFFFFFCC',
  },
  clearText: {
    fontSize: 11,
    fontWeight: '400',
    color: '#FFFFFFCC',
  },
});
