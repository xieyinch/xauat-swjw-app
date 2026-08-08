import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchCourseTable, fetchSemesters, resolveCurrentSemester } from '../api/data';
import { inWeek } from '../api/parsers';
import type { CourseLesson, CourseTableData, Semester } from '../types';
import { colors, spacing } from '../theme';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

interface Props {
  onSessionExpired: () => void;
}

export function CourseTableScreen({ onSessionExpired }: Props) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [table, setTable] = useState<CourseTableData | null>(null);
  const [week, setWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSemesters = useCallback(async () => {
    try {
      const list = await fetchSemesters();
      setSemesters(list);
      const current = resolveCurrentSemester(list);
      if (current) setSemesterId(current.id);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
      setError((e as Error).message || '加载失败');
    }
  }, [onSessionExpired]);

  const loadTable = useCallback(
    async (sid: number, refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchCourseTable(sid);
        setTable(data);
        setWeek((w) => (w > (data.totalWeeks || 1) ? 1 : w || 1));
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '课表加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onSessionExpired],
  );

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (semesterId != null) {
      loadTable(semesterId);
    }
  }, [semesterId, loadTable]);

  const lessonsByDay = useMemo(() => {
    if (!table) return [];
    const days: CourseLesson[][] = WEEK_LABELS.map(() => []);
    for (const lesson of table.lessons) {
      const day = lesson.dayOfWeek ?? 0;
      if (day >= 1 && day <= 7 && inWeek(lesson.weekText, week)) {
        days[day - 1].push(lesson);
      }
    }
    return days;
  }, [table, week]);

  const currentSemesterName = semesters.find((s) => s.id === semesterId)?.nameZh ?? '';

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.semesterBar}>
        {semesters.slice(0, 8).map((s) => {
          const active = s.id === semesterId;
          return (
            <TouchableOpacity
              key={s.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSemesterId(s.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.nameZh}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {table ? (
        <View style={styles.weekBar}>
          <TouchableOpacity style={styles.weekBtn} onPress={() => setWeek((w) => Math.max(1, w - 1))} disabled={week <= 1}>
            <Ionicons name="chevron-back" size={20} color={week <= 1 ? colors.border : colors.primary} />
          </TouchableOpacity>
          <View style={styles.weekInfo}>
            <Text style={styles.weekText}>第 {week} 周</Text>
            <Text style={styles.weekTotal}>共 {table.totalWeeks} 周 · 当前第 {table.currentWeek} 周</Text>
          </View>
          <TouchableOpacity
            style={styles.weekBtn}
            onPress={() => setWeek((w) => Math.min(table.totalWeeks, w + 1))}
            disabled={week >= table.totalWeeks}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={week >= table.totalWeeks ? colors.border : colors.primary}
            />
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => (semesterId != null ? loadTable(semesterId) : loadSemesters())}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={WEEK_LABELS.map((label, idx) => ({ label, day: idx + 1 }))}
          keyExtractor={(item) => String(item.day)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => semesterId != null && loadTable(semesterId, true)} />}
          ListHeaderComponent={
            currentSemesterName ? <Text style={styles.semesterName}>{currentSemesterName}</Text> : null
          }
          renderItem={({ item }) => {
            const lessons = lessonsByDay[item.day - 1];
            if (!lessons.length) return null;
            return (
              <View style={styles.dayBlock}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayLabel}>{item.label}</Text>
                  <Text style={styles.dayCount}>{lessons.length} 节</Text>
                </View>
                {lessons
                  .slice()
                  .sort((a, b) => (a.startUnit ?? 99) - (b.startUnit ?? 99))
                  .map((lesson) => (
                    <View key={lesson.id} style={styles.lessonCard}>
                      <View style={styles.unitBadge}>
                        <Text style={styles.unitText}>{lesson.startUnit ?? '?'}</Text>
                      </View>
                      <View style={styles.lessonBody}>
                        <Text style={styles.lessonName} numberOfLines={2}>
                          {lesson.nameZh}
                        </Text>
                        <Text style={styles.lessonMeta}>
                          {lesson.timeText}
                          {lesson.weekText ? ` · ${lesson.weekText}` : ''}
                        </Text>
                        {lesson.placeText ? (
                          <Text style={styles.lessonMeta}>
                            <Ionicons name="location-outline" size={12} color={colors.textSecondary} /> {lesson.placeText}
                          </Text>
                        ) : null}
                        {lesson.teacher ? <Text style={styles.lessonMeta}>教师：{lesson.teacher}</Text> : null}
                      </View>
                    </View>
                  ))}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-clear-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyText}>本周末排课</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  semesterBar: { flexGrow: 0, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  weekBtn: { padding: spacing.sm },
  weekInfo: { flex: 1, alignItems: 'center' },
  weekText: { fontSize: 16, fontWeight: '700', color: colors.text },
  weekTotal: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  semesterName: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  dayBlock: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  dayCount: { fontSize: 12, color: colors.textSecondary },
  lessonCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  unitBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  unitText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  lessonBody: { flex: 1 },
  lessonName: { fontSize: 15, fontWeight: '600', color: colors.text },
  lessonMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});
