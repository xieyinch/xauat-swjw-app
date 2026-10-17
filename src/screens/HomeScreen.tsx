import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchBestCourseTable, getStudentInfoCached } from '../api/data';
import { inWeek } from '../api/parsers';
import type { CourseLesson, StudentInfo } from '../types';
import { colors, spacing } from '../theme';
import { refreshCourseWidget } from '../widget/courseWidget';
import { dominantCampus, lessonTimeRange } from '../widget/classTimes';

interface Props {
  user: { stdNo: string; name: string } | null;
  onNavigate: (key: string) => void;
  onSessionExpired: () => void;
  onLogout: () => void;
}

const ENTRIES = [
  { key: 'sports', label: '体育馆预约', icon: 'basketball-outline', color: '#F97316' },
  { key: 'library-reserve', label: '图书馆预约', icon: 'library-outline', color: '#0A66C2' },
  { key: 'my-library', label: '我的图书馆', icon: 'book-outline', color: '#12B76A' },
];
const WEEK_LABELS: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' };

export function HomeScreen({ user, onNavigate, onSessionExpired, onLogout }: Props) {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [semesterName, setSemesterName] = useState('');
  const [semesterLessons, setSemesterLessons] = useState<CourseLesson[]>([]);
  const [todayLessons, setTodayLessons] = useState<CourseLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [best, info] = await Promise.all([fetchBestCourseTable(), getStudentInfoCached()]);
      setStudent(info);
      setSemesterName(best?.semester.nameZh ?? '');
      const table = best?.table ?? null;
      if (table) {
        refreshCourseWidget(table);
        setSemesterLessons(table.lessons);
        const day = new Date().getDay() === 0 ? 7 : new Date().getDay();
        setTodayLessons(table.lessons.filter((l) => l.dayOfWeek === day && inWeek(l.weekText, Math.max(1, table.currentWeek))));
      } else {
        setSemesterLessons([]);
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

  useEffect(() => { load(); }, [load]);
  const todayIndex = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);
  const todayDate = new Date();
  const fallbackCampus = dominantCampus(semesterLessons);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.studentCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{student?.name?.[0] || user?.name?.[0] || '学'}</Text></View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{student?.name || user?.name || '同学'}</Text>
          <Text style={styles.studentMeta}>{student?.stdNo || user?.stdNo || '学号未知'}{semesterName ? ` · ${semesterName}` : ''}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.entryGrid}>
        {ENTRIES.map((entry) => (
          <TouchableOpacity key={entry.key} style={styles.entry} onPress={() => onNavigate(entry.key)} activeOpacity={0.7}>
            <View style={[styles.entryIcon, { backgroundColor: `${entry.color}1A` }]}>
              <Ionicons name={entry.icon as keyof typeof Ionicons.glyphMap} size={26} color={entry.color} />
            </View>
            <Text style={styles.entryLabel}>{entry.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>今日课程</Text>
          <Text style={styles.sectionSub}>{WEEK_LABELS[todayIndex]}</Text>
        </View>
        {loading ? (
          <View style={styles.sectionCenter}><ActivityIndicator color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.sectionCenter}>
            <Text style={styles.sectionEmpty}>{error}</Text>
            <TouchableOpacity onPress={load}><Text style={styles.retryText}>重试</Text></TouchableOpacity>
          </View>
        ) : todayLessons.length ? (
          todayLessons.slice().sort((a, b) => (a.startUnit ?? 99) - (b.startUnit ?? 99)).map((lesson) => {
            const range = lessonTimeRange(lesson, fallbackCampus, todayDate);
            const timeLabel = range ? `${range.start}–${range.end}` : lesson.timeText;
            return (
              <View key={lesson.id} style={styles.lessonCard}>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeBadgeText}>{range?.start ?? (lesson.startUnit ? `第${lesson.startUnit}节` : '时间')}</Text>
                </View>
                <View style={styles.lessonBody}>
                  <Text style={styles.lessonName} numberOfLines={2}>{lesson.nameZh}</Text>
                  <Text style={styles.lessonMeta}>{timeLabel}{lesson.placeText ? ` · ${lesson.placeText}` : ''}</Text>
                </View>
              </View>
            );
          })
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
  studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainer, borderRadius: 16, padding: spacing.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 17, fontWeight: '700', color: colors.text },
  studentMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  logoutBtn: { padding: spacing.sm },
  entryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  entry: { width: '47%', flexGrow: 1, backgroundColor: colors.surfaceContainer, borderRadius: 14, paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  entryIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  entryLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  sectionSub: { fontSize: 13, color: colors.textSecondary },
  sectionCenter: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  sectionEmpty: { fontSize: 13, color: colors.textSecondary },
  retryText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  lessonCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainer, borderRadius: 12, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  timeBadge: { minWidth: 58, minHeight: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, paddingHorizontal: 4 },
  timeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  lessonBody: { flex: 1 },
  lessonName: { fontSize: 14, fontWeight: '600', color: colors.text },
  lessonMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
});
