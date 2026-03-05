import React, { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types';
import { initDB } from '../database';
import { useCategories } from '../contexts/CategoriesContext';
import { BrutalButton } from '../components';
import { THEME } from '../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/YourUsername/DayValue/releases/latest';
const GITHUB_RELEASES_PAGE_URL = 'https://github.com/YourUsername/DayValue/releases';

type GitHubReleaseResponse = {
  tag_name?: string;
  html_url?: string;
  assets?: Array<{
    browser_download_url?: string;
  }>;
};

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function parseSemverParts(version: string): [number, number, number] {
  const clean = normalizeVersion(version);
  const parts = clean.split('.');
  const major = Number.parseInt(parts[0]?.match(/\d+/)?.[0] ?? '0', 10);
  const minor = Number.parseInt(parts[1]?.match(/\d+/)?.[0] ?? '0', 10);
  const patch = Number.parseInt(parts[2]?.match(/\d+/)?.[0] ?? '0', 10);
  return [
    Number.isFinite(major) ? major : 0,
    Number.isFinite(minor) ? minor : 0,
    Number.isFinite(patch) ? patch : 0,
  ];
}

function compareSemver(a: string, b: string): number {
  const [a1, a2, a3] = parseSemverParts(a);
  const [b1, b2, b3] = parseSemverParts(b);
  if (a1 !== b1) return a1 > b1 ? 1 : -1;
  if (a2 !== b2) return a2 > b2 ? 1 : -1;
  if (a3 !== b3) return a3 > b3 ? 1 : -1;
  return 0;
}

function pickApkDownloadUrl(release: GitHubReleaseResponse): string | null {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apk = assets.find(a => {
    const url = a?.browser_download_url;
    return typeof url === 'string' && url.toLowerCase().endsWith('.apk');
  });
  return typeof apk?.browser_download_url === 'string' ? apk.browser_download_url : null;
}

function BrutalCard({
  title,
  titleColor,
  children,
}: {
  title: string;
  titleColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.cardWrap}>
      <View style={styles.cardShadow} pointerEvents="none" />
      <View style={styles.card}>
        <View style={[styles.cardHeader, { backgroundColor: titleColor }]}>
          <Text style={styles.cardHeaderText}>{title}</Text>
        </View>
        <View style={styles.cardBody}>{children}</View>
      </View>
    </View>
  );
}

function SettingRow({
  title,
  value,
  onPress,
  showChevron = true,
  last = false,
  danger = false,
}: {
  title: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  last?: boolean;
  danger?: boolean;
}) {
  const clickable = typeof onPress === 'function';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!clickable}
      activeOpacity={0.75}
      style={[styles.row, last && styles.rowLast]}
    >
      <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {clickable && showChevron ? <Text style={styles.rowChevron}>›</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const { refreshCategories } = useCategories();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [resetting, setResetting] = useState(false);

  const currentVersion = useMemo(() => {
    const v = Constants.expoConfig?.version;
    return typeof v === 'string' && v.trim() ? v.trim() : '0.0.0';
  }, []);

  async function openExternalUrl(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('无法打开链接', '请复制链接并在浏览器中打开：\n' + url);
    }
  }

  async function handleCheckUpdate() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const resp = await fetch(GITHUB_LATEST_RELEASE_URL, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = (await resp.json()) as GitHubReleaseResponse;
      const latestTag = typeof json.tag_name === 'string' ? json.tag_name : '';
      if (!latestTag) {
        throw new Error('missing tag_name');
      }

      const cmp = compareSemver(latestTag, currentVersion);
      if (cmp <= 0) {
        Alert.alert('已是最新版', `当前版本 ${currentVersion} 已是最新。`);
        return;
      }

      const apkUrl = pickApkDownloadUrl(json);
      if (!apkUrl) {
        Alert.alert(
          '发现新版本',
          `最新版本：${latestTag}\n未找到可下载的 APK 资源，请前往 GitHub Releases 页面手动下载。`,
          [
            { text: '取消', style: 'cancel' },
            {
              text: '打开 GitHub',
              onPress: () => openExternalUrl(json.html_url ?? GITHUB_RELEASES_PAGE_URL),
            },
          ],
        );
        return;
      }

      Alert.alert(
        '发现新版本',
        `最新版本：${latestTag}\n是否立即打开浏览器下载安装包？`,
        [
          { text: '取消', style: 'cancel' },
          { text: '下载 APK', onPress: () => openExternalUrl(apkUrl) },
        ],
      );
    } catch {
      Alert.alert(
        '检查更新失败',
        '网络异常或 GitHub 接口不可用，请前往 GitHub Releases 页面手动下载最新版本。',
        [
          { text: '取消', style: 'cancel' },
          { text: '打开 GitHub', onPress: () => openExternalUrl(GITHUB_RELEASES_PAGE_URL) },
        ],
      );
    } finally {
      setCheckingUpdate(false);
    }
  }

  function confirmResetAllData() {
    if (resetting) return;
    Alert.alert(
      '警告：请确认',
      '警告：这将永久删除您的所有资产、分期、订阅和储值卡记录。此操作不可逆！',
      [
        { text: '取消', style: 'cancel' },
        { text: '我已了解，继续删除', style: 'destructive', onPress: () => void resetAllData() },
      ],
    );
  }

  async function resetAllData() {
    if (resetting) return;
    setResetting(true);
    try {
      await db.execAsync(`
        DROP TABLE IF EXISTS OneTimeItems;
        DROP TABLE IF EXISTS Subscriptions;
        DROP TABLE IF EXISTS StoredCards;
        DROP TABLE IF EXISTS Categories;
        DROP TABLE IF EXISTS one_time_items;
        DROP TABLE IF EXISTS subscriptions;
        DROP TABLE IF EXISTS stored_cards;
        DROP TABLE IF EXISTS _meta;
        PRAGMA user_version = 0;
      `);

      await initDB(db);
      await refreshCategories();

      Alert.alert('已初始化', '已清除所有数据，并恢复示例配置。', [
        { text: '好的', onPress: () => navigation.popToTop() },
      ]);
    } catch {
      Alert.alert('清除失败', '清除数据时发生错误，请重试。');
    } finally {
      setResetting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <BrutalCard title="常规设置" titleColor={THEME.colors.primary}>
          <SettingRow title="分类管理" onPress={() => navigation.navigate('Categories')} />
          <SettingRow title="语言设置" value="简体中文" showChevron={false} />
          <SettingRow title="当前版本" value={currentVersion} showChevron={false} last />
        </BrutalCard>

        <BrutalCard title="版本更新" titleColor={THEME.colors.accent}>
          <BrutalButton
            title="检查更新"
            onPress={handleCheckUpdate}
            variant="accent"
            loading={checkingUpdate}
            disabled={checkingUpdate || resetting}
            style={{ width: '100%' }}
          />
        </BrutalCard>

        <BrutalCard title="危险区" titleColor={THEME.colors.dangerDark}>
          <Text style={styles.dangerHint}>清除后将恢复到首次启动时的示例数据状态。</Text>
          <BrutalButton
            title="⚠️ 清除所有数据"
            onPress={confirmResetAllData}
            variant="danger"
            loading={resetting}
            disabled={resetting || checkingUpdate}
            style={{ width: '100%' }}
          />
        </BrutalCard>
      </ScrollView>
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
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.xl,
    paddingBottom: 40,
    gap: THEME.spacing.xl,
  },
  cardWrap: {
    paddingRight: 4,
    paddingBottom: 4,
  },
  cardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    borderRadius: THEME.borderRadius,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: THEME.borderRadius,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  cardHeaderText: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  cardBody: {
    paddingHorizontal: THEME.spacing.lg,
    paddingVertical: THEME.spacing.md,
    gap: THEME.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: THEME.colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTitle: {
    fontSize: THEME.fontSize.md,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  rowTitleDanger: {
    color: THEME.colors.dangerDark,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: THEME.fontSize.sm,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  rowChevron: {
    fontSize: 20,
    fontWeight: '900',
    color: THEME.colors.textLight,
    marginLeft: 4,
    marginTop: -1,
  },
  dangerHint: {
    fontSize: THEME.fontSize.sm,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
});

