import React, { useState, useEffect, useMemo } from 'react';
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
import type { RootStackParamList, CategoryInfo, OneTimeItemStatus } from '../types';
import { getOneTimeItemById, createOneTimeItem, updateOneTimeItem } from '../database';
import { getTodayString } from '../utils/formatters';
import { THEME } from '../utils/constants';
import {
  BrutalButton,
  PixelInput,
  CategoryPicker,
  DatePickerField,
} from '../components';
import {
  calculateIRR,
  calculateInstallmentPremium,
} from '../utils/calculations';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditItem'>;

export function AddEditItemScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const editId = route.params?.itemId;
  const isEditing = editId !== undefined;
  const defaultIsInstallment = route.params?.defaultIsInstallment ?? false;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('digital');
  const [icon, setIcon] = useState('📱');
  const [totalPrice, setTotalPrice] = useState('');
  const [buyDate, setBuyDate] = useState(getTodayString());
  const [salvageValue, setSalvageValue] = useState('');

  const [isInstallment, setIsInstallment] = useState(defaultIsInstallment);
  const [installmentMonths, setInstallmentMonths] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [downPayment, setDownPayment] = useState('');

  const [originalStatus, setOriginalStatus] = useState<OneTimeItemStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // 实时计算溢价和 IRR
  const irrWarning = useMemo(() => {
    if (!isInstallment) return null;
    const price  = parseFloat(totalPrice);
    const dp     = parseFloat(downPayment) || 0;
    const mp     = parseFloat(monthlyPayment);
    const months = parseInt(installmentMonths, 10);
    if (isNaN(price) || isNaN(mp) || isNaN(months) || price <= 0 || mp <= 0 || months <= 0) return null;
    const premium = calculateInstallmentPremium(price, dp, mp, months);
    if (premium <= 0) return null;
    const irr = calculateIRR(price, dp, mp, months);
    return { premium, irr };
  }, [isInstallment, totalPrice, downPayment, monthlyPayment, installmentMonths]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? '编辑物品' : '新增物品' });
    if (isEditing && editId !== undefined) {
      loadItem(editId);
    }
  }, [db, editId, isEditing, navigation]);

  async function loadItem(id: number) {
    const item = await getOneTimeItemById(db, id);
    if (!item) return;

    setName(item.name);
    setCategory(item.category ?? 'other');
    setIcon(item.icon ?? '📦');
    setTotalPrice(String(item.total_price));
    setBuyDate(item.buy_date);
    setSalvageValue(item.salvage_value ? String(item.salvage_value) : '');

    setIsInstallment(item.is_installment === 1);
    setInstallmentMonths(item.installment_months ? String(item.installment_months) : '');
    setMonthlyPayment(item.monthly_payment ? String(item.monthly_payment) : '');
    setDownPayment(item.down_payment ? String(item.down_payment) : '');
    setOriginalStatus(item.status);
  }

  function handleCategoryChange(cat: CategoryInfo) {
    setCategory(cat.id);
    setIcon(cat.icon);
  }

  function resolveNextStatus(): OneTimeItemStatus {
    // 已隐藏：不允许在此页改变状态（避免破坏"锁定成本"约束）
    if (originalStatus === 'archived') return 'archived';

    // 已赎身/在用：默认保持 active（赎身通过详情页动作触发）
    if (originalStatus === 'active') return 'active';

    // 未赎身：如果用户关闭“分期”，则自动转为 active（否则会违反约束）
    if (originalStatus === 'unredeemed') {
      return isInstallment ? 'unredeemed' : 'active';
    }

    // 新增：分期默认 unredeemed，全款默认 active
    return isInstallment ? 'unredeemed' : 'active';
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入物品名称');
      return;
    }
    const totalPriceNum = parseFloat(totalPrice);
    if (isNaN(totalPriceNum) || totalPriceNum <= 0) {
      Alert.alert('提示', '请输入有效的总金额');
      return;
    }
    const salvageNum = salvageValue ? parseFloat(salvageValue) : 0;
    if (isNaN(salvageNum) || salvageNum < 0) {
      Alert.alert('提示', '残值不能为负数');
      return;
    }
    if (salvageNum > totalPriceNum) {
      Alert.alert('🤨 残值溢出', '转手价比买入价还高？那你是赚了不是亏了，检查一下数字吧。');
      return;
    }

    let monthsNum: number | null = null;
    let monthlyPaymentNum: number | null = null;
    let downPaymentNum = 0;
    if (isInstallment) {
      const m = parseInt(installmentMonths, 10);
      if (isNaN(m) || m <= 0) {
        Alert.alert('提示', '请输入有效的分期月数');
        return;
      }
      const p = parseFloat(monthlyPayment);
      if (isNaN(p) || p <= 0) {
        Alert.alert('提示', '请输入有效的月供金额');
        return;
      }
      monthsNum = m;
      monthlyPaymentNum = p;
      downPaymentNum = downPayment ? (parseFloat(downPayment) || 0) : 0;
      if (downPaymentNum >= totalPriceNum) {
        Alert.alert('😯 首付都够全款了', '首付≥总价，说明你已经付得起全款了，关掉分期开关吧！');
        return;
      }
    }

    const nextStatus = resolveNextStatus();

    setLoading(true);
    try {
      if (isEditing && editId !== undefined) {
        await updateOneTimeItem(db, editId, {
          name: name.trim(),
          category,
          icon,
          total_price: totalPriceNum,
          buy_date: buyDate,
          salvage_value: salvageNum,
          is_installment: isInstallment ? 1 : 0,
          installment_months: isInstallment ? monthsNum : null,
          monthly_payment: isInstallment ? monthlyPaymentNum : null,
          down_payment: isInstallment ? downPaymentNum : 0,
          status: nextStatus,
        });
      } else {
        await createOneTimeItem(db, {
          name: name.trim(),
          category,
          icon,
          total_price: totalPriceNum,
          buy_date: buyDate,
          salvage_value: salvageNum,
          is_installment: isInstallment ? 1 : 0,
          installment_months: isInstallment ? monthsNum : null,
          monthly_payment: isInstallment ? monthlyPaymentNum : null,
          down_payment: isInstallment ? downPaymentNum : 0,
          status: nextStatus,
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
          label="物品名称"
          value={name}
          onChangeText={setName}
          placeholder="例如：iPhone 15"
        />

        <CategoryPicker type="item" selectedId={category} onSelect={handleCategoryChange} />

        <PixelInput
          label="总金额 (¥)"
          value={totalPrice}
          onChangeText={setTotalPrice}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <DatePickerField
          label="购买日期"
          value={buyDate}
          onChange={setBuyDate}
        />

        {/* 分期开关 */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>是否分期 / 先用后付</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, !isInstallment && styles.toggleActive]}
              onPress={() => setIsInstallment(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, !isInstallment && styles.toggleTextActive]}>
                否（全款）
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, isInstallment && styles.toggleActiveDanger]}
              onPress={() => setIsInstallment(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, isInstallment && styles.toggleTextActiveDanger]}>
                是（分期）
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isInstallment && (
          <>
            <PixelInput
              label="首付 (¥，可为 0)"
              value={downPayment}
              onChangeText={setDownPayment}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <PixelInput
              label="分期月数"
              value={installmentMonths}
              onChangeText={setInstallmentMonths}
              placeholder="例如：12"
              keyboardType="number-pad"
            />
            <PixelInput
              label="月供 (¥)"
              value={monthlyPayment}
              onChangeText={setMonthlyPayment}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            {/* 实时血本警示 */}
            {irrWarning && (
              <View style={styles.irrWarning}>
                <Text style={styles.irrWarningTitle}>⚠️ 分期血本警示</Text>
                <Text style={styles.irrWarningText}>
                  相比全款，你将额外多花{' '}
                  <Text style={styles.irrWarningHighlight}>¥{irrWarning.premium.toFixed(2)}</Text>
                  {'，折合真实年化利率 '}
                  <Text style={styles.irrWarningHighlight}>{irrWarning.irr.toFixed(1)}%</Text>
                </Text>
              </View>
            )}
          </>
        )}

        <PixelInput
          label="残值 / 预估转卖价 (¥，可选)"
          value={salvageValue}
          onChangeText={setSalvageValue}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <View style={styles.actions}>
          <BrutalButton
            title={isEditing ? '保存修改' : '新增物品'}
            onPress={handleSave}
            loading={loading}
            variant={isInstallment ? 'danger' : 'primary'}
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
    backgroundColor: THEME.colors.primaryLight + '30',
  },
  toggleActiveDanger: {
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.danger + '20',
  },
  toggleText: {
    fontSize: THEME.fontSize.md,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  toggleTextActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  toggleTextActiveDanger: {
    color: THEME.colors.dangerDark,
    fontWeight: '800',
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
  irrWarning: {
    borderWidth: 2,
    borderColor: THEME.colors.danger,
    borderRadius: THEME.borderRadius,
    backgroundColor: '#FFF0EE',
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  irrWarningTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '800',
    color: THEME.colors.dangerDark,
    marginBottom: 4,
  },
  irrWarningText: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textPrimary,
    lineHeight: 20,
  },
  irrWarningHighlight: {
    fontWeight: '800',
    color: THEME.colors.dangerDark,
  },
});
