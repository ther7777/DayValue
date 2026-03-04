import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Modal,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, OneTimeItem } from '../types';
import {
  getOneTimeItemById,
  deleteOneTimeItem,
  archiveOneTimeItem,
  redeemOneTimeItem,
} from '../database';
import {
  calculateDaysUsed,
  calculateDailyCost,
  calculateDailyDebt,
  calculateIRR,
  calculateInstallmentPremium,
} from '../utils/calculations';
import { formatCurrency, formatDate, getTodayString } from '../utils/formatters';
import { getCategoryInfo, THEME } from '../utils/constants';
import { BrutalButton, PixelInput, DatePickerField, StatusBadge } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const { itemId } = route.params;
  const [item, setItem] = useState<OneTimeItem | null>(null);

  // 归档弹窗
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [archiveDate, setArchiveDate] = useState(getTodayString());
  const [archiveSalvage, setArchiveSalvage] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadItem();
    }, [itemId]),
  );

  async function loadItem() {
    const data = await getOneTimeItemById(db, itemId);
    setItem(data);
    if (data) {
      navigation.setOptions({ title: data.name });
    }
  }

  async function handleDelete() {
    Alert.alert('确认删除', `确定要删除“${item?.name}”吗？此操作不可撤销。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteOneTimeItem(db, itemId);
          navigation.goBack();
        },
      },
    ]);
  }

  async function handleRedeem() {
    Alert.alert('赎身确认', '赎身后物品将进入「买断资产」轨道，解锁日均成本正向反馈。', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认赎身',
        onPress: async () => {
          await redeemOneTimeItem(db, itemId);
          loadItem();
        },
      },
    ]);
  }

  async function handleArchive() {
    const salvageNum = archiveSalvage ? parseFloat(archiveSalvage) : 0;
    if (isNaN(salvageNum) || salvageNum < 0) {
      Alert.alert('提示', '请输入有效的残值');
      return;
    }
    await archiveOneTimeItem(db, itemId, archiveDate, salvageNum);
    setArchiveModalVisible(false);
    loadItem();
  }

  if (!item) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const category = getCategoryInfo(item.category ?? 'other');
  const icon = item.icon ?? category.icon;

  const isUnredeemed = item.status === 'unredeemed';
  const isActive = item.status === 'active';
  const isArchived = item.status === 'archived';

  const daysUsed = calculateDaysUsed(item.buy_date, item.end_date);
  const dailyCost = calculateDailyCost(item.total_price, item.salvage_value, daysUsed);
  const dailyDebt = calculateDailyDebt(item.monthly_payment ?? 0);

  // 分期溢价和 IRR——仅适用于 unredeemed 物品
  const installmentPremium = isUnredeemed
    ? calculateInstallmentPremium(
        item.total_price,
        item.down_payment ?? 0,
        item.monthly_payment ?? 0,
        item.installment_months ?? 0,
      )
    : 0;
  const installmentIRR = isUnredeemed
    ? calculateIRR(
        item.total_price,
        item.down_payment ?? 0,
        item.monthly_payment ?? 0,
        item.installment_months ?? 0,
      )
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 顶部卡片 */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>{icon}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.categoryText}>{category.name}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>
      </View>

      {/* 关键数值高亮 */}
      <View
        style={[
          styles.highlightCard,
          isUnredeemed && { backgroundColor: THEME.colors.danger },
        ]}
      >
        <Text style={styles.highlightLabel}>
          {isUnredeemed ? '影子日供' : '日均成本'}
        </Text>
        <Text style={styles.highlightValue}>
          {formatCurrency(isUnredeemed ? dailyDebt : dailyCost)}
        </Text>
        {!isUnredeemed && (
          <Text style={styles.highlightSub}>已使用 {daysUsed} 天</Text>
        )}
      </View>

      {/* 详细信息 */}
      <View style={styles.card}>
        <InfoRow label="总金额" value={formatCurrency(item.total_price)} />
        <InfoRow label="购买日期" value={formatDate(item.buy_date)} />

        {item.is_installment === 1 && (
          <>
            <InfoRow label="分期月数" value={`${item.installment_months ?? 0} 个月`} />
            <InfoRow label="月供" value={formatCurrency(item.monthly_payment ?? 0)} />
          </>
        )}

        {!isUnredeemed && (
          <>
            <InfoRow label="残值" value={formatCurrency(item.salvage_value)} />
            <InfoRow label="使用天数" value={`${daysUsed} 天`} />
          </>
        )}

        {isArchived && (
          <InfoRow
            label="停用日期"
            value={item.end_date ? formatDate(item.end_date) : '-'}
          />
        )}
      </View>

      {/* 分期物品血本警示卡 */}
      {isUnredeemed && installmentPremium > 0 && (
        <View style={styles.bloodCard}>
          <Text style={styles.bloodTitle}>🩸 分期血本警示</Text>
          <View style={styles.bloodRow}>
            <View style={styles.bloodItem}>
              <Text style={styles.bloodLabel}>额外多花</Text>
              <Text style={styles.bloodValue}>{formatCurrency(installmentPremium)}</Text>
            </View>
            <View style={styles.bloodDivider} />
            <View style={styles.bloodItem}>
              <Text style={styles.bloodLabel}>真实年化利率</Text>
              <Text style={styles.bloodValue}>{installmentIRR.toFixed(1)}%</Text>
            </View>
          </View>
          <Text style={styles.bloodHint}>相比全款购买，选择分期使你将额外支出以上金额</Text>
        </View>
      )}

      {/* 操作按钮 */}
      <View style={styles.actions}>
        <BrutalButton
          title="编辑"
          onPress={() => navigation.navigate('AddEditItem', { itemId: item.id })}
          variant="primary"
          size="md"
          style={styles.actionBtn}
        />

        {isUnredeemed && (
          <BrutalButton
            title="赎身 / 结清"
            onPress={handleRedeem}
            variant="accent"
            size="md"
            style={styles.actionBtn}
          />
        )}

        {isActive && (
          <BrutalButton
            title="停用 / 单出"
            onPress={() => setArchiveModalVisible(true)}
            variant="accent"
            size="md"
            style={styles.actionBtn}
          />
        )}

        <BrutalButton
          title="删除"
          onPress={handleDelete}
          variant="danger"
          size="md"
          style={styles.actionBtn}
        />
      </View>

      {/* 停用弹窗 */}
      <Modal visible={archiveModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>停用物品</Text>
            <Text style={styles.modalDesc}>
              停用后将锁定成本，请填写停用日期与残值（若已出手）。
            </Text>
            <DatePickerField
              label="停用日期"
              value={archiveDate}
              onChange={setArchiveDate}
            />
            <PixelInput
              label="残值 / 预估转卖价 (¥)"
              value={archiveSalvage}
              onChangeText={setArchiveSalvage}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <BrutalButton
                title="确认停用"
                onPress={handleArchive}
                variant="accent"
                size="md"
                style={styles.modalBtn}
              />
              <BrutalButton
                title="取消"
                onPress={() => setArchiveModalVisible(false)}
                variant="outline"
                size="md"
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  label: {
    fontSize: THEME.fontSize.md,
    color: THEME.colors.textSecondary,
  },
  value: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.xl,
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.background,
  },
  loadingText: {
    fontSize: THEME.fontSize.md,
    color: THEME.colors.textSecondary,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: THEME.colors.primaryLight + '30',
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: THEME.spacing.md,
  },
  iconText: { fontSize: 28 },
  headerInfo: { flex: 1 },
  name: {
    fontSize: THEME.fontSize.xl,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  categoryText: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  highlightCard: {
    backgroundColor: THEME.colors.primary,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    padding: THEME.spacing.xl,
    marginBottom: THEME.spacing.lg,
    alignItems: 'center',
  },
  highlightLabel: {
    fontSize: THEME.fontSize.sm,
    color: '#FFFFFFAA',
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 20,
    fontFamily: THEME.fontFamily.pixel,
    color: '#FFFFFF',
  },
  highlightSub: {
    fontSize: THEME.fontSize.sm,
    color: '#FFFFFFCC',
    marginTop: 4,
  },
  actions: {
    gap: THEME.spacing.md,
  },
  actionBtn: {
    width: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '88%',
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    padding: THEME.spacing.xl,
  },
  modalTitle: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  modalDesc: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
  },
  modalActions: {
    marginTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  modalBtn: {
    width: '100%',
  },
  bloodCard: {
    backgroundColor: '#FFF0EE',
    borderWidth: 2,
    borderColor: THEME.colors.danger,
    borderRadius: THEME.borderRadius,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.lg,
  },
  bloodTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '800',
    color: THEME.colors.dangerDark,
    marginBottom: THEME.spacing.sm,
  },
  bloodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
  },
  bloodItem: {
    flex: 1,
    alignItems: 'center',
  },
  bloodDivider: {
    width: 1,
    height: 32,
    backgroundColor: THEME.colors.danger + '60',
    marginHorizontal: THEME.spacing.sm,
  },
  bloodLabel: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  bloodValue: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '800',
    color: THEME.colors.dangerDark,
  },
  bloodHint: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
});
