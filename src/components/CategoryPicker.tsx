import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { CATEGORIES, THEME } from '../utils/constants';
import type { CategoryInfo } from '../types';

interface CategoryPickerProps {
  selectedId: string;
  onSelect: (category: CategoryInfo) => void;
  style?: ViewStyle;
}

export function CategoryPicker({ selectedId, onSelect, style }: CategoryPickerProps) {
  const [visible, setVisible] = useState(false);
  const selected = CATEGORIES.find(c => c.id === selectedId) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>分类</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.selectorText}>
          {selected.icon}  {selected.name}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择分类</Text>
            <FlatList
              data={CATEGORIES}
              numColumns={3}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.gridItem,
                    item.id === selectedId && styles.gridItemActive,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.gridIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.gridLabel,
                      item.id === selectedId && styles.gridLabelActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
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
  selectorText: {
    fontSize: THEME.fontSize.md,
    color: THEME.colors.textPrimary,
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
  grid: {
    alignItems: 'center',
  },
  gridItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: THEME.spacing.md,
    marginHorizontal: '1.5%',
    marginBottom: THEME.spacing.sm,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  gridItemActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight + '20',
  },
  gridIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  gridLabel: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
  },
  gridLabelActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
});
