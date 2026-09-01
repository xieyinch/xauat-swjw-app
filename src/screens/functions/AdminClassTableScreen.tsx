import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchAdminClassTable } from '../../api/query';
import { fetchSemesters, getStudentInfoCached, resolveCurrentSemester } from '../../api/data';
import type { AdminClassCourse, Semester } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function AdminClassTableScreen({ onClose, onSessionExpired }: Props) {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [data, setData] = useState<{ className: string; courses: AdminClassCourse[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState(0);

  const loadSemesters = useCallback(async () => {
    try {
      const info = await getStudentInfoCached();
      setStudentId(info.studentId);
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
      if (semesterId == null || !studentId) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await fetchAdminClassTable(semesterId, studentId);
        setData({ className: result.className, courses: result.courses });
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '班级课表加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [semesterId, studentId, onSessionExpired],
  );

  useEffect(() => {
    loadSemesters();
  }, [loadSemesters]);

  useEffect(() => {
    if (semesterId != null) load();
  }, [semesterId, load]);

  return (
    <FunctionShell title="我的班级课表" onClose={onClose}>
      <View style={styles.semesterBar}>
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
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无班级课表">
        {data?.className ? <Text style={styles.classTitle}>{data.className} 班级课表</Text> : null}
        <FlatList
          data={data?.courses ?? []}
          keyExtractor={(item, idx) => `${item.courseCode}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.courseName} numberOfLines={1}>{item.courseName}</Text>
              <Text style={styles.meta}>{item.courseCode} · {item.credits != null ? `${item.credits} 学分` : ''} · {item.courseType}</Text>
              {item.teachers.length ? <Text style={styles.meta}>教师：{item.teachers.join('、')}</Text> : null}
              <Text style={styles.schedule} numberOfLines={3}>{item.scheduleText}</Text>
            </View>
          )}
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  semesterBar: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  classTitle: { fontSize: 14, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  courseName: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  schedule: { fontSize: 12, color: colors.text, marginTop: 6, lineHeight: 18 },
});
