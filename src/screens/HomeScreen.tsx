import { nextCourseDay, todaySchedule } from '../api/schedule';
import { useThemeColors, type Palette } from '../appearance';
import { useSchoolDay } from '../hooks/useSchoolDay';
import { GlassSurface } from '../components/Glass';
import { MotionTouchableOpacity } from '../components/MotionTouchableOpacity';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchCourseTable, fetchSemesters, getStudentInfoCached, resolveCurrentSemester } from '../api/data';
import { inWeek } from '../api/parsers';
import type { CourseLesson, StudentInfo } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  user: { stdNo: string; name: string } | null;
  onNavigate: (key: string) => void;
  onSessionExpired: () => void;
  /** 兼容现有入口；退出操作统一保留在全局顶栏，避免首页重复。 */
  onLogout?: () => void;
}

const make_ENTRIES = (colors: Palette) => [
  { key: 'sports', label: '体育馆', detail: '场地预约', icon: 'basketball-outline', color: colors.terracotta, tint: colors.terracottaSoft },
  { key: 'library-reserve', label: '图书馆', detail: '座位预约', icon: 'library-outline', color: colors.primary, tint: colors.primarySoft },
  { key: 'my-library', label: '我的借阅', detail: '借阅记录', icon: 'book-outline', color: colors.success, tint: colors.successSoft },
];

const WEEK_LABELS: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日',
};

const make_COURSE_ACCENTS = (colors: Palette) => [colors.primary, colors.terracotta, colors.gold];

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function HomeScreen({ user, onNavigate, onSessionExpired }: Props) {
  const colors = useThemeColors();
  const ENTRIES = make_ENTRIES(colors);
  const COURSE_ACCENTS = make_COURSE_ACCENTS(colors);
  const styles = make_styles(colors);

  const schoolDay = useSchoolDay();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [semesterName, setSemesterName] = useState('');
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [todayLessons, setTodayLessons] = useState<CourseLesson[]>([]);
  const [scheduleHint, setScheduleHint] = useState('');
  const [next, setNext] = useState<ReturnType<typeof nextCourseDay>>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRevision = useRef(0);

  const load = useCallback(async () => {
    const revision = ++requestRevision.current;
    setLoading(true);
    setError(null);
    try {
      const semesters = await fetchSemesters();
      if(revision !== requestRevision.current) return;
      getStudentInfoCached().then(setStudent).catch(() => {});
      const current = resolveCurrentSemester(semesters);
      if (!current) throw new Error('当前学期尚未发布，请稍后刷新课表');
      setSemesterName(current.nameZh);
      if (current) {
        const table = await fetchCourseTable(current.id);
        if(revision !== requestRevision.current) return;
        const actual = todaySchedule(table, schoolDay);
        setCurrentWeek(actual.week);
        setTodayLessons(actual.lessons);
        setNext(nextCourseDay(table, schoolDay));
        setScheduleHint(!actual.week ? '当前教学周尚未确认，请查看学校课表。' : actual.unparsed.length ? `有 ${actual.unparsed.length} 条安排未完整识别，请核对课表。` : `${schoolDay} · 第 ${actual.week} 周 · ${WEEK_LABELS[actual.day]} · 与课表同源`);
      } else {
        setCurrentWeek(null);
        setTodayLessons([]);
      }
    } catch (caught) {
      if(revision !== requestRevision.current) return;
      if ((caught as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
      setError((caught as Error).message || '加载失败');
    } finally {
      if(revision === requestRevision.current) setLoading(false);
    }
  }, [onSessionExpired, schoolDay]);

  useEffect(() => { load(); return () => { requestRevision.current++; }; }, [load]);
  useEffect(() => { const sub=AppState.addEventListener('change', state => { if(state==='active') load(); }); return () => sub.remove(); }, [load]);

  const todayIndex = useMemo(() => {
    const day = new Date(`${schoolDay}T00:00:00Z`).getUTCDay();
    return day === 0 ? 7 : day;
  }, [schoolDay]);

  const displayName = student?.name || user?.name || '同学';
  const displayNo = student?.stdNo || user?.stdNo || '学号未获取';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}>
      <GlassSurface style={styles.heroCard}>
        <View style={styles.heroGlowLarge} />
        <View style={styles.heroGlowSmall} />
        <View style={styles.heroTopline}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{displayName[0]}</Text></View>
          <View style={styles.heroIdentity}>
            <Text style={styles.eyebrow}>XAUAT STUDENT</Text>
            <Text style={styles.studentName}>{greetingForNow()}，{displayName}</Text>
            <Text style={styles.studentMeta}>{displayNo}</Text>
          </View>
        </View>
        <Text style={styles.semesterName} numberOfLines={1}>{semesterName || '当前学期'}</Text>
        <View style={styles.heroMetrics}>
          <View style={styles.metricItem}><Text style={styles.metricValue}>{loading || error ? '—' : todayLessons.length}</Text><Text style={styles.metricLabel}>今日课程</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}><Text style={styles.metricValue}>{currentWeek ? `第 ${currentWeek} 周` : '—'}</Text><Text style={styles.metricLabel}>教学周</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}><Text style={styles.metricValue}>{WEEK_LABELS[todayIndex]}</Text><Text style={styles.metricLabel}>今天</Text></View>
        </View>
      </GlassSurface>

      <View>
        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionEyebrow}>QUICK ACCESS</Text><Text style={styles.sectionTitle}>校园服务</Text></View>
          <Ionicons name="arrow-forward" size={18} color={colors.textSecondary} />
        </View>
        <View style={styles.entryGrid}>
          {ENTRIES.map((entry) => (
            <MotionTouchableOpacity key={entry.key} style={styles.entry} onPress={() => onNavigate(entry.key)} activeOpacity={0.72}>
              <View style={[styles.entryIcon, { backgroundColor: entry.tint }]}>
                <Ionicons name={entry.icon as keyof typeof Ionicons.glyphMap} size={23} color={entry.color} />
              </View>
              <Text style={styles.entryLabel}>{entry.label}</Text>
              <Text style={styles.entryDetail}>{entry.detail}</Text>
            </MotionTouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.lessonSection}>
        <Text style={[styles.sectionEmpty, { textAlign: "left", marginBottom: 12 }]}>{error ? '本次同步失败，请刷新后核对今日课程' : loading ? '正在核对今日课程…' : scheduleHint}</Text>
        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionEyebrow}>TODAY</Text><Text style={styles.sectionTitle}>今日课程</Text></View>
          <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>{WEEK_LABELS[todayIndex]}</Text></View>
        </View>
        {loading ? (
          <GlassSurface style={styles.sectionCenter}><ActivityIndicator color={colors.primary} /><Text style={styles.sectionEmpty}>正在整理今天的安排</Text></GlassSurface>
        ) : error ? (
          <GlassSurface style={styles.sectionCenter}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textSecondary} />
            <Text style={styles.sectionEmpty}>{error}</Text>
            <MotionTouchableOpacity style={styles.retryButton} onPress={load}><Text style={styles.retryText}>重新加载</Text></MotionTouchableOpacity>
          </GlassSurface>
        ) : todayLessons.length ? (
          <View style={styles.lessonList}>
            {todayLessons.slice().sort((a, b) => (a.startUnit ?? 99) - (b.startUnit ?? 99)).map((lesson, index) => (
              <MotionTouchableOpacity key={`${lesson.id}-${index}`} style={styles.lessonCard} feedback="impact" onPress={() => Alert.alert(lesson.nameZh, [lesson.timeText, lesson.placeText, lesson.teacher].filter(Boolean).join("\n"))}>
                <View style={[styles.lessonAccent, { backgroundColor: COURSE_ACCENTS[index % COURSE_ACCENTS.length] }]} />
                <View style={styles.unitBadge}><Text style={styles.unitText}>{lesson.startUnit ?? '?'}</Text><Text style={styles.unitLabel}>节</Text></View>
                <View style={styles.lessonBody}>
                  <Text style={styles.lessonName} numberOfLines={2}>{lesson.nameZh}</Text>
                  <Text style={styles.lessonMeta}>{lesson.timeText || '时间待定'}</Text>
                  {!!lesson.placeText && <View style={styles.locationRow}><Ionicons name="location-outline" size={13} color={colors.textSecondary} /><Text style={styles.locationText} numberOfLines={1}>{lesson.placeText}</Text></View>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
              </MotionTouchableOpacity>
            ))}
          </View>
        ) : (
          <GlassSurface style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name="leaf-outline" size={27} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>{scheduleHint.includes('未') ? '请核对课程安排' : '当前课表未安排今日课程'}</Text>
            <Text style={styles.sectionEmpty}>{next ? `下一次：${next.date} · 第 ${next.week} 周\n${next.lessons[0].nameZh} · 第 ${next.lessons[0].startUnit ?? '?'} 节` : '未来 35 天暂无已识别课程，学校临时调课请以通知为准。'}</Text>
            <MotionTouchableOpacity style={styles.retryButton} onPress={() => onNavigate('schedule')}><Text style={styles.retryText}>核对完整课表</Text></MotionTouchableOpacity>
          </GlassSurface>
        )}
      </View>
    </ScrollView>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xl },
  heroCard: { overflow: 'hidden', borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 28, backgroundColor: colors.primaryWash, padding: 20, shadowColor: '#374334', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 3 },
  heroGlowLarge: { position: 'absolute', right: -34, top: -40, width: 132, height: 132, borderRadius: 66, backgroundColor: colors.heroGlow },
  heroGlowSmall: { position: 'absolute', right: 74, top: 34, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.heroGlowSoft },
  heroTopline: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroIdentity: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  studentName: { marginTop: 3, color: colors.text, fontSize: 18, fontWeight: '800' },
  studentMeta: { marginTop: 3, color: colors.textSecondary, fontSize: 12 },
  semesterName: { marginTop: 22, color: colors.text, fontSize: 13, fontWeight: '700' },
  heroMetrics: { marginTop: 12, flexDirection: 'row', alignItems: 'center', borderRadius: 18, backgroundColor: colors.glass, paddingVertical: 12 },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: '800' },
  metricLabel: { marginTop: 3, color: colors.textSecondary, fontSize: 10 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.primaryBorder },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionEyebrow: { color: colors.textSecondary, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  sectionTitle: { marginTop: 3, color: colors.text, fontSize: 19, fontWeight: '800' },
  entryGrid: { flexDirection: 'row', gap: 10 },
  entry: { flex: 1, minHeight: 122, alignItems: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, padding: 12, shadowColor: '#272922', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 14, elevation: 1 },
  entryIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  entryLabel: { marginTop: 12, color: colors.text, fontSize: 13, fontWeight: '800' },
  entryDetail: { marginTop: 3, color: colors.textSecondary, fontSize: 10 },
  lessonSection: { paddingBottom: spacing.sm },
  dayBadge: { borderRadius: 999, backgroundColor: colors.secondary, paddingHorizontal: 12, paddingVertical: 7 },
  dayBadgeText: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  lessonList: { gap: 10 },
  lessonCard: { position: 'relative', overflow: 'hidden', minHeight: 92, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, padding: 14, paddingLeft: 17 },
  lessonAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  unitBadge: { width: 42, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted, marginRight: spacing.md },
  unitText: { color: colors.text, fontSize: 16, fontWeight: '900', lineHeight: 18 },
  unitLabel: { color: colors.textSecondary, fontSize: 9 },
  lessonBody: { flex: 1, minWidth: 0 },
  lessonName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  lessonMeta: { marginTop: 4, color: colors.textSecondary, fontSize: 11 },
  locationRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { flex: 1, color: colors.textSecondary, fontSize: 11 },
  sectionCenter: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surfaceTranslucent, padding: spacing.lg },
  sectionEmpty: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retryButton: { marginTop: 4, borderRadius: 999, backgroundColor: colors.primaryDark, paddingHorizontal: 15, paddingVertical: 8 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  emptyCard: { minHeight: 160, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surfaceTranslucent, padding: spacing.lg },
  emptyIcon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: 10 },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 4 },
});
