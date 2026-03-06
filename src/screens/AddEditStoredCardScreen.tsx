/**
 * AddEditStoredCardScreen
 * 用途：新增 / 编辑储值卡、计次卡，并通过文案说明折扣卡如何按储值卡口径使用。
 * 输入：路由参数中的 storedCardId、defaultCardType。
 * 输出：保存或删除储值卡记录，必要时同步保存本地封面图片。
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
import {
  BrutalButton,
  CategoryPicker,
  DatePickerField,
  ImagePickerField,
  PixelInput,
} from '../components';
import { THEME } from '../utils/constants';
import { getTodayString } from '../utils/formatters';
import {
  deleteEntityImageAsync,
  pickEntityImageFromLibraryAsync,
  resolveEntityImageForSaveAsync,
} from '../utils/entityImages';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditStoredCard'>;

export function AddEditStoredCardScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const editId = route.params?.storedCardId;
  const defaultCardType = route.params?.defaultCardType ?? 'amount';
  const isEditing = editId !== undefined;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [icon, setIcon] = useState('📦');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
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
      void loadCard(editId);
    }
  }, [editId, isEditing, navigation]);

  async function loadCard(id: number) {
    const card = await getStoredCardById(db, id);
    if (!card) return;

    setName(card.name);
    setCategory(card.category ?? 'other');
    setIcon(card.icon ?? '📦');
    setImageUri(card.image_uri ?? null);
    setOriginalImageUri(card.image_uri ?? null);
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

  async function handlePickImage() {
    try {
      const selectedUri = await pickEntityImageFromLibraryAsync();
      if (selectedUri) {
        setImageUri(selectedUri);
      }
    } catch (error) {
      Alert.alert('图片上传失败', error instanceof Error ? error.message : '请选择图片后重试');
    }
  }

  function parseNumber(value: string, allowFloat = true): number | null {
    const nextValue = allowFloat ? parseFloat(value) : parseInt(value, 10);
    return Number.isNaN(nextValue) ? null : nextValue;
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入卡包名称');
      return;
    }

    const paid = parseNumber(actualPaid);
    if (paid === null || paid <= 0) {
      Alert.alert('提示', '请输入有效的实际支付金额');
      return;
    }

    const isCountCard = cardType === 'count';
    const face = parseNumber(faceValue, !isCountCard);
    if (face === null || face <= 0) {
      Alert.alert('提示', isCountCard ? '请输入有效的总次数' : '请输入有效的总面值');
      return;
    }

    const balance = parseNumber(currentBalance, !isCountCard);
    if (balance === null || balance < 0) {
      Alert.alert('提示', isCountCard ? '请输入有效的剩余次数' : '请输入有效的当前余额');
      return;
    }

    if (balance > face) {
      Alert.alert('提示', isCountCard ? '剩余次数不能超过总次数' : '当前余额不能超过总面值');
      return;
    }

    if (!isCountCard && face < paid) {
      Alert.alert('不太对劲', `你实付了 ¥${paid}，但总面值只填了 ¥${face}，请确认是否填反了。`);
      return;
    }

    const reminder = parseNumber(reminderDays, false);
    if (reminder === null || reminder < 0) {
      Alert.alert('提示', '提醒天数需要是大于等于 0 的整数');
      return;
    }

    setLoading(true);
    try {
      const savedImageUri = await resolveEntityImageForSaveAsync({
        currentImageUri: originalImageUri,
        nextImageUri: imageUri,
        type: 'stored_card',
      });

      const payload = {
        name: name.trim(),
        category,
        icon,
        image_uri: savedImageUri,
        card_type: cardType,
        actual_paid: paid,
        face_value: isCountCard ? Math.round(face) : face,
        current_balance: isCountCard ? Math.round(balance) : balance,
        last_updated_date: lastUpdatedDate,
        reminder_days: reminder,
        status,
      };

      if (isEditing && editId !== undefined) {
        await updateStoredCard(db, editId, payload);
      } else {
        await createStoredCard(db, { ...payload, status: 'active' });
      }

      setOriginalImageUri(savedImageUri);
      navigation.goBack();
    } catch {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEditing || editId === undefined) return;

    Alert.alert('确认删除', '删除后无法恢复，确定要删除这张卡吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEntityImageAsync(originalImageUri);
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
    const nextStatus = status === 'active' ? 'archived' : 'active';
    try {
      await updateStoredCard(db, editId, { status: nextStatus });
      setStatus(nextStatus);
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
        <PixelInput
          label="卡包名称"
          value={name}
          onChangeText={setName}
          placeholder="例如：美发储值卡"
        />

        <CategoryPicker
          type="stored_card"
          selectedId={category}
          onSelect={handleCategoryChange}
        />

        <ImagePickerField
          label="封面图片（可选）"
          imageUri={imageUri}
          fallbackIcon={icon}
          onPick={handlePickImage}
          onRemove={() => setImageUri(null)}
          helperText="上传后只覆盖当前这张卡。首页卡包会优先显示图片；未上传时继续显示分类图标。折扣卡仍归在储值卡里，图片逻辑也一样。"
        />

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>卡片类型</Text>
          <View style={styles.toggleRow}>
            <TypeButton
              title="💵 储值卡"
              active={cardType === 'amount'}
              onPress={() => setCardType('amount')}
            />
            <TypeButton
              title="🎫 计次卡"
              active={cardType === 'count'}
              onPress={() => setCardType('count')}
            />
          </View>
        </View>

        <PixelInput
          label="实际支付金额（¥）"
          value={actualPaid}
          onChangeText={setActualPaid}
          placeholder="例如：800"
          keyboardType="decimal-pad"
        />

        <PixelInput
          label={cardType === 'count' ? '总次数（整数）' : '总面值（含赠送）（¥）'}
          value={faceValue}
          onChangeText={setFaceValue}
          placeholder={cardType === 'count' ? '例如：10' : '例如：1000'}
          keyboardType="decimal-pad"
        />

        {cardType === 'amount' ? (
          <Text style={styles.hintText}>
            普通送钱型储值卡：例如充 800 送 200，总面值填 1000。
            {'\n'}
            折扣卡仍按储值卡来记：例如“充 200，消费打 8 折”，建议总面值直接填实际支付金额 200，后续更新余额时直接照抄商家显示的剩余余额，不需要自己换算原价。
          </Text>
        ) : (
          <Text style={styles.hintText}>
            如果这张卡是不限制次数或无限次，更建议记录到“每日消耗”的订阅里，会更符合真实成本。
          </Text>
        )}

        <PixelInput
          label={cardType === 'count' ? '当前剩余次数（整数）' : '当前剩余额度（¥）'}
          value={currentBalance}
          onChangeText={setCurrentBalance}
          placeholder={cardType === 'count' ? '例如：8' : '例如：620'}
          keyboardType="decimal-pad"
        />

        <DatePickerField
          label="最后使用日期"
          value={lastUpdatedDate}
          onChange={setLastUpdatedDate}
        />

        <PixelInput
          label="沉睡提醒天数（超过后显示预警）"
          value={reminderDays}
          onChangeText={setReminderDays}
          placeholder="30"
          keyboardType="number-pad"
        />

        {isEditing ? (
          <View style={styles.archiveRow}>
            <BrutalButton
              title={status === 'active' ? '隐藏卡包' : '取消隐藏 / 恢复显示'}
              onPress={handleToggleArchive}
              variant={status === 'active' ? 'outline' : 'success'}
              size="md"
              style={styles.archiveBtn}
            />
          </View>
        ) : null}

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
          {isEditing ? (
            <BrutalButton
              title="删除此卡"
              onPress={handleDelete}
              variant="danger"
              size="lg"
              style={styles.btn}
            />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TypeButton({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.toggleBtn, active && styles.toggleActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{title}</Text>
    </TouchableOpacity>
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
  hintText: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: -THEME.spacing.sm,
    marginBottom: THEME.spacing.md,
    lineHeight: 18,
  },
  actions: {
    marginTop: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  btn: {
    width: '100%',
  },
});
