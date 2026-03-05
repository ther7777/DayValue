/**
 * AddEditStoredCardScreen - 新增 / 编辑沉睡卡包
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CategoryInfo, RootStackParamList, StoredCardType } from '../types';
import {
  createStoredCard,
  deleteStoredCard,
  getStoredCardById,
  updateStoredCard,
} from '../database';
import { getTodayString } from '../utils/formatters';
import { THEME } from '../utils/constants';
import {
  BrutalButton,
  CategoryPicker,
  DatePickerField,
  PixelInput,
} from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditStoredCard'>;

export function AddEditStoredCardScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const editId = route.params?.storedCardId;
  const defaultCardType = route.params?.defaultCardType ?? 'amount';
  const isEditing = editId !== undefined;

  // ─── Form state ───────────────────────────────────────────────
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [icon, setIcon] = useState('📦');
  const [cardType, setCardType] = useState<StoredCardType>(defaultCardType);
  const [actualPaid, setActualPaid] = useState('');
  const [faceValue, setFaceValue] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [lastUpdatedDate, setLastUpdatedDate] = useState(getTodayString());
  const [reminderDays, setReminderDays] = useState('30');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? '编辑储值卡' : '新增储值卡' });
    if (isEditing && editId !== undefined) {
      loadCard(editId);
    }
  }, [editId, isEditing, navigation]);

  async function loadCard(id: number) {
    const card = await getStoredCardById(db, id);
    if (!card) return;
    setName(card.name);
    setCategory(card.category ?? 'other');
    setIcon(card.icon ?? '📦');
    setCardType(card.card_type);
    setActualPaid(String(card.actual_paid));
    setFaceValue(String(card.face_value));
    setCurrentBalance(String(card.current_balance));
    setLastUpdatedDate(card.last_updated_date);
    setReminderDays(String(card.reminder_days));
    setStatus(card.status);
  }

  function handleCategoryChange(cat: CategoryInfo) {
    setCategory(cat.id);
    setIcon(cat.icon);
  }

  function parseNumber(str: string, allowFloat = true): number | null {
    const n = allowFloat ? parseFloat(str) : parseInt(str, 10);
    return isNaN(n) ? null : n;
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入卡包名称');
      return;
    }
    const paid = parseNumber(actualPaid);
    if (paid === null || paid <= 0) {
      Alert.alert('提示', '请输入有效的实际支付金额（> 0）');
      return;
    }
    const isCount = cardType === 'count';
    const face = parseNumber(faceValue, !isCount);
    if (face === null || face <= 0) {
      Alert.alert('提示', isCount ? '请输入有效的总次数（整数 > 0）' : '请输入有效的总面值（> 0）');
      return;
    }
    const balance = parseNumber(currentBalance, !isCount);
    if (balance === null || balance < 0) {
      Alert.alert('提示', isCount ? '请输入有效的剩余次数（整数 ≥ 0）' : '请输入有效的当前余额（≥ 0）');
      return;
    }
    if (balance > face) {
      Alert.alert('提示', isCount ? '剩余次数不能超过总次数' : '当前余额不能超过总面值');
      return;
    }
    if (!isCount && face < paid) {
      Alert.alert(
        '🤔 不太对劲',
        `付了 ¥${paid}，才拿到 ¥${face} 的面值？付的比得的多，要么是填反了，要么是被坑了！`,
      );
      return;
    }
    const reminder = parseNumber(reminderDays, false);
    if (reminder === null || reminder < 0) {
      Alert.alert('提示', '提醒天数需为 ≥ 0 的整数');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        icon,
        card_type: cardType,
        actual_paid: paid,
        face_value: isCount ? Math.round(face) : face,
        current_balance: isCount ? Math.round(balance) : balance,
        last_updated_date: lastUpdatedDate,
        reminder_days: reminder,
        status,
      };

      if (isEditing && editId !== undefined) {
        await updateStoredCard(db, editId, payload);
      } else {
        await createStoredCard(db, { ...payload, status: 'active' });
      }
      navigation.goBack();
    } catch {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEditing || editId === undefined) return;
    Alert.alert('确认删除', '删除后无法恢复，确定要删除这张储值卡吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteStoredCard(db, editId);
            navigation.goBack();
          } catch {
            Alert.alert('错误', '删除失败，请重试');
          }
        },
      },
    ]);
  }

  async function handleToggleArchive() {
    if (!isEditing || editId === undefined) return;
    const newStatus = status === 'active' ? 'archived' : 'active';
    try {
      await updateStoredCard(db, editId, { status: newStatus });
      setStatus(newStatus);
    } catch {
      Alert.alert('错误', '操作失败，请重试');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* 名称 */}
        <PixelInput
          label="卡包名称"
          value={name}
          onChangeText={setName}
          placeholder="例如：美发储值卡"
        />

        {/* 分类 */}
        <CategoryPicker
          type="stored_card"
          selectedId={category}
          onSelect={handleCategoryChange}
        />

        {/* 卡片类型切换 */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>卡片类型</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, cardType === 'amount' && styles.toggleActive]}
              onPress={() => setCardType('amount')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, cardType === 'amount' && styles.toggleTextActive]}>
                💰 储值卡
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, cardType === 'count' && styles.toggleActive]}
              onPress={() => setCardType('count')}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, cardType === 'count' && styles.toggleTextActive]}>
                🔢 计次卡
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 金额 */}
        <PixelInput
          label="实际支付金额 (¥)"
          value={actualPaid}
          onChangeText={setActualPaid}
          placeholder="例如：800"
          keyboardType="decimal-pad"
        />

        <PixelInput
          label={cardType === 'count' ? '总次数（整数）' : '总面值 (¥)'}
          value={faceValue}
          onChangeText={setFaceValue}
          placeholder={cardType === 'count' ? '例如：20' : '例如：1000'}
          keyboardType="decimal-pad"
        />

        <PixelInput
          label={cardType === 'count' ? '当前剩余次数（整数）' : '当前剩余额度 (¥)'}
          value={currentBalance}
          onChangeText={setCurrentBalance}
          placeholder={cardType === 'count' ? '例如：15' : '例如：620'}
          keyboardType="decimal-pad"
        />

        {/* 最后更新日期 */}
        <DatePickerField
          label="最后使用日期"
          value={lastUpdatedDate}
          onChange={setLastUpdatedDate}
        />

        {/* 沉睡提醒天数 */}
        <PixelInput
          label="沉睡提醒天数（超过此天数显示预警）"
          value={reminderDays}
          onChangeText={setReminderDays}
          placeholder="30"
          keyboardType="number-pad"
        />

        {/* 隐藏切换（仅编辑态） */}
        {isEditing && (
          <View style={styles.archiveRow}>
            <BrutalButton
              title={status === 'active' ? '隐藏卡包' : '取消隐藏 / 恢复显示'}
              onPress={handleToggleArchive}
              variant={status === 'active' ? 'outline' : 'success'}
              size="md"
              style={styles.archiveBtn}
            />
          </View>
        )}

        {/* 保存 / 取消 / 删除 */}
        <View style={styles.actions}>
          <BrutalButton
            title={isEditing ? '保存修改' : '新增卡包'}
            onPress={handleSave}
            loading={loading}
            variant="primary"
            size="lg"
            style={styles.btn}
          />
          <BrutalButton
            title="取消"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="lg"
            style={styles.btn}
          />
          {isEditing && (
            <BrutalButton
              title="删除此卡"
              onPress={handleDelete}
              variant="danger"
              size="lg"
              style={styles.btn}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.xl,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: THEME.spacing.md,
  },
  fieldLabel: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: THEME.spacing.sm + 2,
    borderRadius: THEME.borderRadius,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
  },
  toggleActive: {
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.warning + '33',
  },
  toggleText: {
    fontSize: THEME.fontSize.md,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  toggleTextActive: {
    color: '#856404',
    fontWeight: '700',
  },
  archiveRow: {
    marginBottom: THEME.spacing.md,
  },
  archiveBtn: {
    width: '100%',
  },
  actions: {
    marginTop: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  btn: {
    width: '100%',
  },
});
