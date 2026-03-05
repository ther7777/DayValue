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

interface StoredCardCardProps {
  card: StoredCard;
  onPress: () => void;
  onDataChanged: () => void;
}

type AmountUpdateMode = 'deduct' | 'set';

export function StoredCardCard({ card, onPress, onDataChanged }: StoredCardCardProps) {
  const db = useSQLiteContext();
  const { getCategoryInfo } = useCategories();
  const categoryInfo = getCategoryInfo('stored_card', card.category ?? 'other');

  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [amountMode, setAmountMode] = useState<AmountUpdateMode>('deduct');
  const [amountInput, setAmountInput] = useState('');
  const [saving, setSaving] = useState(false);

  const dormantDays = calculateDaysSince(card.last_updated_date);
  const isDormant = dormantDays > card.reminder_days;

  const principal = calculateStoredPrincipal(
    card.actual_paid,
    card.face_value,
    card.current_balance,
  );

  const displayIcon = card.icon ?? categoryInfo.icon;

  // 计次卡：已使用次数 = 总次数 - 当前剩余
  const usedCount = card.face_value - card.current_balance;
  const perUnitCost =
    card.card_type === 'count' && usedCount > 0
      ? card.actual_paid / usedCount
      : null;

  async function handleAmountSave() {
    const value = parseFloat(amountInput);
    if (isNaN(value) || value < 0) {
      Alert.alert('提示', '请输入有效金额（≥ 0）');
      return;
    }
    if (amountMode === 'deduct' && value <= 0) {
      Alert.alert('🧐 扣个寂寞？', '消费金额得大于 0 才有意义哦');
      return;
    }

    setSaving(true);
    try {
      const today = getTodayString();
      if (amountMode === 'deduct') {
        if (value > card.current_balance) {
          Alert.alert('提示', `消费金额超过余额，将按余额扣完（¥${card.current_balance.toFixed(2)}）`);
        }
        await deductStoredCardAmount(db, card.id, value, today);
      } else {
        if (value > card.face_value) {
          Alert.alert('提示', `余额不能超过总面值 ¥${card.face_value.toFixed(2)}`);
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

  return (
    <>
      <TouchableOpacity
        style={[styles.card, isDormant && styles.cardDormant]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.icon}>{displayIcon}</Text>
            <View>
              <Text style={styles.name} numberOfLines={1}>{card.name}</Text>
              <Text style={styles.categoryLabel}>{categoryInfo.name}</Text>
            </View>
          </View>
          <StatusBadge status={card.status} type="stored_card" />
        </View>

        {/* 沉睡预警条 */}
        {isDormant && (
          <View style={styles.dormantBanner}>
            <Text style={styles.dormantText}>🚧 已沉睡 {dormantDays} 天</Text>
          </View>
        )}

        {/* 主数据行 */}
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
                单次成本：{perUnitCost !== null ? formatCurrency(perUnitCost) : '— / 未使用'}
              </Text>
            </View>
          )}
        </View>

        {/* 操作按钮区 - 阻止冒泡触发 onPress */}
        <View style={styles.actions}>
          {card.card_type === 'amount' ? (
            <BrutalButton
              title="更新余额"
              onPress={() => {
                setAmountModalVisible(true);
              }}
              variant="accent"
              size="sm"
              style={styles.actionBtn}
            />
          ) : (
            <BrutalButton
              title="打卡 −1"
              onPress={handlePunchCount}
              variant={card.current_balance <= 0 ? 'outline' : 'success'}
              size="sm"
              style={styles.actionBtn}
              disabled={card.current_balance <= 0}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* 储值卡更新余额弹窗 */}
      <Modal visible={amountModalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>更新余额</Text>
            <Text style={styles.modalSubtitle}>{card.name}</Text>

            {/* 模式切换 */}
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

            <PixelInput
              label={amountMode === 'deduct' ? '消费金额 (¥)' : '当前剩余 (¥)'}
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
  card: {
    backgroundColor: THEME.colors.surface,
    ...THEME.pixelBorder,
    ...THEME.pixelShadow,
    marginBottom: THEME.spacing.md,
    padding: THEME.spacing.lg,
  },
  cardDormant: {
    borderColor: THEME.colors.warning,
    shadowColor: '#B7860B',
  },
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
  icon: {
    fontSize: 28,
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
  // Modal
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
    marginBottom: THEME.spacing.md,
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
