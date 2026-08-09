import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchCourseTable, fetchSemesters, getStudentInfoCached, resolveCurrentSemester } from '../api/data';
import { inWeek } from '../api/parsers';
import type { CourseLesson, StudentInfo } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  user: { stdNo: string; name: string } | null;
  onNavigate: (key: string) => void;
  onSessionExpired: () => void;
  onLogout: () => void;
}

const ENTRIES = [
  { key: 'schedule', label: '我的课表', icon: 'calendar-outline', color: '#0A66C2' },
  { key: 'grade', label: '成绩查询', icon: 'school-outline', color: '#12B76A' },
  { key: 'exam', label: '考试安排', icon: 'time-outline', color: '#F59E0B' },
  { key: 'notice', label: '通知公告', icon: 'notifications-outline', color: '#7C5CFC' },
  { key: 'sports', label: '体育馆预约', icon: 'basketball-outline', color: '#F97316' },
];

const WEEK_LABELS: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
};

export function HomeScreen({ user, onNavigate, onSessionExpired, onLogout }: Props) {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [semesterName, setSemesterName] = useState('');
  const [todayLessons, setTodayLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [semesters, info] = await Promise.all([fetchSemesters(), getStudentInfoCached()]);
      setStudent(info);
      const current = resolveCurrentSemester(semesters);
      setSemesterName(current?.nameZh ?? '');
      if (current) {
        const table = await fetchCourseTable(current.id);
        const day = new Date().getDay() === 0 ? 7 : new Date().getDay();
        setTodayLessons(
          table.lessons.filter(
            (l) => l.dayOfWeek === day && inWeek(l.weekText, Math.max(1, table.currentWeek)),
          ),
        );
      } else {
        setTodayLessons([]);
      }
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
      setError((e as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  const todayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.studentCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{student?.name?.[0] || user?.name?.[0] || '学'}</Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student?.name || user?.name || '同学'}</Text>
          <Text style={styles.studentMeta}>
            {student?.stdNo || user?.stdNo || '学号未知'}
            {semesterName ? ` · ${semesterName}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.entryGrid}>
        {ENTRIES.map((e) => (
          <TouchableOpacity key={e.key} style={styles.entry} onPress={() => onNavigate(e.key)} activeOpacity={0.7}>
            <View style={[styles.entryIcon, { backgroundColor: `${e.color}1A` }]}>
              <Ionicons name={e.icon as keyof typeof Ionicons.glyphMap} size={26} color={e.color} />
            </View>
            <Text style={styles.entryLabel}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>今日课程</Text>
          <Text style={styles.sectionSub}>{WEEK_LABELS[todayIndex]}</Text>
        </View>

        {loading ? (
          <View style={styles.sectionCenter}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.sectionCenter}>
            <Text style={styles.sectionEmpty}>{error}</Text>
            <TouchableOpacity onPress={load}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : todayLessons.length ? (
          todayLessons
            .slice()
            .sort((a, b) => (a.startUnit ?? 99) - (b.startUnit ?? 99))
            .map((l) => (
              <View key={l.id} style={styles.lessonCard}>
                <View style={styles.unitBadge}>
                  <Text style={styles.unitText}>{l.startUnit ?? '?'}</Text>
                </View>
                <View style={styles.lessonBody}>
                  <Text style={styles.lessonName} numberOfLines={2}>{l.nameZh}</Text>
                  <Text style={styles.lessonMeta}>
                    {l.timeText}
                    {l.placeText ? ` · ${l.placeText}` : ''}
                  </Text>
                </View>
              </View>
            ))
        ) : (
          <View style={styles.sectionCenter}>
            <Ionicons name="happy-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.sectionEmpty}>今天没课，好好休息</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 17, fontWeight: '700', color: colors.text },
  studentMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  logoutBtn: { padding: spacing.sm },
  entryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  entry: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  entryIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  entryLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionSub: { fontSize: 13, color: colors.textSecondary },
  sectionCenter: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  sectionEmpty: { fontSize: 13, color: colors.textSecondary },
  retryText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  lessonCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
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
  lessonName: { fontSize: 14, fontWeight: '600', color: colors.text },
  lessonMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
});
