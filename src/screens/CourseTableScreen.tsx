import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { fetchCourseTable, fetchSemesters, resolveCurrentSemester } from '../api/data';
import { inWeek } from '../api/parsers';
import type { CourseLesson, CourseTableData, Semester } from '../types';
import { colors, spacing } from '../theme';

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const TIME_COL = 46;
const HEADER_H = 40;
const ROW_H = 66;
const GAP = 3;
const PAD = 5;

const CARD_COLORS = [
  '#5B8DD6',
  '#7FA8E0',
  '#E06B6B',
  '#E98A8A',
  '#D67A5B',
  '#C9A227',
  '#4FAF9A',
  '#8E8FD6',
  '#D66B9A',
  '#6BA3C9',
];

function colorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_COLORS[h % CARD_COLORS.length];
}

interface Props {
  onSessionExpired: () => void;
}

export function CourseTableScreen({ onSessionExpired }: Props) {
  const { width: winW } = useWindowDimensions();
  const colW = Math.max((winW - TIME_COL) / 7, 54);

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

  const totalUnits = useMemo(() => {
    if (!table) return 12;
    const maxEnd = Math.max(...table.lessons.map((l) => l.endUnit ?? l.startUnit ?? 1), 12);
    return Math.max(12, maxEnd);
  }, [table]);

  const blocks = useMemo(() => {
    if (!table) return [];
    const gridW = TIME_COL + 7 * colW;
    const list: Array<
      CourseLesson & { left: number; top: number; height: number; bg: string }
    > = [];
    for (const l of table.lessons) {
      const day = l.dayOfWeek ?? 0;
      const start = l.startUnit ?? 1;
      const end = l.endUnit ?? start;
      if (day < 1 || day > 7 || start < 1 || start > totalUnits || !inWeek(l.weekText, week)) {
        continue;
      }
      list.push({
        ...l,
        left: TIME_COL + (day - 1) * colW,
        top: HEADER_H + (start - 1) * ROW_H,
        height: Math.min((end - start + 1) * ROW_H - GAP, (totalUnits - start + 1) * ROW_H - GAP),
        bg: colorFor(l.nameZh),
      });
    }
    list.sort((a, b) => (a.startUnit ?? 99) - (b.startUnit ?? 99) || a.left - b.left);
    return list;
  }, [table, week, colW, totalUnits]);

  const currentSemesterName = semesters.find((s) => s.id === semesterId)?.nameZh ?? '';

  const gridH = totalUnits * ROW_H;
  const gridW = TIME_COL + 7 * colW;

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

      <View style={styles.weekBar}>
        <TouchableOpacity style={styles.weekBtn} onPress={() => setWeek((w) => Math.max(1, w - 1))} disabled={week <= 1}>
          <Ionicons name="chevron-back" size={20} color={week <= 1 ? colors.border : colors.primary} />
        </TouchableOpacity>
        <View style={styles.weekInfo}>
          <Text style={styles.weekText}>第 {week} 周</Text>
          {table ? (
            <Text style={styles.weekTotal}>共 {table.totalWeeks} 周 · 当前第 {table.currentWeek} 周</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.weekBtn}
          onPress={() => setWeek((w) => Math.min(table?.totalWeeks ?? week, w + 1))}
          disabled={!table || week >= table.totalWeeks}
        >
          <Ionicons name="chevron-forward" size={20} color={!table || week >= table.totalWeeks ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => (semesterId != null ? loadTable(semesterId) : loadSemesters())}
          >
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.gridScroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => semesterId != null && loadTable(semesterId, true)}
            />
          }
        >
          {currentSemesterName ? <Text style={styles.semesterName}>{currentSemesterName}</Text> : null}
          <View style={{ height: HEADER_H + gridH }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: gridW, height: HEADER_H + gridH }}>
              <View style={{ width: gridW, height: HEADER_H + gridH }}>
                <View style={[styles.headerRow, { width: gridW, paddingLeft: TIME_COL }]}>
                  {WEEK_LABELS.map((label, idx) => (
                    <Text key={label} style={styles.headerCell}>
                      {label}
                    </Text>
                  ))}
                </View>

                <View style={[styles.grid, { left: TIME_COL, top: HEADER_H, width: 7 * colW, height: gridH }]}>
                  {Array.from({ length: totalUnits }).map((_, i) => (
                    <View key={`h-${i}`} style={[styles.hLine, { top: (i + 1) * ROW_H }]} />
                  ))}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={`v-${i}`} style={[styles.vLine, { left: (i + 1) * colW }]} />
                  ))}
                </View>

                {blocks.map((b) => {
                  const notThisWeek = !inWeek(b.weekText, table?.currentWeek ?? week);
                  const parity =
                    /单/.test(b.weekText) && !/双/.test(b.weekText)
                      ? '单周'
                      : /双/.test(b.weekText) && !/单/.test(b.weekText)
                        ? '双周'
                        : '';
                  return (
                    <View
                      key={b.id}
                      style={[
                        styles.lessonBlock,
                        {
                          left: b.left,
                          top: b.top,
                          width: colW - GAP,
                          height: b.height,
                          backgroundColor: b.bg,
                        },
                      ]}
                    >
                      {notThisWeek ? <Text style={styles.badge}>[非本周]</Text> : null}
                      <Text style={styles.blockName} numberOfLines={4}>
                        {b.nameZh}
                      </Text>
                      {b.placeText ? <Text style={styles.blockPlace}>@{b.placeText}</Text> : null}
                      {parity ? <Text style={styles.blockParity}>{parity}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.timeCol, { width: TIME_COL, height: gridH, top: HEADER_H }]} pointerEvents="none">
              {Array.from({ length: totalUnits }).map((_, i) => (
                <View key={`t-${i}`} style={[styles.timeCell, { height: ROW_H }]}>
                  <Text style={styles.timeText}>{i + 1}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  gridScroll: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    height: HEADER_H,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600', color: colors.text },
  grid: {
    position: 'absolute',
    backgroundColor: colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  lessonBlock: {
    position: 'absolute',
    borderRadius: 8,
    paddingHorizontal: PAD,
    paddingVertical: 3,
    justifyContent: 'flex-start',
  },
  badge: { fontSize: 9, color: 'rgba(255,255,255,0.92)', marginBottom: 1, fontWeight: '600' },
  blockName: { fontSize: 12, fontWeight: '700', color: '#fff', lineHeight: 15 },
  blockPlace: { fontSize: 10, color: 'rgba(255,255,255,0.95)', marginTop: 2 },
  blockParity: { fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  timeCol: {
    position: 'absolute',
    left: 0,
    backgroundColor: colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    zIndex: 5,
  },
  timeCell: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 },
  timeText: { fontSize: 12, color: colors.textSecondary },
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
});
