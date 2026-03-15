import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { THEME } from '../utils/constants';
import { findIconOption, searchIconGroups } from '../utils/iconLibrary';
import { PixelInput } from './PixelInput';

interface IconPickerProps {
  label: string;
  value: string;
  onSelect: (icon: string) => void;
  title?: string;
  helperText?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconPicker({
  label,
  value,
  onSelect,
  title = '选择图标',
  helperText,
  style,
}: IconPickerProps) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(() => findIconOption(value), [value]);
  const iconGroups = useMemo(() => searchIconGroups(query), [query]);

  function closeModal() {
    setVisible(false);
    setQuery('');
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setVisible(true)}
        activeOpacity={0.75}
      >
        <View style={styles.selectorLeft}>
          <Text style={styles.selectorIcon}>{value}</Text>
          <View style={styles.selectorMeta}>
            <Text style={styles.selectorTitle}>当前图标</Text>
            <Text style={styles.selectorSubtitle}>
              {selectedOption?.group ?? '自定义'} · 点击更换
            </Text>
          </View>
        </View>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{title}</Text>
                <PixelInput
                  label="搜索图标"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="输入分类、设备或服务关键词"
                />
                <ScrollView
                  style={styles.scrollArea}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator
                >
                  {iconGroups.length > 0 ? (
                    iconGroups.map(group => (
                      <View key={group.id} style={styles.groupSection}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        <View style={styles.iconGrid}>
                          {group.items.map(item => {
                            const active = item.icon === value;
                            return (
                              <TouchableOpacity
                                key={`${group.id}-${item.icon}`}
                                style={[styles.iconButton, active && styles.iconButtonActive]}
                                onPress={() => {
                                  onSelect(item.icon);
                                  closeModal();
                                }}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel={item.label}
                              >
                                <Text style={styles.iconValue}>{item.icon}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>没有找到匹配的图标</Text>
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.closeButton} onPress={closeModal} activeOpacity={0.75}>
                  <Text style={styles.closeButtonText}>关闭</Text>
                </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorIcon: {
    fontSize: 24,
    marginRight: THEME.spacing.sm,
  },
  selectorMeta: {
    flex: 1,
  },
  selectorTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  selectorSubtitle: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  arrow: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginLeft: THEME.spacing.sm,
  },
  helperText: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
    lineHeight: 18,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    padding: THEME.spacing.xl,
  },
  modalTitle: {
    fontSize: THEME.fontSize.xl,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: THEME.spacing.lg,
  },
  scrollArea: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: THEME.spacing.sm,
  },
  groupSection: {
    marginBottom: THEME.spacing.lg,
  },
  groupTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.sm,
  },
  iconButton: {
    width: '15.5%',
    minWidth: 56,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.background,
  },
  iconButtonActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight + '20',
  },
  iconValue: {
    fontSize: 24,
  },
  emptyState: {
    paddingVertical: THEME.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
  },
  closeButton: {
    marginTop: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
  },
  closeButtonText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
});
