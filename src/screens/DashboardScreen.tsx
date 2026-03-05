import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, OneTimeItem, Subscription, StoredCard } from '../types';
import { getAllOneTimeItems, getAllSubscriptions, getAllStoredCards } from '../database';
import {
  calculateDaysUsed,
  calculateDailyCost,
  calculateSubscriptionDailyCost,
  calculateDailyDebt,
  calculateStoredPrincipal,
} from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { THEME } from '../utils/constants';
import { ItemCard, SubscriptionCard, EmptyState, BrutalButton, StoredCardCard } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type TabKey = 'assets' | 'debts' | 'stored_cards';
type DebtListItem = OneTimeItem | Subscription;

function isSubscription(item: DebtListItem): item is Subscription {
  return 'cycle_price' in item;
}

export function DashboardScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const [activeTab, setActiveTab] = useState<TabKey>('assets');
  const [items, setItems] = useState<OneTimeItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [storedCards, setStoredCards] = useState<StoredCard[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showArchivedCards, setShowArchivedCards] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  async function loadData() {
    const [i, s, c] = await Promise.all([
      getAllOneTimeItems(db),
      getAllSubscriptions(db),
      getAllStoredCards(db),
    ]);
    setItems(i);
    setSubscriptions(s);
    setStoredCards(c);
  }

  const activeItems = useMemo(
    () => items.filter(i => i.status === 'active'),
    [items],
  );
  const archivedItems = useMemo(
    () => items.filter(i => i.status === 'archived'),
    [items],
  );
  const unredeemedItems = useMemo(
    () => items.filter(i => i.status === 'unredeemed'),
    [items],
  );

  const activeSubs = useMemo(
    () => subscriptions.filter(s => s.status === 'active'),
    [subscriptions],
  );

  const totalAssetDailyCost = useMemo(() => {
    return activeItems.reduce((sum, item) => {
      const days = calculateDaysUsed(item.buy_date, item.end_date);
      return sum + calculateDailyCost(item.total_price, item.salvage_value, days);
    }, 0);
  }, [activeItems]);

  const totalSubDailyCost = useMemo(() => {
    return activeSubs.reduce(
      (sum, sub) => sum + calculateSubscriptionDailyCost(sub.cycle_price, sub.billing_cycle),
      0,
    );
  }, [activeSubs]);

  const totalInstallmentDailyDebt = useMemo(() => {
    return unredeemedItems.reduce(
      (sum, item) => sum + calculateDailyDebt(item.monthly_payment ?? 0),
      0,
    );
  }, [unredeemedItems]);

  const totalDebtDailyCost = totalInstallmentDailyDebt + totalSubDailyCost;

  // ─── Stored Cards ─────────────────────────────────────
  const activeStoredCards = useMemo(
    () => storedCards.filter(c => c.status === 'active'),
    [storedCards],
  );
  const archivedStoredCards = useMemo(
    () => storedCards.filter(c => c.status === 'archived'),
    [storedCards],
  );
  const totalPrincipal = useMemo(
    () =>
      activeStoredCards.reduce(
        (sum, card) =>
          sum + calculateStoredPrincipal(card.actual_paid, card.face_value, card.current_balance),
        0,
      ),
    [activeStoredCards],
  );
  const visibleStoredCards = useMemo(
    () => (showArchivedCards ? storedCards : activeStoredCards),
    [activeStoredCards, showArchivedCards, storedCards],
  );

  const assetsSections = useMemo(
    () => {
      const sections: { title: string; data: OneTimeItem[] }[] = [];
      sections.push({ title: '在用资产', data: activeItems });
      if (showArchived) {
        sections.push({ title: '已隐藏', data: archivedItems });
      }
      return sections;
    },
    [activeItems, archivedItems, showArchived],
  );

  const debtSections = useMemo(() => {
    const sections: { title: string; data: DebtListItem[] }[] = [];
    sections.push({ title: '分期物品（赎身中）', data: unredeemedItems as DebtListItem[] });
    sections.push({ title: '持续订阅', data: activeSubs as DebtListItem[] });
    return sections;
  }, [unredeemedItems, activeSubs]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* 顶部 Hero 区域 - 跟随 Tab 切换主题 */}
        <View style={[
          styles.hero,
          activeTab === 'debts' && styles.heroDebt,
          activeTab === 'stored_cards' && styles.heroStored,
        ]}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.heroTitle}>DayValue</Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate('Statistics')}
                activeOpacity={0.7}
              >
                <Text style={styles.iconBtnText}>📊</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => navigation.navigate('Categories')}
                activeOpacity={0.7}
              >
                <Text style={styles.iconBtnText}>⚙️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.helpBtn}
                onPress={() => setHelpModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.helpBtnText}>?</Text>
              </TouchableOpacity>
            </View>
          </View>
          {activeTab === 'assets' && (
            <>
              <Text style={styles.heroSubtitle}>今日日均成本 ↓</Text>
              <Text style={styles.heroCost}>
                {formatCurrency(totalAssetDailyCost)}
                <Text style={styles.heroUnit}>/天</Text>
              </Text>
              <Text style={styles.heroHint}>
                共 {activeItems.length} 件已买断 · 数字越低越回本
              </Text>
            </>
          )}
          {activeTab === 'debts' && (
            <>
              <Text style={[styles.heroSubtitle, styles.heroSubtitleDebt]}>今日固定流失</Text>
              <Text style={styles.heroCost}>
                {formatCurrency(totalDebtDailyCost)}
                <Text style={styles.heroUnit}>/天</Text>
              </Text>
              <Text style={styles.heroHint}>
                {unredeemedItems.length} 件分期 + {activeSubs.length} 个订阅
              </Text>
            </>
          )}
          {activeTab === 'stored_cards' && (
            <>
              <Text style={[styles.heroSubtitle, styles.heroSubtitleStored]}>实际沉睡本金 ↑</Text>
              <Text style={[styles.heroCost, styles.heroCostStored]}>
                {formatCurrency(totalPrincipal)}
              </Text>
              <Text style={styles.heroHintStored}>
                🚨 你共有 {formatCurrency(totalPrincipal)} 的真金白银，正押在别人手里。
              </Text>
            </>
          )}
        </View>

        {/* Tab 切换 */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assets' && styles.tabActive]}
            onPress={() => setActiveTab('assets')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'assets' && styles.tabTextActive]}>
              买断资产
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'debts' && styles.tabActiveDebt]}
            onPress={() => setActiveTab('debts')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'debts' && styles.tabTextActiveDebt]}>
              每日消耗
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'stored_cards' && styles.tabActiveStored]}
            onPress={() => setActiveTab('stored_cards')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, activeTab === 'stored_cards' && styles.tabTextActiveStored]}>
              沉睡卡包
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'assets' && archivedItems.length > 0 && (
          <TouchableOpacity
            style={styles.archiveToggle}
            onPress={() => setShowArchived(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.archiveToggleText}>
              {showArchived ? '收起' : '显示'}已隐藏（{archivedItems.length}）
            </Text>
          </TouchableOpacity>
        )}
        {activeTab === 'stored_cards' && archivedStoredCards.length > 0 && (
          <TouchableOpacity
            style={styles.archiveToggle}
            onPress={() => setShowArchivedCards(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.archiveToggleText}>
              {showArchivedCards ? '收起' : '显示'}已隐藏（{archivedStoredCards.length}）
            </Text>
          </TouchableOpacity>
        )}

        {/* 列表 */}
        {activeTab === 'assets' && (
          <SectionList
            sections={assetsSections}
            keyExtractor={(item) => `item-${item.id}`}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            renderItem={({ item }) => (
              <ItemCard
                item={item}
                onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
              />
            )}
            ListEmptyComponent={<EmptyState message="还没有资产记录" icon="📦" />}
          />
        )}
        {activeTab === 'debts' && (
          <SectionList
            sections={debtSections}
            keyExtractor={(item) => (isSubscription(item) ? `sub-${item.id}` : `item-${item.id}`)}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            renderItem={({ item }) => {
              if (isSubscription(item)) {
                return (
                  <SubscriptionCard
                    subscription={item}
                    onPress={() =>
                      navigation.navigate('SubscriptionDetail', { subscriptionId: item.id })
                    }
                  />
                );
              }
              return (
                <ItemCard
                  item={item}
                  onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
                />
              );
            }}
            ListEmptyComponent={<EmptyState message="没有分期或订阅记录" icon="💳" />}
          />
        )}
        {activeTab === 'stored_cards' && (
          <FlatList
            data={visibleStoredCards}
            keyExtractor={card => `card-${card.id}`}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <StoredCardCard
                card={item}
                onPress={() =>
                  navigation.navigate('AddEditStoredCard', { storedCardId: item.id })
                }
                onDataChanged={loadData}
              />
            )}
            ListEmptyComponent={
              <EmptyState message="还没有储值卡记录\n点击 ＋ 开始追踪你的卡包" icon="💳" />
            }
          />
        )}

        {/* 底部新增按钮 */}
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.8}
          onPress={() => {
            if (activeTab === 'assets') {
              navigation.navigate('AddEditItem');
            } else {
              setAddModalVisible(true);
            }
          }}
        >
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>

        {/* 新增弹窗 */}
        <Modal visible={addModalVisible} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={styles.modal}>
              {activeTab === 'stored_cards' ? (
                <>
                  <Text style={styles.modalTitle}>新增储值卡包</Text>
                  <Text style={styles.modalDesc}>请选择卡片类型</Text>
                  <View style={styles.modalActions}>
                    <BrutalButton
                      title="💰 储值卡"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditStoredCard', { defaultCardType: 'amount' });
                      }}
                      variant="accent"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="🔢 计次卡"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditStoredCard', { defaultCardType: 'count' });
                      }}
                      variant="primary"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="取消"
                      onPress={() => setAddModalVisible(false)}
                      variant="outline"
                      size="md"
                      style={styles.modalBtn}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>新增每日消耗</Text>
                  <Text style={styles.modalDesc}>请选择要新增的类型</Text>
                  <View style={styles.modalActions}>
                    <BrutalButton
                      title="新增分期物品"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditItem', { defaultIsInstallment: true });
                      }}
                      variant="danger"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="新增周期订阅"
                      onPress={() => {
                        setAddModalVisible(false);
                        navigation.navigate('AddEditSubscription');
                      }}
                      variant="accent"
                      size="md"
                      style={styles.modalBtn}
                    />
                    <BrutalButton
                      title="取消"
                      onPress={() => setAddModalVisible(false)}
                      variant="outline"
                      size="md"
                      style={styles.modalBtn}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* 哲学说明弹窗 */}
        <Modal visible={helpModalVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.overlay}
            onPress={() => setHelpModalVisible(false)}
            activeOpacity={1}
          >
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>这笔账怎么算？</Text>

              {/* 买断资产说明 */}
              <View style={styles.helpSection}>
                <View style={[styles.helpTag, { backgroundColor: '#00B894' }]}>
                  <Text style={styles.helpTagText}>🟩 买断资产</Text>
                </View>
                <Text style={styles.helpBody}>
                  已全款买下的物品。总价已锁定，使用天数越长，每天的平均成本越低。数字不断下降，代表你正在把好东西用到极致。
                </Text>
                <View style={styles.helpFormula}>
                  <Text style={styles.helpFormulaText}>日均成本 = (总价 − 残值) ÷ 使用天数</Text>
                </View>
              </View>

              <View style={styles.helpDivider} />

              {/* 每日消耗说明 */}
              <View style={styles.helpSection}>
                <View style={[styles.helpTag, { backgroundColor: '#E17055' }]}>
                  <Text style={styles.helpTagText}>🟥 每日消耗</Text>
                </View>
                <Text style={styles.helpBody}>
                  尚未结清的分期与持续订阅。这是你每天一睁眼就要付出的底线开销。早日还清分期，减少闲置订阅。
                </Text>
                <View style={styles.helpFormula}>
                  <Text style={styles.helpFormulaText}>日消耗 = 月供或月租 ÷ 30</Text>
                </View>
              </View>

              <View style={styles.helpDivider} />

              {/* 沉睡卡包说明 */}
              <View style={styles.helpSection}>
                <View style={[styles.helpTag, { backgroundColor: '#E6A817' }]}>
                  <Text style={styles.helpTagText}>🟨 沉睡卡包</Text>
                </View>
                <Text style={styles.helpBody}>
                  储值卡、次卡是商家向你提前收取的无息贷款。赠金/折扣让你觉得赚了，但剩余余额随时可能缩水（商家倒闭、忘记消费）。
                </Text>
                <View style={styles.helpFormula}>
                  <Text style={styles.helpFormulaText}>
                    实际沉睡本金 = 剩余面值 × (实际支付 / 总面值)
                  </Text>
                </View>
              </View>

              <BrutalButton
                title="明白了"
                onPress={() => setHelpModalVisible(false)}
                variant="primary"
                size="sm"
                style={{ marginTop: THEME.spacing.md }}
              />
            </View>
          </TouchableOpacity>
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
  },
  hero: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: THEME.spacing.xl,
    paddingTop: THEME.spacing.xl,
    paddingBottom: THEME.spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: THEME.colors.borderDark,
  },
  heroDebt: {
    backgroundColor: '#E17055',
    borderBottomColor: '#C56B4B',
  },
  heroStored: {
    backgroundColor: '#B8860B',
    borderBottomColor: '#856404',
  },
  heroTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: THEME.fontFamily.pixel,
    color: '#FFFFFF',
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconBtnText: {
    fontSize: 14,
  },
  helpBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpBtnText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: THEME.fontSize.sm,
    color: '#FFFFFFAA',
    marginBottom: 4,
    marginTop: 6,
  },
  heroSubtitleDebt: {
    color: '#FFD8CC',
  },
  heroSubtitleStored: {
    color: '#FFE89A',
  },
  heroCost: {
    fontSize: 22,
    fontFamily: THEME.fontFamily.pixel,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroCostStored: {
    color: '#FFE066',
  },
  heroUnit: {
    fontSize: THEME.fontSize.sm,
    fontFamily: undefined,
  },
  heroHint: {
    fontSize: THEME.fontSize.xs,
    color: '#FFFFFFCC',
  },
  heroHintStored: {
    fontSize: THEME.fontSize.xs,
    color: '#FFE89ACC',
    fontWeight: '700',
  },
  helpSection: {
    marginBottom: 4,
  },
  helpTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: THEME.spacing.xs,
  },
  helpTagText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  helpBody: {
    fontSize: 12,
    color: THEME.colors.textPrimary,
    lineHeight: 18,
    marginBottom: THEME.spacing.sm,
  },
  helpFormula: {
    backgroundColor: THEME.colors.background,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: THEME.colors.border,
  },
  helpFormulaText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  helpDivider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: THEME.spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  archiveToggle: {
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: THEME.spacing.sm,
  },
  archiveToggleText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  tab: {
    flex: 1,
    paddingVertical: THEME.spacing.sm + 2,
    borderRadius: THEME.borderRadius,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: THEME.colors.borderDark,
    backgroundColor: THEME.colors.primaryLight + '30',
  },
  tabActiveDebt: {
    borderColor: '#C0392B',
    backgroundColor: 'rgba(231,76,60,0.2)',
  },
  tabText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  tabTextActive: {
    color: THEME.colors.primary,
    fontWeight: '700',
  },
  tabTextActiveDebt: {
    color: '#C0392B',
    fontWeight: '700',
  },
  tabActiveStored: {
    borderColor: '#B8860B',
    backgroundColor: THEME.colors.warning + '33',
  },
  tabTextActiveStored: {
    color: '#856404',
    fontWeight: '700',
  },
  list: {
    padding: THEME.spacing.lg,
    paddingBottom: 80,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.sm,
    marginTop: THEME.spacing.md,
  },
  fab: {
    position: 'absolute',
    right: THEME.spacing.xl,
    bottom: THEME.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: THEME.colors.primary,
    borderWidth: 2,
    borderColor: THEME.colors.borderDark,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.pixelShadow,
  },
  fabText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 32,
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
    gap: THEME.spacing.sm,
  },
  modalBtn: {
    width: '100%',
  },
});
