import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Modal,
  Animated,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, OneTimeItem } from '../types';
import {
  getOneTimeItemById,
  deleteOneTimeItem,
  pauseOneTimeItem,
  resumeOneTimeItem,
  sellOneTimeItem,
  redeemOneTimeItem,
} from '../database';
import {
  calculateDailyCost,
  calculateDailyDebt,
  calculateIRR,
  calculateInstallmentPremium,
  calculateOneTimeItemActiveDays,
} from '../utils/calculations';
import { formatCurrency, formatDate, getTodayString } from '../utils/formatters';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import { BrutalButton, EntityCover, PixelInput, DatePickerField, StatusBadge } from '../components';
import { deleteEntityImageAsync } from '../utils/entityImages';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

export function ItemDetailScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const { getCategoryInfo } = useCategories();
  const { itemId } = route.params;
  const [item, setItem] = useState<OneTimeItem | null>(null);

  // 停用 / 再用 / 售出弹窗
  const [pauseModalVisible, setPauseModalVisible] = useState(false);
  const [pauseDate, setPauseDate] = useState(getTodayString());
  const [resumeModalVisible, setResumeModalVisible] = useState(false);
  const [resumeDate, setResumeDate] = useState(getTodayString());
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [sellDate, setSellDate] = useState(getTodayString());
  const [sellPrice, setSellPrice] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);

  // 赎身成功动画弹窗
  const [redeemModalVisible, setRedeemModalVisible] = useState(false);
  const [redeemBusy, setRedeemBusy] = useState(false);
  const redeemScale = useRef(new Animated.Value(0.9)).current;
  const redeemShakeX = useRef(new Animated.Value(0)).current;
  const redeemColor = useRef(new Animated.Value(0)).current;

  const redeemTextColor = redeemColor.interpolate({
    inputRange: [0, 1],
    outputRange: [THEME.colors.textPrimary, THEME.colors.success],
  });

  const loadItem = useCallback(async () => {
    try {
      const data = await getOneTimeItemById(db, itemId);
      setItem(data);
      if (data) {
        navigation.setOptions({ title: data.name });
      }
    } catch (error) {
      console.error('加载物品详情失败', error);
    }
  }, [db, itemId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadItem();
    }, [loadItem]),
  );

  async function handleDelete() {
    Alert.alert('确认删除', `确定要删除“${item?.name}”吗？此操作不可撤销。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await deleteEntityImageAsync(item?.image_uri);
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
        onPress: () => {
          if (redeemBusy) return;
          setRedeemBusy(true);
          setRedeemModalVisible(true);
          redeemScale.setValue(0.9);
          redeemShakeX.setValue(0);
          redeemColor.setValue(0);

          Animated.parallel([
            Animated.sequence([
              Animated.timing(redeemScale, {
                toValue: 1.25,
                duration: 320,
                useNativeDriver: true,
              }),
              Animated.timing(redeemScale, {
                toValue: 1.05,
                duration: 180,
                useNativeDriver: true,
              }),
              Animated.timing(redeemScale, {
                toValue: 1.15,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(redeemScale, {
                toValue: 1.0,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.delay(500),
            ]),
            Animated.sequence([
              Animated.timing(redeemShakeX, { toValue: -10, duration: 70, useNativeDriver: true }),
              Animated.timing(redeemShakeX, { toValue: 10, duration: 70, useNativeDriver: true }),
              Animated.timing(redeemShakeX, { toValue: -8, duration: 70, useNativeDriver: true }),
              Animated.timing(redeemShakeX, { toValue: 8, duration: 70, useNativeDriver: true }),
              Animated.timing(redeemShakeX, { toValue: -6, duration: 70, useNativeDriver: true }),
              Animated.timing(redeemShakeX, { toValue: 6, duration: 70, useNativeDriver: true }),
              Animated.timing(redeemShakeX, { toValue: 0, duration: 90, useNativeDriver: true }),
              Animated.delay(990),
            ]),
            Animated.sequence([
              Animated.timing(redeemColor, { toValue: 1, duration: 900, useNativeDriver: false }),
              Animated.delay(600),
            ]),
          ]).start(async ({ finished }) => {
            if (!finished) return;
            try {
              await redeemOneTimeItem(db, itemId);
              setRedeemModalVisible(false);
              setRedeemBusy(false);
              navigation.goBack();
            } catch {
              setRedeemModalVisible(false);
              setRedeemBusy(false);
              Alert.alert('错误', '赎身失败，请重试');
            }
          });
        },
      },
    ]);
  }

  async function handlePause() {
    if (!item || statusBusy) return;
    if (pauseDate > getTodayString()) {
      Alert.alert('提示', '停用日期不能晚于今天');
      return;
    }
    setStatusBusy(true);
    try {
      await pauseOneTimeItem(db, itemId, pauseDate);
      setPauseModalVisible(false);
      await loadItem();
    } catch (e) {
      Alert.alert('错误', e instanceof Error ? e.message : '停用失败，请重试');
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleResume() {
    if (!item || statusBusy) return;
    if (resumeDate > getTodayString()) {
      Alert.alert('提示', '恢复日期不能晚于今天');
      return;
    }
    setStatusBusy(true);
    try {
      await resumeOneTimeItem(db, itemId, resumeDate);
      setResumeModalVisible(false);
      await loadItem();
    } catch (e) {
      Alert.alert('错误', e instanceof Error ? e.message : '恢复失败，请重试');
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleSell() {
    if (!item || statusBusy) return;
    if (sellDate > getTodayString()) {
      Alert.alert('提示', '售出日期不能晚于今天');
      return;
    }
    const priceNum = parseFloat(sellPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      Alert.alert('提示', '请输入有效的卖出价（≥ 0）');
      return;
    }
    if (priceNum > item.total_price) {
      Alert.alert('提示', '卖出价不能高于原价');
      return;
    }

    setStatusBusy(true);
    try {
      await sellOneTimeItem(db, itemId, sellDate, priceNum);
      setSellModalVisible(false);
      setSellPrice('');
      await loadItem();
    } catch (e) {
      Alert.alert('错误', e instanceof Error ? e.message : '售出失败，请重试');
    } finally {
      setStatusBusy(false);
    }
  }

  if (!item) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const category = getCategoryInfo('item', item.category ?? 'other');
  const icon = item.icon ?? category.icon;
  const imageUri = item.image_uri ?? null;

  const isUnredeemed = item.status === 'unredeemed';
  const isActive = item.status === 'active';
  const isArchived = item.status === 'archived';

  const archivedReason =
    item.archived_reason ?? (item.salvage_value > 0 ? 'sold' : 'paused');
  const isSold = isArchived && archivedReason === 'sold';
  const isPaused = isArchived && archivedReason !== 'sold';

  const activeDays = calculateOneTimeItemActiveDays(item);
  const dailyCost = calculateDailyCost(item.total_price, isSold ? item.salvage_value : 0, activeDays);
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
          <EntityCover
            imageUri={imageUri}
            icon={icon}
            size={52}
            iconSize={28}
            backgroundColor={THEME.colors.primaryLight + '30'}
            style={styles.iconBox}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.categoryText}>{category.name}</Text>
          </View>
          <StatusBadge
            status={item.status}
            labelOverride={
              isArchived
                ? isSold
                  ? '已售出'
                  : '已停用'
                : undefined
            }
          />
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
          <Text style={styles.highlightSub}>激活 {activeDays} 天</Text>
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
            <InfoRow label="激活天数" value={`${activeDays} 天`} />
            {isSold && (
              <InfoRow label="卖出价" value={formatCurrency(item.salvage_value)} />
            )}
          </>
        )}

        {isPaused && (
          <InfoRow
            label="停用日期"
            value={item.end_date ? formatDate(item.end_date) : '-'}
          />
        )}

        {isSold && (
          <InfoRow
            label="售出日期"
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
            disabled={redeemBusy}
            style={styles.actionBtn}
          />
        )}

        {isActive && (
          <>
            <BrutalButton
              title="停用"
              onPress={() => {
                setPauseDate(getTodayString());
                setPauseModalVisible(true);
              }}
              variant="accent"
              size="md"
              style={styles.actionBtn}
            />
            <BrutalButton
              title="售出"
              onPress={() => {
                setSellDate(getTodayString());
                setSellPrice('');
                setSellModalVisible(true);
              }}
              variant="danger"
              size="md"
              style={styles.actionBtn}
            />
          </>
        )}

        {isPaused && (
          <BrutalButton
            title="恢复使用"
            onPress={() => {
              setResumeDate(getTodayString());
              setResumeModalVisible(true);
            }}
            variant="success"
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

      {/* 赎身成功动画 */}
      <Modal
        visible={redeemModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.redeemOverlay}>
          <Animated.View
            style={[
              styles.redeemBox,
              { transform: [{ translateX: redeemShakeX }, { scale: redeemScale }] },
            ]}
          >
            <Animated.Text style={[styles.redeemText, { color: redeemTextColor }]}>
              🔗 锁链碎裂！赎身成功！
            </Animated.Text>
          </Animated.View>
        </View>
      </Modal>

      {/* 停用弹窗 */}
      <Modal visible={pauseModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>停用资产</Text>
            <Text style={styles.modalDesc}>
              停用后将暂停「激活天数」累计，并从首页「日均成本」统计中移除；之后可随时恢复使用。
            </Text>
            <DatePickerField
              label="停用日期"
              value={pauseDate}
              onChange={setPauseDate}
            />
            <View style={styles.modalActions}>
              <BrutalButton
                title="确认停用"
                onPress={handlePause}
                loading={statusBusy}
                variant="accent"
                size="md"
                style={styles.modalBtn}
              />
              <BrutalButton
                title="取消"
                onPress={() => setPauseModalVisible(false)}
                variant="outline"
                size="md"
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 恢复使用弹窗 */}
      <Modal visible={resumeModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>恢复使用</Text>
            <Text style={styles.modalDesc}>
              恢复后将从所选日期开始继续累计「激活天数」，并重新计入首页统计。
            </Text>
            <DatePickerField
              label="恢复日期"
              value={resumeDate}
              onChange={setResumeDate}
            />
            <View style={styles.modalActions}>
              <BrutalButton
                title="确认恢复"
                onPress={handleResume}
                loading={statusBusy}
                variant="success"
                size="md"
                style={styles.modalBtn}
              />
              <BrutalButton
                title="取消"
                onPress={() => setResumeModalVisible(false)}
                variant="outline"
                size="md"
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 售出弹窗 */}
      <Modal visible={sellModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>售出资产</Text>
            <Text style={styles.modalDesc}>
              售出后不可恢复，将记录卖出日期与卖出价（卖出价 ≤ 原价）。
            </Text>
            <DatePickerField
              label="售出日期"
              value={sellDate}
              onChange={setSellDate}
            />
            <PixelInput
              label="卖出价 (¥)"
              value={sellPrice}
              onChangeText={setSellPrice}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <View style={styles.modalActions}>
              <BrutalButton
                title="确认售出"
                onPress={handleSell}
                loading={statusBusy}
                variant="danger"
                size="md"
                style={styles.modalBtn}
              />
              <BrutalButton
                title="取消"
                onPress={() => setSellModalVisible(false)}
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
  redeemOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.xl,
  },
  redeemBox: {
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    paddingVertical: THEME.spacing.xl,
    paddingHorizontal: THEME.spacing.xl,
    alignItems: 'center',
  },
  redeemText: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '900',
    textAlign: 'center',
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
