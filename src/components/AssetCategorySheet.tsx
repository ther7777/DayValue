import React, { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { CategoryInfo } from '../types';
import { THEME } from '../utils/constants';
import { BrutalButton } from './BrutalButton';
import { AppBottomSheet } from './AppBottomSheet';

export interface AssetCategorySheetItem extends CategoryInfo {
  count: number;
}

export interface AssetCategorySheetProps {
  visible: boolean;
  selectedCategoryId: string | null;
  categories: AssetCategorySheetItem[];
  onSelect: (categoryId: string | null) => void;
  onClose: () => void;
  onPressManageCategories: () => void;
}

export function AssetCategorySheet({
  visible,
  selectedCategoryId,
  categories,
  onSelect,
  onClose,
  onPressManageCategories,
}: AssetCategorySheetProps) {
  const totalCount = useMemo(
    () => categories.reduce((sum, category) => sum + category.count, 0),
    [categories],
  );

  return (
    <AppBottomSheet
      visible={visible}
      title="筛选资产分类"
      onClose={onClose}
      contentStyle={styles.sheetContent}
      footer={(
        <BrutalButton
          title="⚙️ 管理分类"
          onPress={onPressManageCategories}
          variant="outline"
          size="md"
          style={styles.manageButton}
        />
      )}
    >
      <View style={styles.listWrap}>
        <TouchableOpacity
          style={[styles.optionRow, selectedCategoryId === null && styles.optionRowActive]}
          onPress={() => onSelect(null)}
          activeOpacity={0.78}
        >
          <Text style={styles.stateIcon}>{selectedCategoryId === null ? '✅' : '⚪️'}</Text>
          <View style={styles.optionMeta}>
            <Text
              style={[
                styles.optionTitle,
                selectedCategoryId === null && styles.optionTitleActive,
              ]}
            >
              📊 全部资产
            </Text>
          </View>
          <Text style={styles.optionCount}>({totalCount} 件)</Text>
        </TouchableOpacity>

        <FlatList
          data={categories}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedCategoryId;

            return (
              <TouchableOpacity
                style={[styles.optionRow, isSelected && styles.optionRowActive]}
                onPress={() => onSelect(item.id)}
                activeOpacity={0.78}
              >
                <Text style={styles.stateIcon}>{isSelected ? '✅' : '⚪️'}</Text>
                <View style={styles.optionMeta}>
                  <Text style={[styles.optionTitle, isSelected && styles.optionTitleActive]}>
                    {`${item.icon} ${item.name}`}
                  </Text>
                </View>
                <Text style={styles.optionCount}>({item.count} 件)</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    maxHeight: 440,
  },
  listWrap: {
    minHeight: 220,
  },
  listContent: {
    paddingBottom: THEME.spacing.xs,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  optionRowActive: {
    backgroundColor: THEME.colors.primaryLight + '12',
  },
  stateIcon: {
    width: 28,
    fontSize: 16,
    textAlign: 'center',
    marginRight: THEME.spacing.sm,
  },
  optionMeta: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  optionTitleActive: {
    color: THEME.colors.primaryDark,
  },
  optionCount: {
    marginLeft: THEME.spacing.md,
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  manageButton: {
    width: '100%',
  },
});
