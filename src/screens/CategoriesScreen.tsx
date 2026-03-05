import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CategoryInfo, CategoryType, RootStackParamList } from '../types';
import { useCategories } from '../contexts/CategoriesContext';
import { THEME } from '../utils/constants';
import { BrutalButton, PixelInput } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

const ICON_PRESETS: string[] = [
  '📱', '💻', '🏠', '🛵', '👕', '🎮',
  '💿', '📚', '⚽', '🍔', '☕', '🧾',
  '🧠', '🧩', '🧹', '🎧', '🎬', '🧱',
  '📦', '🧯', '🧪', '🧰', '💡', '🪙',
];

function typeLabel(type: CategoryType) {
  if (type === 'item') return '物品分类';
  if (type === 'subscription') return '订阅分类';
  return '储值分类';
}

export function CategoriesScreen({}: Props) {
  const {
    itemCategories,
    subscriptionCategories,
    storedCardCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryUsageCount,
  } = useCategories();

  const [activeType, setActiveType] = useState<CategoryType>('item');
  const [createVisible, setCreateVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryInfo | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(ICON_PRESETS[0]);
  const [saving, setSaving] = useState(false);

  const categories = useMemo<CategoryInfo[]>(
    () =>
      activeType === 'item'
        ? itemCategories
        : activeType === 'subscription'
          ? subscriptionCategories
          : storedCardCategories,
    [activeType, itemCategories, storedCardCategories, subscriptionCategories],
  );

  async function handleCreate() {
    const name = newName.trim();
    if (!name) {
      Alert.alert('提示', '请输入分类名称');
      return;
    }
    setSaving(true);
    try {
      await createCategory({ name, icon: newIcon, type: activeType });
      setCreateVisible(false);
      setNewName('');
      setNewIcon(ICON_PRESETS[0]);
    } catch {
      Alert.alert('错误', '新增分类失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(category: CategoryInfo) {
    setEditingCategory(category);
    setNewName(category.name);
    setNewIcon(category.icon);
  }

  function resetEditModal() {
    setEditingCategory(null);
    setNewName('');
    setNewIcon(ICON_PRESETS[0]);
  }

  async function handleUpdate() {
    if (!editingCategory) return;
    const name = newName.trim();
    if (!name) {
      Alert.alert('提示', '请输入分类名称');
      return;
    }

    setSaving(true);
    try {
      await updateCategory({
        id: editingCategory.id,
        type: activeType,
        name,
        icon: newIcon,
      });
      resetEditModal();
    } catch {
      Alert.alert('错误', '更新分类失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingCategory) return;
    if (editingCategory.id === 'other') {
      Alert.alert('提示', '“其他”分类不可删除');
      return;
    }
    if (!editingCategory.id.startsWith('cat_')) {
      Alert.alert('提示', '系统默认分类不可删除');
      return;
    }

    const usageCount = await getCategoryUsageCount(activeType, editingCategory.id);
    if (usageCount > 0) {
      Alert.alert('提示', `该分类仍被 ${usageCount} 条记录使用，请先修改这些记录的分类`);
      return;
    }

    Alert.alert('确认删除', `确定删除“${editingCategory.name}”吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(activeType, editingCategory.id);
            resetEditModal();
          } catch {
            Alert.alert('错误', '删除分类失败，请重试');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeType === 'item' && styles.tabActive]}
            onPress={() => setActiveType('item')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeType === 'item' && styles.tabTextActive]}>
              物品
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeType === 'subscription' && styles.tabActive]}
            onPress={() => setActiveType('subscription')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeType === 'subscription' && styles.tabTextActive,
              ]}
            >
              订阅
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeType === 'stored_card' && styles.tabActive]}
            onPress={() => setActiveType('stored_card')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabText,
                activeType === 'stored_card' && styles.tabTextActive,
              ]}
            >
              卡包
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRow}>
          <Text style={styles.title}>{typeLabel(activeType)}</Text>
          <BrutalButton
            title="新增"
            onPress={() => setCreateVisible(true)}
            variant="accent"
            size="sm"
          />
        </View>

        <FlatList
          data={categories}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => openEditModal(item)}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>{item.icon}</Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowId}>{item.id}</Text>
              </View>
            </TouchableOpacity>
          )}
        />

        <Modal visible={createVisible} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>新增分类</Text>

              <PixelInput
                label="分类名称"
                value={newName}
                onChangeText={setNewName}
                placeholder="例如：咖啡"
              />

              <Text style={styles.presetLabel}>选择图标</Text>
              <FlatList
                data={ICON_PRESETS}
                numColumns={6}
                keyExtractor={v => v}
                contentContainerStyle={styles.iconGrid}
                renderItem={({ item }) => {
                  const active = item === newIcon;
                  return (
                    <TouchableOpacity
                      style={[styles.iconPick, active && styles.iconPickActive]}
                      onPress={() => setNewIcon(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.iconPickText}>{item}</Text>
                    </TouchableOpacity>
                  );
                }}
              />

              <View style={styles.modalActions}>
                <BrutalButton
                  title="取消"
                  onPress={() => setCreateVisible(false)}
                  variant="outline"
                  size="md"
                  style={styles.modalBtnLeft}
                />
                <BrutalButton
                  title="保存"
                  onPress={handleCreate}
                  loading={saving}
                  variant="primary"
                  size="md"
                  style={styles.modalBtnRight}
                />
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={editingCategory !== null} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>编辑分类</Text>

              <PixelInput
                label="分类名称"
                value={newName}
                onChangeText={setNewName}
                placeholder="例如：咖啡"
              />

              <Text style={styles.presetLabel}>选择图标</Text>
              <FlatList
                data={ICON_PRESETS}
                numColumns={6}
                keyExtractor={v => `edit-${v}`}
                contentContainerStyle={styles.iconGrid}
                renderItem={({ item }) => {
                  const active = item === newIcon;
                  return (
                    <TouchableOpacity
                      style={[styles.iconPick, active && styles.iconPickActive]}
                      onPress={() => setNewIcon(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.iconPickText}>{item}</Text>
                    </TouchableOpacity>
                  );
                }}
              />

              <View style={styles.modalActions}>
                <BrutalButton
                  title="删除"
                  onPress={handleDelete}
                  variant="danger"
                  size="md"
                  style={styles.modalBtnLeft}
                />
                <BrutalButton
                  title="保存"
                  onPress={handleUpdate}
                  loading={saving}
                  variant="primary"
                  size="md"
                  style={styles.modalBtnRight}
                />
              </View>
              <BrutalButton
                title="取消"
                onPress={resetEditModal}
                variant="outline"
                size="md"
                style={styles.modalCloseBtn}
              />
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  container: {
    flex: 1,
    padding: THEME.spacing.xl,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: THEME.spacing.lg,
    ...THEME.pixelBorder,
    backgroundColor: THEME.colors.surface,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: THEME.spacing.sm + 2,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: THEME.colors.primary,
  },
  tabText: {
    color: THEME.colors.textSecondary,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  title: {
    fontSize: THEME.fontSize.xl,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: THEME.colors.accentLight + '30',
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: THEME.spacing.md,
  },
  iconText: { fontSize: 22 },
  rowInfo: { flex: 1 },
  rowName: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  rowId: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: 2,
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
    maxWidth: 420,
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
  presetLabel: {
    marginTop: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  iconGrid: {
    paddingBottom: THEME.spacing.sm,
  },
  iconPick: {
    width: '16.66%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: THEME.borderRadius,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconPickActive: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryLight + '20',
  },
  iconPickText: { fontSize: 20 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: THEME.spacing.lg,
  },
  modalBtnLeft: { flex: 1, marginRight: THEME.spacing.sm },
  modalBtnRight: { flex: 1, marginLeft: THEME.spacing.sm },
  modalCloseBtn: {
    width: '100%',
    marginTop: THEME.spacing.sm,
  },
});
