import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import type { CategoryInfo, CategoryType } from '../types';

interface CategoryPickerProps {
  type: CategoryType;
  selectedId: string;
  onSelect: (category: CategoryInfo) => void;
  style?: ViewStyle;
}

export function CategoryPicker({ type, selectedId, onSelect, style }: CategoryPickerProps) {
  const [visible, setVisible] = useState(false);
  const {
    itemCategories,
    subscriptionCategories,
    storedCardCategories,
    getCategoryInfo,
  } = useCategories();

  const categories = useMemo(
    () =>
      type === 'item'
        ? itemCategories
        : type === 'subscription'
          ? subscriptionCategories
          : storedCardCategories,
    [itemCategories, storedCardCategories, subscriptionCategories, type],
  );
  const selected = getCategoryInfo(type, selectedId);
  const listData = categories.length > 0 ? categories : [selected];

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>分类</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.selectorMeta}>
          <Text style={styles.selectorTitle}>{selected.name}</Text>
          <Text style={styles.selectorHint}>用于统计归类</Text>
        </View>
        <View style={styles.selectorRight}>
          <Text style={styles.selectorIcon}>{selected.icon}</Text>
          <Text style={styles.arrow}>▾</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>选择分类</Text>
                <FlatList
                  data={listData}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.list}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.listItem,
                        item.id === selectedId && styles.listItemActive,
                      ]}
                      onPress={() => {
                        onSelect(item);
                        setVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.listItemMeta}>
                        <Text
                          style={[
                            styles.listItemTitle,
                            item.id === selectedId && styles.listItemTitleActive,
                          ]}
                        >
                          {item.name}
                        </Text>
                        <Text style={styles.listItemSubtitle}>统计与筛选将按这个分类归类</Text>
                      </View>
                      <View style={styles.listItemBadge}>
                        <Text style={styles.listItemIcon}>{item.icon}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: THEME.spacing.md,
  },
  label: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  selector: {
    ...THEME.pixelBorder,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorMeta: {
    flex: 1,
  },
  selectorTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  selectorHint: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  selectorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: THEME.spacing.sm,
  },
  selectorIcon: {
    fontSize: 18,
    marginRight: THEME.spacing.xs,
  },
  arrow: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    padding: THEME.spacing.xl,
    ...THEME.pixelShadow,
  },
  modalTitle: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
  },
  list: {
    paddingBottom: THEME.spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.md,
    marginBottom: THEME.spacing.sm,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.background,
  },
  listItemActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight + '20',
  },
  listItemMeta: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  listItemTitleActive: {
    color: THEME.colors.primary,
  },
  listItemSubtitle: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  listItemBadge: {
    width: 38,
    height: 38,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
  },
  listItemIcon: {
    fontSize: 18,
  },
});
