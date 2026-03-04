import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, CategoryInfo, BillingCycle } from '../types';
import {
  getSubscriptionById,
  createSubscription,
  updateSubscription,
} from '../database';
import { getTodayString } from '../utils/formatters';
import { THEME } from '../utils/constants';
import {
  BrutalButton,
  PixelInput,
  CategoryPicker,
  DatePickerField,
} from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditSubscription'>;

export function AddEditSubscriptionScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const editId = route.params?.subscriptionId;
  const isEditing = editId !== undefined;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('software');
  const [icon, setIcon] = useState('💿');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [cyclePrice, setCyclePrice] = useState('');
  const [startDate, setStartDate] = useState(getTodayString());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? '编辑订阅' : '新增订阅' });
    if (isEditing && editId !== undefined) {
      loadItem(editId);
    }
  }, [db, editId, isEditing, navigation]);

  async function loadItem(id: number) {
    const sub = await getSubscriptionById(db, id);
    if (!sub) return;
    setName(sub.name);
    setCategory(sub.category ?? 'other');
    setIcon(sub.icon ?? '📦');
    setBillingCycle(sub.billing_cycle);
    setCyclePrice(String(sub.cycle_price));
    setStartDate(sub.start_date);
  }

  function handleCategoryChange(cat: CategoryInfo) {
    setCategory(cat.id);
    setIcon(cat.icon);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入订阅名称');
      return;
    }
    const priceNum = parseFloat(cyclePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('提示', '请输入有效的周期金额');
      return;
    }

    setLoading(true);
    try {
      if (isEditing && editId !== undefined) {
        await updateSubscription(db, editId, {
          name: name.trim(),
          category,
          icon,
          billing_cycle: billingCycle,
          cycle_price: priceNum,
          start_date: startDate,
        });
      } else {
        await createSubscription(db, {
          name: name.trim(),
          category,
          icon,
          billing_cycle: billingCycle,
          cycle_price: priceNum,
          start_date: startDate,
          status: 'active',
        });
      }
      navigation.goBack();
    } catch {
      Alert.alert('错误', '保存失败，请重试');
    } finally {
      setLoading(false);
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
          label="订阅名称"
          value={name}
          onChangeText={setName}
          placeholder="例如：QQ 音乐会员"
        />

        <CategoryPicker selectedId={category} onSelect={handleCategoryChange} />

        {/* 计费周期切换 */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>计费周期</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                billingCycle === 'monthly' && styles.toggleActive,
              ]}
              onPress={() => setBillingCycle('monthly')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  billingCycle === 'monthly' && styles.toggleTextActive,
                ]}
              >
                按月
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                billingCycle === 'yearly' && styles.toggleActive,
              ]}
              onPress={() => setBillingCycle('yearly')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  billingCycle === 'yearly' && styles.toggleTextActive,
                ]}
              >
                按年
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <PixelInput
          label={`${billingCycle === 'monthly' ? '月' : '年'}付金额 (¥)`}
          value={cyclePrice}
          onChangeText={setCyclePrice}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <DatePickerField
          label="开始日期"
          value={startDate}
          onChange={setStartDate}
        />

        <View style={styles.actions}>
          <BrutalButton
            title={isEditing ? '保存修改' : '新增订阅'}
            onPress={handleSave}
            loading={loading}
            variant="accent"
            size="lg"
            style={styles.saveBtn}
          />
          <BrutalButton
            title="取消"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="lg"
            style={styles.cancelBtn}
          />
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
    backgroundColor: THEME.colors.accentLight + '30',
  },
  toggleText: {
    fontSize: THEME.fontSize.md,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  toggleTextActive: {
    color: THEME.colors.accent,
    fontWeight: '700',
  },
  actions: {
    marginTop: THEME.spacing.xl,
    gap: THEME.spacing.md,
  },
  saveBtn: {
    width: '100%',
  },
  cancelBtn: {
    width: '100%',
  },
});
