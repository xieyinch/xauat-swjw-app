import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchSelectWorkspaceData,
  refreshSelectedLessons,
  requestAdd,
  requestDrop,
  type SelectWorkspaceData,
  type RepairCourseView,
  type CourseBrowse,
} from '../../api/courseSelectEngine';
import { SessionExpiredError } from '../../api/data';
import type { CourseSelectLesson, CourseSelectTurn } from '../../types';
import { colors, spacing } from '../../theme';
import { ListContainer } from '../../components/ListContainer';

interface Props {
  turn: CourseSelectTurn;
  onBack: () => void;
  onSessionExpired: () => void;
}

function statusText(s?: string): { text: string; color: string } | null {
  if (s === 'NO_PASS') return { text: '未通过', color: colors.danger };
  if (s === 'SUBSITUTE_PASS') return { text: '替代通过', color: colors.success };
  if (s === 'PASS') return { text: '通过', color: colors.success };
  return null;
}

function teachersText(l: CourseSelectLesson): string {
  const names = (l.teachers ?? []).map((t) => t.nameZh).filter(Boolean);
  return names.length ? names.join('、') : '未安排';
}

function timePlaceText(l: CourseSelectLesson): string {
  const dtp = l.dateTimePlace;
  const text = dtp?.textZh || dtp?.text || '';
  if (text.trim()) return text.replace(/\n/g, '；').trim();
  const sg = l.scheduleGroups?.[0]?.dateTimePlace;
  const t2 = sg?.textZh || sg?.text || '';
  if (t2.trim()) return t2.replace(/\n/g, '；').trim();
  return '时间地点待定';
}

function attrName(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const n = (v as { nameZh?: unknown }).nameZh;
    return typeof n === 'string' ? n : '';
  }
  return '';
}

function lessonLines(l: CourseSelectLesson): { main: string; sub: string } {
  const code = l.code ? `${l.code}  ` : '';
  const attrs: string[] = [];
  const ct = attrName(l.courseType);
  if (ct) attrs.push(ct);
  const cp = attrName(l.courseProperty);
  if (cp) attrs.push(cp);
  const campusName = attrName(l.campus);
  if (campusName) attrs.push(campusName);
  const retake = l.retake ? '重修' : null;
  if (retake) attrs.push(retake);
  const remark = l.selectionRemark ? l.selectionRemark : null;
  if (remark) attrs.push(remark);
  return {
    main: `${code}${teachersText(l)}｜${timePlaceText(l)}`,
    sub: attrs.length ? attrs.join(' · ') : '',
  };
}

function LessonRows({
  lessons,
  selectedByLesson,
  selectedByCourse,
  busy,
  onAction,
  dropTargetOf,
}: {
  lessons: CourseSelectLesson[];
  selectedByLesson: Map<number, CourseSelectLesson>;
  selectedByCourse: Map<number, CourseSelectLesson>;
  busy: string | null;
  onAction: (lesson: CourseSelectLesson, selected: boolean) => void;
  dropTargetOf: (lesson: CourseSelectLesson) => CourseSelectLesson | null;
}) {
  if (!lessons.length) return null;
  return (
    <View style={styles.lessonBox}>
      {lessons.map((l) => {
        const target = dropTargetOf(l);
        const isBusy = busy === `add:${l.id}` || busy === `drop:${target?.id ?? l.id}`;
        const info = lessonLines(l);
        return (
          <View key={l.id} style={styles.lessonRow}>
            <View style={styles.lessonInfo}>
              <Text style={styles.lessonMain} numberOfLines={2}>{info.main}</Text>
              {info.sub ? <Text style={styles.lessonSub} numberOfLines={1}>{info.sub}</Text> : null}
              {l.limitCount != null ? <Text style={styles.lessonSub}>限选 {l.limitCount} 人</Text> : null}
            </View>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                target ? styles.dropBtn : styles.selectBtn,
                isBusy && styles.actionBusy,
              ]}
              disabled={isBusy || busy != null}
              onPress={() => onAction(l, !!target)}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.actionText}>{target ? '退课' : '选课'}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function CourseHeader({
  name,
  right,
}: {
  name: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.cardHeader}>
      <Text style={styles.courseName} numberOfLines={2}>{name}</Text>
      {right}
    </View>
  );
}

function BaseCourseCard({
  header,
  metaLines,
  footer,
}: {
  header: React.ReactNode;
  metaLines?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      {header}
      {metaLines}
      {footer}
    </View>
  );
}

type TabKey = 'all' | 'repair' | 'selected';

export function CourseSelectWorkspace({ turn, onBack, onSessionExpired }: Props) {
  const [tab, setTab] = useState<TabKey>('repair');
  const [data, setData] = useState<SelectWorkspaceData | null>(null);
  const dataRef = useRef<SelectWorkspaceData | null>(null);
  dataRef.current = data;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [kw, setKw] = useState('');
  const [campus, setCampus] = useState<string>('');
  const [busy, setBusy] = useState<string | null>(null);

  const campusOptions = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const list: string[] = [];
    for (const c of data.all) {
      for (const l of c.lessons) {
        const name = attrName(l.campus);
        if (name && !seen.has(name)) {
          seen.add(name);
          list.push(name);
        }
      }
    }
    return list;
  }, [data]);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const d = await fetchSelectWorkspaceData(turn.id);
        setData(d);
      } catch (e) {
        if (e instanceof SessionExpiredError || (e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '选课数据加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [turn.id, onSessionExpired],
  );

  const reloadAfterOp = useCallback(async (): Promise<boolean> => {
    const prev = dataRef.current;
    if (!prev) return false;
    try {
      const next = await refreshSelectedLessons(turn.id, prev);
      setData(next);
      return true;
    } catch (e) {
      if (e instanceof SessionExpiredError || (e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return false;
      }
      Alert.alert('刷新失败', (e as Error).message || '状态可能未同步，请下拉刷新');
      return false;
    }
  }, [turn.id, onSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedByLesson = useMemo(() => {
    const m = new Map<number, CourseSelectLesson>();
    for (const s of data?.selected ?? []) m.set(s.id, s);
    return m;
  }, [data]);

  const selectedByCourse = useMemo(() => {
    const m = new Map<number, CourseSelectLesson>();
    for (const s of data?.selected ?? []) {
      const cid = s.course?.id;
      if (cid != null && !m.has(cid)) m.set(cid, s);
    }
    return m;
  }, [data]);

  const dropTargetOf = useCallback(
    (l: CourseSelectLesson): CourseSelectLesson | null => {
      const direct = selectedByLesson.get(l.id);
      if (direct) return direct;
      return selectedByCourse.get(l.course?.id ?? -1) ?? null;
    },
    [selectedByLesson, selectedByCourse],
  );

  const runDrop = useCallback(
    async (target: CourseSelectLesson) => {
      Alert.alert(
        '确认退课',
        `确定退掉「${target.course?.nameZh || target.nameZh}」这门课吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '退课',
            style: 'destructive',
            onPress: async () => {
              setBusy(`drop:${target.id}`);
              try {
                const res = await requestDrop(turn.id, target.id, target.coursePackAssoc ?? null);
                Alert.alert('退课', res.message);
                await reloadAfterOp();
              } catch (e) {
                if ((e as Error).name === 'SessionExpiredError') return onSessionExpired();
                Alert.alert('退课失败', (e as Error).message || '请稍后再试');
              } finally {
                setBusy(null);
              }
            },
          },
        ],
      );
    },
    [turn.id, reloadAfterOp, onSessionExpired],
  );

  const runAdd = useCallback(
    async (lessonId: number, needAttend?: boolean) => {
      setBusy(`add:${lessonId}`);
      try {
        const res = await requestAdd(
          turn.id,
          [lessonId],
          needAttend !== undefined ? { needAttend } : {},
        );
        if (!res.ok && res.conflictResend) {
          Alert.alert('时间冲突', '和已选课程存在时间冲突，是否办理免听？', [
            { text: '取消', style: 'cancel' },
            { text: '不免听', onPress: () => runAdd(lessonId, true) },
            { text: '免听', onPress: () => runAdd(lessonId, false) },
          ]);
          return;
        }
        Alert.alert('选课', res.message);
        await reloadAfterOp();
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') return onSessionExpired();
        Alert.alert('选课失败', (e as Error).message || '请稍后再试');
      } finally {
        setBusy(null);
      }
    },
    [turn.id, reloadAfterOp, onSessionExpired],
  );

  const onLessonAction = (l: CourseSelectLesson, selected: boolean) => {
    if (selected) {
      const target = dropTargetOf(l);
      if (target) runDrop(target);
    } else runAdd(l.id);
  };

  const allFiltered = useMemo(() => {
    if (!data) return [];
    const q = kw.trim().toLowerCase();
    const base = data.all;
    if (!q && !campus) return base;
    const out: CourseBrowse[] = [];
    for (const c of base) {
      if (q && !(c.nameZh || '').toLowerCase().includes(q) && !(c.code || '').toLowerCase().includes(q)) {
        continue;
      }
      if (!campus) {
        out.push(c);
        continue;
      }
      const lessons = c.lessons.filter((l) => attrName(l.campus) === campus);
      if (!lessons.length) continue;
      out.push({ ...c, lessons });
    }
    return out;
  }, [data, kw, campus]);

  const repairedOpen = data?.repaired.filter((r) => r.lessons.length > 0).length ?? 0;
  const selectedCount = data?.selected.length ?? 0;
  const credits = data?.selected.reduce((s, x) => s + (x.course?.credits ?? 0), 0) ?? 0;

  const repairCard = (item: RepairCourseView) => {
    const st = statusText(item.courseSelectPassStatus);
    const selectedCourse = selectedByCourse.get(item.id) ?? null;
    const open = item.lessons.length > 0;
    return (
      <BaseCourseCard
        header={
          <CourseHeader
            name={item.nameZh || `课程${item.id}`}
            right={
              st ? (
                <View style={[styles.chip, { borderColor: st.color }]}>
                  <Text style={[styles.chipText, { color: st.color }]}>{st.text}</Text>
                </View>
              ) : undefined
            }
          />
        }
        metaLines={
          <View>
            <Text style={styles.metaText}>
              {item.code || '—'}　{item.credits != null ? `${item.credits} 学分` : ''}
              {item.score != null ? `　成绩 ${item.score}` : ''}
              {item.department?.nameZh ? `　开课单位:${item.department.nameZh}` : ''}
            </Text>
            <Text style={styles.expandText}>
              {open ? `${item.lessons.length} 个教学班` : '本轮未开课'}
              {selectedCourse ? `　·　已选「${selectedCourse.nameZh || '该课'}」` : ''}
              {'　' + (expanded === item.id ? '收起' : '展开')}
            </Text>
          </View>
        }
        footer={
          expanded === item.id ? (
            open ? (
              <LessonRows
                lessons={item.lessons}
                selectedByLesson={selectedByLesson}
                selectedByCourse={selectedByCourse}
                busy={busy}
                onAction={onLessonAction}
                dropTargetOf={dropTargetOf}
              />
            ) : selectedCourse ? (
              <LessonRows
                lessons={[selectedCourse]}
                selectedByLesson={selectedByLesson}
                selectedByCourse={selectedByCourse}
                busy={busy}
                onAction={onLessonAction}
                dropTargetOf={dropTargetOf}
              />
            ) : (
              <View style={styles.noOpenBox}>
                <Text style={styles.noOpenText}>本轮课程未开课</Text>
              </View>
            )
          ) : undefined
        }
      />
    );
  };

  const allCard = (item: CourseBrowse) => (
    <BaseCourseCard
      header={
        <CourseHeader name={item.nameZh || `课程${item.id}`} right={undefined} />
      }
      metaLines={
        <View>
          <Text style={styles.metaText}>
            {item.code || '—'}
            {item.credits != null ? `　${item.credits} 学分` : ''}
            {item.deptName ? `　开课单位:${item.deptName}` : ''}
          </Text>
          <Text style={styles.expandText}>
            {item.lessons.length} 个教学班　{expanded === item.id ? '收起' : '展开'}
          </Text>
        </View>
      }
      footer={
        expanded === item.id ? (
          <LessonRows
            lessons={item.lessons}
            selectedByLesson={selectedByLesson}
            selectedByCourse={selectedByCourse}
            busy={busy}
            onAction={onLessonAction}
            dropTargetOf={dropTargetOf}
          />
        ) : undefined
      }
    />
  );

  const selectedCard = (item: CourseSelectLesson) => {
    const isBusy = busy === `drop:${item.id}`;
    const info = lessonLines(item);
    return (
      <BaseCourseCard
        header={
          <CourseHeader
            name={item.course?.nameZh || item.nameZh || `课程${item.id}`}
            right={
              <View style={styles.chip}>
                <Text style={styles.chipText}>{item.pinned ? '待筛选' : '已选'}</Text>
              </View>
            }
          />
        }
        metaLines={
          <View>
            <Text style={styles.metaText}>
              {item.course?.code || item.code || ''}
              {item.course?.credits != null ? `　${item.course.credits} 学分` : ''}
              {item.needAttend ? '　免听' : ''}
            </Text>
            <Text style={styles.lessonMain} numberOfLines={2}>{info.main}</Text>
            {info.sub ? <Text style={styles.lessonSub} numberOfLines={1}>{info.sub}</Text> : null}
          </View>
        }
        footer={
          <TouchableOpacity
            style={[styles.actionBtn, styles.dropBtn, isBusy && styles.actionBusy]}
            disabled={isBusy || busy != null}
            onPress={() => onLessonAction(item, true)}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionText}>退课</Text>
            )}
          </TouchableOpacity>
        }
      />
    );
  };

  const tapCourse = (id: number) => setExpanded(expanded === id ? null : id);

  return (
    <View style={styles.flex}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>返回批次</Text>
        </TouchableOpacity>
        <Text style={styles.subTitle} numberOfLines={1}>
          {turn.name}
        </Text>
      </View>

      <View style={styles.tabBar}>
        {(
          [
            { key: 'all', label: '全部课程' },
            { key: 'repair', label: '重修选课' },
            { key: 'selected', label: '已选课程' },
          ] as { key: TabKey; label: string }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!loading && !error && data ? (
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>已选 {selectedCount} 门（{credits} 学分）</Text>
          <Text style={styles.statsText}>
            {tab === 'all'
              ? `可开课课程 ${allFiltered.length} 门`
              : tab === 'repair'
                ? `重修未通过 ${data.repaired.length} 门（可开课 ${repairedOpen}）`
                : `本批次 ${data.selected.length} 门`}
          </Text>
        </View>
      ) : null}

      {tab === 'all' && !loading && !error && data && campusOptions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.campusRow}
          style={{ flexGrow: 0 }}
        >
          <TouchableOpacity
            style={[styles.campusChip, campus === '' && styles.campusChipActive]}
            onPress={() => setCampus('')}
          >
            <Text style={[styles.campusChipText, campus === '' && styles.campusChipTextActive]}>
              全部校区
            </Text>
          </TouchableOpacity>
          {campusOptions.map((name) => (
            <TouchableOpacity
              key={name}
              style={[styles.campusChip, campus === name && styles.campusChipActive]}
              onPress={() => setCampus(campus === name ? '' : name)}
            >
              <Text
                style={[styles.campusChipText, campus === name && styles.campusChipTextActive]}
              >
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {tab === 'all' && !loading && !error && data ? (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={kw}
            onChangeText={setKw}
            placeholder="搜索课程名称 / 课程代码"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            autoCorrect={false}
          />
          {kw ? (
            <TouchableOpacity onPress={() => setKw('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <ListContainer loading={loading} error={error} onRetry={() => load()}>
        {tab === 'repair' ? (
          <FlatList
            data={data?.repaired ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={<Text style={styles.emptyText}>没有需要重修（不及格/未通过）的课程</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => tapCourse(item.id)}>
                {repairCard(item)}
              </TouchableOpacity>
            )}
          />
        ) : tab === 'all' ? (
          <FlatList
            data={allFiltered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {kw || campus ? '没有匹配的课程' : '当前批次暂无可选课程数据'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity key={item.id} activeOpacity={0.8} onPress={() => tapCourse(item.id)}>
                {allCard(item)}
              </TouchableOpacity>
            )}
          />
        ) : (
          <FlatList
            data={data?.selected ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={<Text style={styles.emptyText}>当前批次还没有已选课程</Text>}
            renderItem={({ item }) => selectedCard(item)}
          />
        )}
      </ListContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs },
  backText: { color: colors.primary, fontSize: 14 },
  subTitle: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: 8, backgroundColor: colors.surface, padding: 2 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  statsText: { fontSize: 11, color: colors.textSecondary },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  campusRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  campusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  campusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  campusChipText: { fontSize: 12, color: colors.textSecondary },
  campusChipTextActive: { color: '#fff', fontWeight: '600' },
  searchInput: { flex: 1, paddingVertical: 6, fontSize: 13, color: colors.text },
  listContent: { paddingBottom: spacing.xl },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  courseName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, marginRight: spacing.sm },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipText: { fontSize: 11, color: colors.textSecondary },
  metaText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  expandText: { fontSize: 12, color: colors.primary, lineHeight: 20, marginTop: 2 },
  lessonBox: { marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lessonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lessonInfo: { flex: 1, marginRight: spacing.sm },
  lessonMain: { fontSize: 12, color: colors.text, lineHeight: 18 },
  lessonSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  actionBtn: { minWidth: 64, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  selectBtn: { backgroundColor: colors.primary },
  dropBtn: { backgroundColor: colors.danger },
  actionBusy: { opacity: 0.7 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  noOpenBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.surface },
  noOpenText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  emptyText: { textAlign: 'center', color: colors.textSecondary, fontSize: 13, marginTop: spacing.xl * 2 },
});
