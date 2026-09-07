import { useThemeColors, type Palette } from '../appearance';
import { GlassSurface } from '../components/Glass';
import { MotionTouchableOpacity } from '../components/MotionTouchableOpacity';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

const make_QUICK_ENTRIES = (colors: Palette) => [
  { key: 'schedule', label: '我的课表', icon: 'calendar-outline', color: colors.primary },
  { key: 'grade', label: '成绩信息', icon: 'school-outline', color: colors.gold },
  { key: 'exam', label: '考试信息', icon: 'time-outline', color: colors.terracotta },
  { key: 'notices', label: '通知公告', icon: 'notifications-outline', color: colors.primaryDark },
];

export function AllScreen({ onOpenFunction, onOpenNotices, onNavigateTab, onSessionExpired }: Props) {
  const colors = useThemeColors();
  const QUICK_ENTRIES = make_QUICK_ENTRIES(colors);
  const styles = make_styles(colors);

  const [categories, setCategories] = useState<MenuCategory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');

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

  const renderItem = useCallback(
    ({ item }: { item: MenuCategory }) => (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={categoryMeta(item.title).icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>{item.title}</Text>
          <Text style={styles.sectionCount}>{item.functions.length}</Text>
        </View>
        <View style={styles.grid}>
          {item.functions.map((fn) => {
            const meta = metaFor(fn);
            return (
              <MotionTouchableOpacity
                key={fn.id}
                style={styles.fnCard}
                activeOpacity={0.7}
                onPress={() => onOpenFunction(fn)}
              >
                <View style={[styles.fnIcon, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={24} color={colors.primary} />
                </View>
                <Text style={styles.fnLabel} numberOfLines={2}>{fn.title}</Text>
              </MotionTouchableOpacity>
            );
          })}
        </View>
      </View>
    ),
    [onOpenFunction],
  );

  return (
    <View style={styles.container}>
      <GlassSurface style={styles.searchBar}>
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
          <MotionTouchableOpacity onPress={() => setKeyword('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </MotionTouchableOpacity>
        ) : null}
      </GlassSurface>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && !categories ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <MotionTouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>重试</Text>
          </MotionTouchableOpacity>
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
                    <MotionTouchableOpacity key={q.key} style={styles.quickCard} activeOpacity={0.7} onPress={() => handleQuick(q.key)}>
                      <View style={[styles.fnIcon, { backgroundColor: `${q.color}1A` }]}>
                        <Ionicons name={q.icon as keyof typeof Ionicons.glyphMap} size={24} color={q.color} />
                      </View>
                      <Text style={styles.fnLabel} numberOfLines={2}>{q.label}</Text>
                    </MotionTouchableOpacity>
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
        />
      )}
    </View>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceContainer,
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
  fnCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.primaryBorder, paddingVertical: 14, width: '47%', flexGrow: 1, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  quickCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.primaryBorder, paddingVertical: 12, width: '47%', flexGrow: 1, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  fnIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  fnLabel: { fontSize: 12, color: colors.text, textAlign: 'center' },
  searchResult: { fontSize: 12, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});
