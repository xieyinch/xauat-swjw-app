import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchAdminClassTable } from '../../api/query';
import { fetchSemesters, getStudentInfoCached, resolveCurrentSemester } from '../../api/data';
import { inWeek } from '../../api/parsers';
import type { AdminClassCourse, Semester } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

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

/** 从周次文本（如「9~14」「3~5,7」）中取最小周次 */
function firstWeekOf(weekText: string): number {
  const nums = weekText.match(/\d+/g);
  if (!nums || !nums.length) return 0;
  return Math.min(...nums.map(Number));
}

/** 从周次文本中取最大周次 */
function lastWeekOf(weekText: string): number {
  const nums = weekText.match(/\d+/g);
  if (!nums || !nums.length) return 0;
  return Math.max(...nums.map(Number));
}

export function AdminClassTableScreen({ onClose, onSessionExpired }: Props) {
  const { width: winW } = useWindowDimensions();
  const colW = Math.max((winW - TIME_COL) / 7, 54);

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [data, setData] = useState<{ className: string; courses: AdminClassCourse[] } | null>(null);
  const [week, setWeek] = useState(1);
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
        // 默认周选最早有课的周，避免空网格（班级课表通常非第一周开课）
        const minWeek = result.courses.reduce((min, c) => {
          const first = firstWeekOf(c.weekText);
          return first > 0 ? Math.min(min, first) : min;
        }, Infinity);
        setWeek(minWeek === Infinity ? 1 : Math.max(1, minWeek));
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

  const totalUnits = useMemo(() => {
    if (!data) return 12;
    const maxEnd = Math.max(...data.courses.map((l) => l.endUnit ?? l.startUnit ?? 1), 12);
    return Math.max(12, maxEnd);
  }, [data]);

  const blocks = useMemo(() => {
    if (!data) return [];
    type Item = AdminClassCourse & { day: number; start: number; end: number };
    type Placed = Item & { left: number; top: number; width: number; height: number; bg: string };
    const items: Item[] = [];
    for (const c of data.courses) {
      const day = c.dayOfWeek ?? 0;
      const start = c.startUnit ?? 1;
      const end = c.endUnit ?? start;
      if (day < 1 || day > 7 || start < 1 || start > totalUnits || !inWeek(c.weekText, week)) {
        continue;
      }
      items.push({ ...c, day, start, end });
    }
    const byDay = new Map<number, Item[]>();
    for (const it of items) {
      const list = byDay.get(it.day) ?? [];
      list.push(it);
      byDay.set(it.day, list);
    }
    const placed: Placed[] = [];
    for (const [day, col] of byDay) {
      const colX = TIME_COL + (day - 1) * colW;
      col.sort((a, b) => a.start - b.start || a.end - b.end);
      const groups: Array<Item[]> = [];
      let groupMaxEnd = -1;
      for (const it of col) {
        if (it.start > groupMaxEnd) {
          groups.push([it]);
          groupMaxEnd = it.end;
        } else {
          groups[groups.length - 1].push(it);
          if (it.end > groupMaxEnd) groupMaxEnd = it.end;
        }
      }
      for (const g of groups) {
        const w = colW / g.length;
        g.forEach((it, i) => {
          placed.push({
            ...it,
            left: colX + i * w,
            top: HEADER_H + (it.start - 1) * ROW_H,
            width: w - GAP,
            height: Math.min((it.end - it.start + 1) * ROW_H - GAP, (totalUnits - it.start + 1) * ROW_H - GAP),
            bg: colorFor(it.courseName),
          });
        });
      }
    }
    placed.sort((a, b) => a.start - b.start || a.left - b.left);
    return placed;
  }, [data, week, colW, totalUnits]);

  const totalWeeks = useMemo(() => {
    if (!data) return 20;
    const max = data.courses.reduce((m, c) => {
      const last = lastWeekOf(c.weekText);
      return last > 0 ? Math.max(m, last) : m;
    }, 0);
    return Math.max(16, max);
  }, [data]);
  const gridH = totalUnits * ROW_H;
  const gridW = TIME_COL + 7 * colW;
  const currentSemesterName = semesters.find((s) => s.id === semesterId)?.nameZh ?? '';

  return (
    <FunctionShell title="我的班级课表" onClose={onClose}>
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
          {data?.className ? <Text style={styles.weekTotal}>{data.className}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.weekBtn}
          onPress={() => setWeek((w) => Math.min(totalWeeks, w + 1))}
          disabled={week >= totalWeeks}
        >
          <Ionicons name="chevron-forward" size={20} color={week >= totalWeeks ? colors.border : colors.primary} />
        </TouchableOpacity>
      </View>

      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无班级课表">
        <ScrollView
          style={styles.gridScroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
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
                  const parity =
                    /单/.test(b.weekText) && !/双/.test(b.weekText)
                      ? '单周'
                      : /双/.test(b.weekText) && !/单/.test(b.weekText)
                        ? '双周'
                        : '';
                  return (
                    <View
                      key={`${b.courseCode}-${b.dayOfWeek ?? 0}-${b.startUnit ?? 0}`}
                      style={[
                        styles.lessonBlock,
                        {
                          left: b.left,
                          top: b.top,
                          width: b.width,
                          height: b.height,
                          backgroundColor: b.bg,
                        },
                      ]}
                    >
                      <Text style={styles.blockName} numberOfLines={4}>
                        {b.courseName}
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
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
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
});
