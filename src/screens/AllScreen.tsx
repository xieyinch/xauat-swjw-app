import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureAllPages } from '../api/capture';
import { fetchMenu } from '../api/data';
import { FALLBACK_MENU, categoryMeta, metaFor } from '../config/functions';
import type { MenuCategory, MenuFunction } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  onOpenFunction: (fn: MenuFunction) => void;
  onOpenNotices: () => void;
  onNavigateTab: (key: string) => void;
  onSessionExpired: () => void;
}

const QUICK_ENTRIES = [
  { key: 'schedule', label: '我的课表', icon: 'calendar-outline', color: '#0A66C2' },
  { key: 'grade', label: '成绩信息', icon: 'school-outline', color: '#12B76A' },
  { key: 'exam', label: '考试信息', icon: 'time-outline', color: '#F59E0B' },
  { key: 'notices', label: '通知公告', icon: 'notifications-outline', color: '#EF4444' },
];

export function AllScreen({ onOpenFunction, onOpenNotices, onNavigateTab, onSessionExpired }: Props) {
  const [categories, setCategories] = useState<MenuCategory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<{ done: number; total: number; title: string } | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchMenu();
        setCategories(list.length ? list : FALLBACK_MENU);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setCategories(FALLBACK_MENU);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onSessionExpired],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return categories ?? [];
    return (categories ?? [])
      .map((cat) => ({
        ...cat,
        functions: cat.functions.filter((f) => f.title.includes(kw)),
      }))
      .filter((cat) => cat.functions.length > 0);
  }, [categories, keyword]);

  const totalCount = useMemo(() => (categories ?? []).reduce((n, c) => n + c.functions.length, 0), [categories]);

  const handleQuick = useCallback((key: string) => {
    if (key === 'notices') onOpenNotices();
    else onNavigateTab(key);
  }, [onOpenNotices, onNavigateTab]);

  const handleCapture = useCallback(async () => {
    if (capturing || !categories) return;
    setCapturing(true);
    setCaptureProgress({ done: 0, total: 0, title: '' });
    try {
      const result = await captureAllPages(categories, (done, total, title) =>
        setCaptureProgress({ done, total, title }),
      );
      setCaptureProgress(null);
      setCapturing(false);
      if (result.ok === 0) {
        Alert.alert('采集失败', '未获取到任何页面，请确认已登录后再试。');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.fileUri, {
          mimeType: 'application/json',
          dialogTitle: '导出教务页面数据',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('采集完成', `已生成 ${result.fileUri}（成功 ${result.ok} / 失败 ${result.failed}）`);
      }
    } catch (e) {
      setCaptureProgress(null);
      setCapturing(false);
      Alert.alert('采集出错', String((e as Error).message || e));
    }
  }, [capturing, categories]);

  const renderItem = useCallback(
    ({ item }: { item: MenuCategory }) => (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={categoryMeta(item.title).icon as keyof typeof Ionicons.glyphMap} size={18} color={categoryMeta(item.title).color} />
          <Text style={styles.sectionTitle}>{item.title}</Text>
          <Text style={styles.sectionCount}>{item.functions.length}</Text>
        </View>
        <View style={styles.grid}>
          {item.functions.map((fn) => {
            const meta = metaFor(fn);
            return (
              <TouchableOpacity
                key={fn.id}
                style={styles.fnCard}
                activeOpacity={0.7}
                onPress={() => onOpenFunction(fn)}
              >
                <View style={[styles.fnIcon, { backgroundColor: `${meta.color}1A` }]}>
                  <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={24} color={meta.color} />
                </View>
                <Text style={styles.fnLabel} numberOfLines={2}>{fn.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    ),
    [onOpenFunction],
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索全部功能"
          placeholderTextColor={colors.textSecondary}
          value={keyword}
          onChangeText={setKeyword}
          autoCorrect={false}
        />
        {keyword ? (
          <TouchableOpacity onPress={() => setKeyword('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && !categories ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={
            <View>
              <View style={styles.quickSection}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="star" size={18} color={colors.warning} />
                  <Text style={styles.sectionTitle}>常用功能</Text>
                </View>
                <View style={styles.quickGrid}>
                  {QUICK_ENTRIES.map((q) => (
                    <TouchableOpacity key={q.key} style={styles.quickCard} activeOpacity={0.7} onPress={() => handleQuick(q.key)}>
                      <View style={[styles.fnIcon, { backgroundColor: `${q.color}1A` }]}>
                        <Ionicons name={q.icon as keyof typeof Ionicons.glyphMap} size={24} color={q.color} />
                      </View>
                      <Text style={styles.fnLabel} numberOfLines={2}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {keyword ? (
                <Text style={styles.searchResult}>搜索到 {filtered.reduce((n, c) => n + c.functions.length, 0)} 个功能</Text>
              ) : (
                <Text style={styles.searchResult}>共 {totalCount} 个功能</Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="search-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyText}>未找到相关功能</Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {capturing ? (
                <View style={styles.captureBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.captureText} numberOfLines={1}>
                    {captureProgress?.title ?? '准备中…'}（{captureProgress?.done ?? 0}/{captureProgress?.total ?? 0}）
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureEntry}
                  onPress={handleCapture}
                  disabled={!categories}
                >
                  <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.captureEntryText}>导出页面数据（供原生重构）</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  quickSection: { paddingTop: spacing.sm },
  section: { marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 },
  sectionCount: { fontSize: 12, color: colors.textSecondary },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md },
  fnCard: { width: '31%', flexGrow: 1, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  quickCard: { width: '23%', flexGrow: 1, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  fnIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fnLabel: { fontSize: 12, color: colors.text, textAlign: 'center' },
  searchResult: { fontSize: 12, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  captureEntry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm },
  captureEntryText: { fontSize: 12, color: colors.textSecondary },
  captureBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.surface,
    maxWidth: '100%',
  },
  captureText: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
});
