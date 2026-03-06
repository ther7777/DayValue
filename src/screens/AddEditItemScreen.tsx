import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

import type { CategoryInfo, OneTimeItemStatus, RootStackParamList } from '../types';
import { createOneTimeItem, getOneTimeItemById, updateOneTimeItem } from '../database';
import {
  BrutalButton,
  CategoryPicker,
  DatePickerField,
  ImagePickerField,
  PixelInput,
} from '../components';
import { THEME } from '../utils/constants';
import { getTodayString } from '../utils/formatters';
import { calculateIRR, calculateInstallmentPremium } from '../utils/calculations';
import {
  pickEntityImageFromLibraryAsync,
  resolveEntityImageForSaveAsync,
} from '../utils/entityImages';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditItem'>;

export function AddEditItemScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const editId = route.params?.itemId;
  const isEditing = editId !== undefined;
  const defaultIsInstallment = route.params?.defaultIsInstallment ?? false;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('digital');
  const [icon, setIcon] = useState('📱');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [originalImageUri, setOriginalImageUri] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState('');
  const [buyDate, setBuyDate] = useState(getTodayString());

  const [isInstallment, setIsInstallment] = useState(defaultIsInstallment);
  const [installmentMonths, setInstallmentMonths] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [downPayment, setDownPayment] = useState('');

  const [originalStatus, setOriginalStatus] = useState<OneTimeItemStatus | null>(null);
  const [lockedSalvageValue, setLockedSalvageValue] = useState(0);
  const [lockedIsSold, setLockedIsSold] = useState(false);
  const [loading, setLoading] = useState(false);

  const irrWarning = useMemo(() => {
    if (!isInstallment) return null;

    const price = parseFloat(totalPrice);
    const dp = parseFloat(downPayment) || 0;
    const mp = parseFloat(monthlyPayment);
    const months = parseInt(installmentMonths, 10);

    if (
      Number.isNaN(price) ||
      Number.isNaN(mp) ||
      Number.isNaN(months) ||
      price <= 0 ||
      mp <= 0 ||
      months <= 0
    ) {
      return null;
    }

    const premium = calculateInstallmentPremium(price, dp, mp, months);
    if (premium <= 0) return null;

    const irr = calculateIRR(price, dp, mp, months);
    return { premium, irr };
  }, [downPayment, installmentMonths, isInstallment, monthlyPayment, totalPrice]);

  const loadItemSafe = useCallback(async (id: number) => {
    try {
      await loadItem(id);
    } catch (error) {
      Alert.alert('错误', error instanceof Error ? error.message : '加载失败，请重试');
    }
  }, [db]);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? '编辑物品' : '新增物品' });
    if (isEditing && editId !== undefined) {
      void loadItemSafe(editId);
    }
  }, [editId, isEditing, loadItemSafe, navigation]);

  async function loadItem(id: number) {
    const item = await getOneTimeItemById(db, id);
    if (!item) return;

    setName(item.name);
    setCategory(item.category ?? 'other');
    setIcon(item.icon ?? '📦');
    setImageUri(item.image_uri ?? null);
    setOriginalImageUri(item.image_uri ?? null);
    setTotalPrice(String(item.total_price));
    setBuyDate(item.buy_date);

    setIsInstallment(item.is_installment === 1);
    setInstallmentMonths(item.installment_months ? String(item.installment_months) : '');
    setMonthlyPayment(item.monthly_payment ? String(item.monthly_payment) : '');
    setDownPayment(item.down_payment ? String(item.down_payment) : '');
    setOriginalStatus(item.status);
    setLockedSalvageValue(item.salvage_value ?? 0);
    setLockedIsSold(item.status === 'archived' && item.archived_reason === 'sold');
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

  function resolveNextStatus(): OneTimeItemStatus {
    if (originalStatus === 'archived') return 'archived';
    if (originalStatus === 'active') return 'active';
    if (originalStatus === 'unredeemed') {
      return isInstallment ? 'unredeemed' : 'active';
    }
    return isInstallment ? 'unredeemed' : 'active';
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入物品名称');
      return;
    }

    const totalPriceNum = parseFloat(totalPrice);
    if (Number.isNaN(totalPriceNum) || totalPriceNum <= 0) {
      Alert.alert('提示', '请输入有效的总金额');
      return;
    }

    if (
      isEditing &&
      originalStatus === 'archived' &&
      lockedSalvageValue > 0 &&
      totalPriceNum < lockedSalvageValue
    ) {
      Alert.alert(
        '提示',
        lockedIsSold
          ? `已售出资产的原价不能低于卖出价（¥${lockedSalvageValue.toFixed(2)}）`
          : `该资产已记录残值或卖出价（¥${lockedSalvageValue.toFixed(2)}），原价不能低于这个数值`,
      );
      return;
    }

    let monthsNum: number | null = null;
    let monthlyPaymentNum: number | null = null;
    let downPaymentNum = 0;

    if (isInstallment) {
      const nextMonths = parseInt(installmentMonths, 10);
      if (Number.isNaN(nextMonths) || nextMonths <= 0) {
        Alert.alert('提示', '请输入有效的分期月数');
        return;
      }

      const nextMonthlyPayment = parseFloat(monthlyPayment);
      if (Number.isNaN(nextMonthlyPayment) || nextMonthlyPayment <= 0) {
        Alert.alert('提示', '请输入有效的月供金额');
        return;
      }

      monthsNum = nextMonths;
      monthlyPaymentNum = nextMonthlyPayment;
      downPaymentNum = downPayment ? parseFloat(downPayment) || 0 : 0;

      if (downPaymentNum >= totalPriceNum) {
        Alert.alert('提示', '首付已经大于等于总价，建议直接关闭分期开关');
        return;
      }
    }

    const nextStatus = resolveNextStatus();

    setLoading(true);
    try {
      const savedImageUri = await resolveEntityImageForSaveAsync({
        currentImageUri: originalImageUri,
        nextImageUri: imageUri,
        type: 'item',
      });

      const payload = {
        name: name.trim(),
        category,
        icon,
        image_uri: savedImageUri,
        total_price: totalPriceNum,
        buy_date: buyDate,
        is_installment: isInstallment ? 1 : 0,
        installment_months: isInstallment ? monthsNum : null,
        monthly_payment: isInstallment ? monthlyPaymentNum : null,
        down_payment: isInstallment ? downPaymentNum : 0,
        status: nextStatus,
      };

      if (isEditing && editId !== undefined) {
        await updateOneTimeItem(db, editId, payload);
      } else {
        await createOneTimeItem(db, payload);
      }

      setOriginalImageUri(savedImageUri);
      navigation.goBack();
    } catch (error) {
      Alert.alert('错误', error instanceof Error ? error.message : '保存失败，请重试');
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

        <ImagePickerField
          label="封面图片（可选）"
          imageUri={imageUri}
          fallbackIcon={icon}
          onPick={handlePickImage}
          onRemove={() => setImageUri(null)}
        />

        <PixelInput
          label="总金额（¥）"
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

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>是否分期 / 先用后付</Text>
          <View style={styles.toggleRow}>
            <InstallmentButton
              title="否（全款）"
              active={!isInstallment}
              danger={false}
              onPress={() => setIsInstallment(false)}
            />
            <InstallmentButton
              title="是（分期）"
              active={isInstallment}
              danger
              onPress={() => setIsInstallment(true)}
            />
          </View>
        </View>

        {isInstallment ? (
          <>
            <PixelInput
              label="首付（¥，可为 0）"
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
              label="月供（¥）"
              value={monthlyPayment}
              onChangeText={setMonthlyPayment}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            {irrWarning ? (
              <View style={styles.irrWarning}>
                <Text style={styles.irrWarningTitle}>分期血本警示</Text>
                <Text style={styles.irrWarningText}>
                  相比全款，你将额外多花
                  <Text style={styles.irrWarningHighlight}> ¥{irrWarning.premium.toFixed(2)}</Text>
                  ，折合真实年化利率
                  <Text style={styles.irrWarningHighlight}> {irrWarning.irr.toFixed(1)}%</Text>
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

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

function InstallmentButton({
  title,
  active,
  danger,
  onPress,
}: {
  title: string;
  active: boolean;
  danger: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.toggleBtn,
        active && (danger ? styles.toggleActiveDanger : styles.toggleActive),
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.toggleText,
          active && (danger ? styles.toggleTextActiveDanger : styles.toggleTextActive),
        ]}
      >
        {title}
      </Text>
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
