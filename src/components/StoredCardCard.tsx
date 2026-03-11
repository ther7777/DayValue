/**
 * StoredCardCard - 沉睡卡包卡片组件
 * 包含：实际沉睡本金展示、储值卡余额更新弹窗、计次卡打卡按钮，以及沉睡预警。
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type { StoredCard } from '../types';
import {
  deductStoredCardAmount,
  setStoredCardBalance,
  punchStoredCardCountMinusOne,
} from '../database';
import {
  calculateStoredPrincipal,
  calculateDaysSince,
} from '../utils/calculations';
import { formatCurrency, getTodayString } from '../utils/formatters';
import { THEME } from '../utils/constants';
import { useCategories } from '../contexts/CategoriesContext';
import { StatusBadge } from './StatusBadge';
import { BrutalButton } from './BrutalButton';
import { PixelInput } from './PixelInput';
import { CardShell } from './CardShell';
import { EntityCover } from './EntityCover';

type StoredCardLayout = 'list' | 'grid';

interface StoredCardCardProps {
  card: StoredCard;
  onPress: () => void;
  onDataChanged: () => void;
  layout?: StoredCardLayout;
  style?: StyleProp<ViewStyle>;
}

type AmountUpdateMode = 'deduct' | 'set';

export function StoredCardCard({
  card,
  onPress,
  onDataChanged,
  layout = 'list',
  style,
}: StoredCardCardProps) {
  const db = useSQLiteContext();
  const { getCategoryInfo } = useCategories();
  const categoryInfo = getCategoryInfo('stored_card', card.category ?? 'other');

  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [amountMode, setAmountMode] = useState<AmountUpdateMode>('deduct');
  const [amountInput, setAmountInput] = useState('');
  const [saving, setSaving] = useState(false);

  const dormantDays = calculateDaysSince(card.last_updated_date);
  const isDormant = dormantDays > card.reminder_days;
  const isGrid = layout === 'grid';

  const principal = calculateStoredPrincipal(
    card.actual_paid,
    card.face_value,
    card.current_balance,
  );

  // 折扣卡、等额储值卡更适合直接录入商家显示的剩余额度。
  const isEqualValueAmountCard =
    card.card_type === 'amount' &&
    Math.abs(card.face_value - card.actual_paid) < 0.0001;
  const recommendedAmountMode: AmountUpdateMode = isEqualValueAmountCard ? 'set' : 'deduct';

  const displayIcon = card.icon ?? categoryInfo.icon;
  const imageUri = card.image_uri ?? null;

  const usedCount = card.face_value - card.current_balance;
  const perUnitCost =
    card.card_type === 'count' && usedCount > 0
      ? card.actual_paid / usedCount
      : null;

  async function handleAmountSave() {
    const value = parseFloat(amountInput);
    if (Number.isNaN(value) || value < 0) {
      Alert.alert('提示', '请输入有效金额（>= 0）');
      return;
    }
    if (amountMode === 'deduct' && value <= 0) {
      Alert.alert('提示', '消费金额必须大于 0');
      return;
    }

    setSaving(true);
    try {
      const today = getTodayString();
      if (amountMode === 'deduct') {
        if (value > card.current_balance) {
          Alert.alert('提示', `消费金额超过余额，将按当前余额扣完（${card.current_balance.toFixed(2)}）`);
        }
        await deductStoredCardAmount(db, card.id, value, today);
      } else {
        if (value > card.face_value) {
          Alert.alert('提示', `余额不能超过总面值 ${card.face_value.toFixed(2)}`);
          return;
        }
        await setStoredCardBalance(db, card.id, value, today);
      }
      setAmountModalVisible(false);
      setAmountInput('');
      onDataChanged();
    } catch {
      Alert.alert('错误', '更新失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  async function handlePunchCount() {
    if (card.current_balance <= 0) {
      Alert.alert('提示', '次数已用完，无法继续打卡');
      return;
    }
    try {
      await punchStoredCardCountMinusOne(db, card.id, getTodayString());
      onDataChanged();
    } catch {
      Alert.alert('错误', '打卡失败，请重试');
    }
  }

  const actionTitle = card.card_type === 'amount' ? '更新余额' : '打卡 -1';

  return (
    <>
      <CardShell
        onPress={onPress}
        variant="stored_card"
        alert={isDormant}
        style={isGrid ? [styles.gridCard, style] : style}
      >
        {isGrid ? (
          <>
            <View style={styles.gridTop}>
              <EntityCover
                imageUri={imageUri}
                icon={displayIcon}
                size={52}
                iconSize={26}
                backgroundColor={THEME.colors.warning + '20'}
              />
              <View style={styles.gridTopContent}>
                <View style={styles.gridBadgeRow}>
                  <StatusBadge status={card.status} type="stored_card" />
                </View>
                <Text style={styles.gridName} numberOfLines={2}>{card.name}</Text>
                <Text style={styles.gridCategory} numberOfLines={1}>{categoryInfo.name}</Text>
              </View>
            </View>

            {isDormant && (
              <View style={styles.gridDormantTag}>
                <Text style={styles.gridDormantText}>已沉睡 {dormantDays} 天</Text>
              </View>
            )}

            <View style={styles.gridStats}>
              <View style={styles.gridStatBlock}>
                <Text style={styles.gridStatLabel}>沉睡本金</Text>
                <Text style={styles.gridPrincipalValue}>{formatCurrency(principal)}</Text>
              </View>
              <View style={styles.gridStatBlock}>
                <Text style={styles.gridStatLabel}>
                  {card.card_type === 'amount' ? '剩余额度' : '剩余次数'}
                </Text>
                <Text style={styles.gridStatValue} numberOfLines={2}>
                  {card.card_type === 'amount'
                    ? `${formatCurrency(card.current_balance)} / ${formatCurrency(card.face_value)}`
                    : `${Math.round(card.current_balance)} / ${Math.round(card.face_value)} 次`}
                </Text>
                {card.card_type === 'count' && (
                  <Text style={styles.gridSubValue} numberOfLines={1}>
                    单次成本：{perUnitCost !== null ? formatCurrency(perUnitCost) : '未使用'}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.gridActionRow}>
              {card.card_type === 'amount' ? (
                <BrutalButton
                  title={actionTitle}
                  onPress={() => {
                    setAmountMode(recommendedAmountMode);
                    setAmountModalVisible(true);
                  }}
                  variant="accent"
                  size="sm"
                  style={styles.gridActionBtn}
                />
              ) : (
                <BrutalButton
                  title={actionTitle}
                  onPress={handlePunchCount}
                  variant={card.current_balance <= 0 ? 'outline' : 'success'}
                  size="sm"
                  style={styles.gridActionBtn}
                  disabled={card.current_balance <= 0}
                />
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <EntityCover
                  imageUri={imageUri}
                  icon={displayIcon}
                  size={44}
                  iconSize={24}
                  backgroundColor={THEME.colors.warning + '20'}
                />
                <View>
                  <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
                  <Text style={styles.categoryLabel}>{categoryInfo.name}</Text>
                </View>
              </View>
              <StatusBadge status={card.status} type="stored_card" />
            </View>

            {isDormant && (
              <View style={styles.dormantBanner}>
                <Text style={styles.dormantText}>已沉睡 {dormantDays} 天</Text>
              </View>
            )}

            <View style={styles.dataRow}>
              <View style={styles.principalBlock}>
                <Text style={styles.principalLabel}>实际沉睡本金</Text>
                <Text style={styles.principalValue}>{formatCurrency(principal)}</Text>
              </View>

              {card.card_type === 'amount' ? (
                <View style={styles.balanceBlock}>
                  <Text style={styles.balanceLabel}>剩余额度</Text>
                  <Text style={styles.balanceValue}>
                    {formatCurrency(card.current_balance)}
                    <Text style={styles.balanceDivider}> / </Text>
                    <Text style={styles.balanceFace}>{formatCurrency(card.face_value)}</Text>
                  </Text>
                </View>
              ) : (
                <View style={styles.balanceBlock}>
                  <Text style={styles.balanceLabel}>剩余次数</Text>
                  <Text style={styles.balanceValue}>
                    {Math.round(card.current_balance)}
                    <Text style={styles.balanceDivider}> / </Text>
                    <Text style={styles.balanceFace}>{Math.round(card.face_value)}</Text>
                    <Text style={styles.balanceUnit}> 次</Text>
                  </Text>
                  <Text style={styles.perUnit}>
                    单次成本：{perUnitCost !== null ? formatCurrency(perUnitCost) : '未使用'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              {card.card_type === 'amount' ? (
                <BrutalButton
                  title={actionTitle}
                  onPress={() => {
                    setAmountMode(recommendedAmountMode);
                    setAmountModalVisible(true);
                  }}
                  variant="accent"
                  size="sm"
                  style={styles.actionBtn}
                />
              ) : (
                <BrutalButton
                  title={actionTitle}
                  onPress={handlePunchCount}
                  variant={card.current_balance <= 0 ? 'outline' : 'success'}
                  size="sm"
                  style={styles.actionBtn}
                  disabled={card.current_balance <= 0}
                />
              )}
            </View>
          </>
        )}
      </CardShell>

      <Modal visible={amountModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>更新余额</Text>
            <Text style={styles.modalSubtitle}>{card.name}</Text>

            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, amountMode === 'deduct' && styles.modeBtnActive]}
                onPress={() => setAmountMode('deduct')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, amountMode === 'deduct' && styles.modeBtnTextActive]}>
                  本次扣减
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, amountMode === 'set' && styles.modeBtnActive]}
                onPress={() => setAmountMode('set')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeBtnText, amountMode === 'set' && styles.modeBtnTextActive]}>
                  设定剩余
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modeHint}>
              {amountMode === 'deduct'
                ? `当前余额 ${formatCurrency(card.current_balance)}，输入本次消费金额`
                : `总面值 ${formatCurrency(card.face_value)}，输入当前最新余额`}
            </Text>
            {isEqualValueAmountCard && (
              <Text style={styles.recommendHint}>
                小提示：折扣卡、等额储值卡更适合直接填写商家展示的当前余额。
              </Text>
            )}

            <PixelInput
              label={amountMode === 'deduct' ? '消费金额 (￥)' : '当前剩余 (￥)'}
              value={amountInput}
              onChangeText={setAmountInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <View style={styles.modalActions}>
              <BrutalButton
                title="取消"
                onPress={() => {
                  setAmountModalVisible(false);
                  setAmountInput('');
                }}
                variant="outline"
                size="md"
                style={styles.modalBtn}
              />
              <BrutalButton
                title="保存"
                onPress={handleAmountSave}
                loading={saving}
                variant="primary"
                size="md"
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.sm,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  name: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  categoryLabel: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  dormantBanner: {
    backgroundColor: THEME.colors.warning + '33',
    borderWidth: 1,
    borderColor: THEME.colors.warning,
    borderRadius: 4,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 3,
    marginBottom: THEME.spacing.sm,
    alignSelf: 'flex-start',
  },
  dormantText: {
    fontSize: THEME.fontSize.xs,
    fontWeight: '700',
    color: '#856404',
  },
  dataRow: {
    flexDirection: 'row',
    gap: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
  },
  principalBlock: {
    flex: 1,
  },
  principalLabel: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  principalValue: {
    fontSize: THEME.fontSize.lg,
    fontWeight: '900',
    color: THEME.colors.danger,
  },
  balanceBlock: {
    flex: 1.4,
  },
  balanceLabel: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: THEME.fontSize.md,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  balanceDivider: {
    color: THEME.colors.textLight,
    fontWeight: '400',
  },
  balanceFace: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    fontWeight: '400',
  },
  balanceUnit: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
  },
  perUnit: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    alignSelf: 'flex-start',
  },
  gridCard: {
    minHeight: 212,
    marginBottom: 0,
    padding: THEME.spacing.sm + 2,
  },
  gridTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.xs,
    gap: THEME.spacing.sm,
  },
  gridTopContent: {
    flex: 1,
    minHeight: 52,
  },
  gridBadgeRow: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  gridName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    minHeight: 34,
  },
  gridCategory: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  gridDormantTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: THEME.spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: THEME.colors.warning + '26',
    borderWidth: 1,
    borderColor: THEME.colors.warning,
    marginBottom: THEME.spacing.xs,
  },
  gridDormantText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#856404',
  },
  gridStats: {
    flexDirection: 'row',
    gap: THEME.spacing.xs,
    marginBottom: THEME.spacing.sm,
  },
  gridStatBlock: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: THEME.spacing.xs,
    borderRadius: 4,
    backgroundColor: THEME.colors.background,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  gridStatLabel: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  gridStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  gridPrincipalValue: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.danger,
  },
  gridSubValue: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  gridActionRow: {
    marginTop: 'auto',
  },
  gridActionBtn: {
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
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginBottom: THEME.spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: THEME.spacing.sm,
    borderRadius: THEME.borderRadius,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.background,
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.primaryLight + '30',
  },
  modeBtnText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  modeBtnTextActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  modeHint: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xs,
  },
  recommendHint: {
    fontSize: THEME.fontSize.xs,
    color: THEME.colors.primary,
    marginBottom: THEME.spacing.md,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: THEME.spacing.sm,
    marginTop: THEME.spacing.sm,
  },
  modalBtn: {
    flex: 1,
  },
});
