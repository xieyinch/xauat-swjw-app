import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchLessonSearch } from '../../api/query';
import { fetchSemesters, getStudentInfoCached, resolveCurrentSemester } from '../../api/data';
import type { LessonSearchItem, Semester } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function LessonSearchScreen({ onClose, onSessionExpired }: Props) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<LessonSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const studentIdRef = useRef(0);

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
      try {
        const data = await fetchLessonSearch(semesterId, studentIdRef.current, keyword || undefined);
        setItems(data);
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
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, s.id === semesterId && styles.chipActive]}
              onPress={() => setSemesterId(s.id)}
            >
              <Text style={[styles.chipText, s.id === semesterId && styles.chipTextActive]}>{s.nameZh}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="课程名称 / 代码"
            placeholderTextColor={colors.textSecondary}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={() => load()}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
      </View>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="未找到开课记录">
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.courseName} numberOfLines={1}>{item.nameZh}</Text>
                <Text style={styles.credits}>{item.credits != null ? `${item.credits} 学分` : ''}</Text>
              </View>
              <Text style={styles.meta}>{item.code}</Text>
              {item.classes ? <Text style={styles.meta}>教学班：{item.classes}</Text> : null}
              {item.teachers.length ? <Text style={styles.meta}>教师：{item.teachers.join('、')}</Text> : null}
              <Text style={styles.schedule} numberOfLines={3}>{item.scheduleText} {item.placeText}</Text>
            </View>
          )}
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
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
});
