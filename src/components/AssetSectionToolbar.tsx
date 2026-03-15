import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../utils/constants';

interface AssetSectionToolbarProps {
  title: string;
  sortSummary: string;
  layoutMode: 'list' | 'grid';
  onPressSort: () => void;
  onToggleLayout: () => void;
}

export function AssetSectionToolbar({
  title,
  sortSummary,
  layoutMode,
  onPressSort,
  onToggleLayout,
}: AssetSectionToolbarProps) {
  return (
    <View style={styles.toolbar}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity
        style={styles.sortButton}
        onPress={onPressSort}
        activeOpacity={0.76}
      >
        <Text style={styles.sortText} numberOfLines={1}>
          {sortSummary}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.layoutButton}
        onPress={onToggleLayout}
        activeOpacity={0.76}
      >
        <Text style={styles.layoutText}>{layoutMode === 'list' ? '⊞' : '≡'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  title: {
    minWidth: 72,
    fontSize: THEME.fontSize.lg,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
  },
  sortButton: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: THEME.spacing.md,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
  },
  sortText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  layoutButton: {
    width: 38,
    height: 38,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  layoutText: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
});
