import { useThemeColors, type Palette } from '../../appearance';
import { MotionTouchableOpacity } from '../../components/MotionTouchableOpacity';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchLessonSearch, type LessonSearchPage } from '../../api/query';
import { fetchSemesters, getStudentInfoCached, resolveCurrentSemester } from '../../api/data';
import type { LessonSearchItem, Semester } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function LessonSearchScreen({ onClose, onSessionExpired }: Props) {
  const colors = useThemeColors();
  const styles = make_styles(colors);

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<LessonSearchItem[]>([]);
  const [pageInfo, setPageInfo] = useState<LessonSearchPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studentIdRef = useRef(0);
  const pageRef = useRef(1);

  // 输入防抖：停止输入 350ms 后自动发起查询
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchText), 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const loadSemesters = useCallback(async () => {
    try {
      const info = await getStudentInfoCached();
      studentIdRef.current = info.studentId;
      const list = await fetchSemesters();
      setSemesters(list);
      const current = resolveCurrentSemester(list);
      if (current) setSemesterId(current.id);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
      setError((e as Error).message || '学期加载失败');
    }
  }, [onSessionExpired]);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (semesterId == null) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      pageRef.current = 1;
      try {
        const data = await fetchLessonSearch(semesterId, studentIdRef.current, keyword || undefined, 1);
        setItems(data.items);
        setPageInfo(data.page);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '开课查询失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [semesterId, keyword, onSessionExpired],
  );

  const loadMore = useCallback(async () => {
    if (semesterId == null || loadingMore) return;
    const next = pageRef.current + 1;
    if (pageInfo != null && next > pageInfo.totalPages) return;
    setLoadingMore(true);
    try {
      const data = await fetchLessonSearch(semesterId, studentIdRef.current, keyword || undefined, next);
      pageRef.current = next;
      setItems((prev) => [...prev, ...data.items]);
      setPageInfo(data.page);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
      setError((e as Error).message || '加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  }, [semesterId, keyword, loadingMore, pageInfo, onSessionExpired]);

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (semesterId != null) load();
  }, [semesterId, load]);

  return (
    <FunctionShell title="全校开课查询" onClose={onClose}>
      <View style={styles.filters}>
        <View style={styles.semesterRow}>
          {semesters.slice(0, 8).map((s) => (
            <MotionTouchableOpacity
              key={s.id}
              style={[styles.chip, s.id === semesterId && styles.chipActive]}
              onPress={() => setSemesterId(s.id)}
            >
              <Text style={[styles.chipText, s.id === semesterId && styles.chipTextActive]}>{s.nameZh}</Text>
            </MotionTouchableOpacity>
          ))}
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="课程名称 / 代码"
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => setKeyword(searchText)}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        {pageInfo != null && items.length > 0 ? (
          <Text style={styles.countHint}>
            已显示 {items.length} 条，共 {pageInfo.totalRows} 条开课记录
          </Text>
        ) : null}
      </View>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="未找到开课记录">
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.courseName} numberOfLines={2}>{item.nameZh}</Text>
                <Text style={styles.credits}>{item.credits != null ? `${item.credits} 学分` : ''}</Text>
              </View>
              <Text style={styles.meta}>
                {[item.code, item.campus].filter(Boolean).join(' · ')}
              </Text>
              {item.classes ? <Text style={styles.meta}>教学班：{item.classes}</Text> : null}
              {item.teachers.length ? <Text style={styles.meta}>教师：{item.teachers.join('、')}</Text> : null}
              {item.scheduleText ? (
                <Text style={styles.schedule} numberOfLines={6}>{item.scheduleText}</Text>
              ) : null}
            </View>
          )}
          ListFooterComponent={
            pageInfo != null && pageRef.current < pageInfo.totalPages ? (
              <TouchableOpacity
                style={[styles.loadMoreBtn, loadingMore && styles.loadMoreDisabled]}
                onPress={loadMore}
                disabled={loadingMore}
              >
                <Text style={styles.loadMoreText}>
                  {loadingMore ? '加载中…' : `加载更多（${pageInfo.totalRows - items.length} 条）`}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </ListContainer>
    </FunctionShell>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  semesterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  countHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  credits: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  schedule: { fontSize: 12, color: colors.text, marginTop: 6, lineHeight: 18 },
  loadMoreBtn: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  loadMoreDisabled: { opacity: 0.6 },
  loadMoreText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
