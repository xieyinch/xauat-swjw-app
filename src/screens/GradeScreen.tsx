import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchGrades, fetchSemesters, getStudentInfoCached, rankSemesterCandidates, resolveCurrentSemester } from '../api/data';
import { FunctionShell } from '../components/FunctionShell';
import type { GradeData, Semester } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  onSessionExpired: () => void;
  /** 提供时渲染为带关闭按钮的独立页（用于「全部」页里的成绩信息入口） */
  onClose?: () => void;
}

export function GradeScreen({ onSessionExpired, onClose }: Props) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const preloadedGradesRef = useRef<{ sid: number; grades: GradeData } | null>(null);
  const [grades, setGrades] = useState<GradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSemesters = useCallback(async () => {
    try {
      const list = await fetchSemesters();
      setSemesters(list);
      const preferred = resolveCurrentSemester(list);
      if (!preferred) return;
      const info = await getStudentInfoCached();
      let chosen: Semester = preferred;
      // 默认学期若有成绩则直接用；否则自动跳到最近的「有成绩」学期，避免初次打开空白
      for (const s of rankSemesterCandidates(list, preferred.id).slice(0, 6)) {
        try {
          const data = await fetchGrades(info.studentId, s.id);
          if (data.items.length > 0) {
            preloadedGradesRef.current = { sid: s.id, grades: data };
            chosen = s;
            break;
          }
        } catch (e) {
          if ((e as Error).name === 'SessionExpiredError') {
            onSessionExpired();
            return;
          }
          // 单个学期读取失败则跳过，继续探测更近的其它学期
        }
      }
      setSemesterId(chosen.id);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
      setError((e as Error).message || '加载失败');
    }
  }, [onSessionExpired]);

  const loadGrades = useCallback(
    async (sid: number, refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const info = await getStudentInfoCached();
        const data = await fetchGrades(info.studentId, sid);
        setGrades(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '成绩加载失败');
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
    if (semesterId == null) return;
    const pre = preloadedGradesRef.current;
    if (pre && pre.sid === semesterId) {
      preloadedGradesRef.current = null;
      setError(null);
      setGrades(pre.grades);
      setLoading(false);
      return;
    }
    loadGrades(semesterId);
  }, [semesterId, loadGrades]);

  const stats = useMemo(() => {
    if (!grades || !grades.items.length) return null;
    const published = grades.items.filter((i) => i.published);
    const sumCredits = published.reduce((acc, i) => acc + (i.credits ?? 0), 0);
    const weight = published.reduce((acc, i) => acc + (i.credits ?? 0) * (i.gradePoint ?? 0), 0);
    const gpa = weight && sumCredits ? weight / sumCredits : 0;
    return { count: published.length, sumCredits, gpa: gpa.toFixed(2) };
  }, [grades]);

  const body = (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.semesterBar}>
        {semesters.slice(0, 10).map((s) => {
          const active = s.id === semesterId;
          return (
            <TouchableOpacity key={s.id} style={[styles.chip, active && styles.chipActive]} onPress={() => setSemesterId(s.id)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.nameZh}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {stats ? (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.count}</Text>
            <Text style={styles.statLabel}>课程门数</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.sumCredits}</Text>
            <Text style={styles.statLabel}>已获学分</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.gpa}</Text>
            <Text style={styles.statLabel}>学期绩点</Text>
          </View>
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
          <TouchableOpacity style={styles.retryBtn} onPress={() => (semesterId != null ? loadGrades(semesterId) : loadSemesters())}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={grades?.items ?? []}
          keyExtractor={(item, idx) => `${item.courseCode}-${idx}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => semesterId != null && loadGrades(semesterId, true)} />
          }
          renderItem={({ item }) => (
            <View style={styles.gradeCard}>
              <View style={styles.gradeMain}>
                <Text style={styles.courseName} numberOfLines={2}>{item.courseName}</Text>
                <Text style={styles.courseMeta}>
                  {item.courseCode ? `${item.courseCode} · ` : ''}
                  {item.credits != null ? `${item.credits} 学分` : ''}
                  {item.courseType ? ` · ${item.courseType}` : ''}
                </Text>
              </View>
              <View style={styles.gradeRight}>
                <Text style={[styles.score, !item.published && styles.scoreMuted]}>{item.score}</Text>
                {item.gradePoint != null ? <Text style={styles.gp}>绩点 {item.gradePoint}</Text> : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyText}>本学期暂无成绩</Text>
            </View>
          }
        />
      )}
    </View>
  );

  if (!onClose) return body;
  return (
    <FunctionShell title="成绩信息" onClose={onClose}>
      {body}
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  semesterBar: { flexGrow: 0, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  gradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gradeMain: { flex: 1, marginRight: spacing.md },
  courseName: { fontSize: 15, fontWeight: '600', color: colors.text },
  courseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  gradeRight: { alignItems: 'flex-end' },
  score: { fontSize: 20, fontWeight: '700', color: colors.primary },
  scoreMuted: { color: colors.textSecondary },
  gp: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});
