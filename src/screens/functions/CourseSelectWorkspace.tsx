import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
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

function lessonLine(l: CourseSelectLesson): string {
  const code = l.code ? `${l.code}  ` : '';
  return `${code}${teachersText(l)}｜${timePlaceText(l)}`;
}

function RepairedCardView({
  item,
  expanded,
  busy,
  onToggle,
  onAction,
}: {
  item: RepairCourseView;
  expanded: boolean;
  busy: string | null;
  onToggle: () => void;
  onAction: (lesson: CourseSelectLesson, selected: boolean) => void;
}) {
  const st = statusText(item.courseSelectPassStatus);
  const open = item.lessons.length > 0;
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <Text style={styles.courseName} numberOfLines={2}>
            {item.nameZh || `课程${item.id}`}
          </Text>
          {st ? (
            <View style={[styles.chip, { borderColor: st.color }]}>
              <Text style={[styles.chipText, { color: st.color }]}>{st.text}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {item.code || '—'}　{item.credits != null ? `${item.credits} 学分` : ''}
            {item.score != null ? `　成绩 ${item.score}` : ''}
          </Text>
        </View>
        <View style={styles.metaRow}>
          {item.department?.nameZh ? (
            <Text style={styles.metaText} numberOfLines={1}>
              开课单位:{item.department.nameZh}
            </Text>
          ) : null}
          <Text style={[styles.metaText, { marginLeft: 'auto' }]}>
            {expanded ? '收起' : '展开教学班'}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded ? (
        open ? (
          <View style={styles.lessonBox}>
            {item.lessons.map((l) => {
              const selected = item.selectedLesson?.id === l.id;
              const isBusy = busy === `add:${l.id}` || busy === `drop:${l.id}`;
              return (
                <View key={l.id} style={styles.lessonRow}>
                  <View style={styles.lessonInfo}>
                    <Text style={styles.lessonLine} numberOfLines={2}>
                      {lessonLine(l)}
                    </Text>
                    {l.limitCount != null ? (
                      <Text style={styles.lessonSub}>限选 {l.limitCount} 人</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      selected ? styles.dropBtn : styles.selectBtn,
                      isBusy && styles.actionBusy,
                    ]}
                    disabled={isBusy || busy != null}
                    onPress={() => onAction(selected ? item.selectedLesson as CourseSelectLesson : l, selected)}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.actionText}>
                        {selected ? '退课' : '选课'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.noOpenBox}>
            <Text style={styles.noOpenText}>本轮课程未开课</Text>
          </View>
        )
      ) : null}
    </View>
  );
}

function SelectedCardView({
  item,
  busy,
  onDrop,
}: {
  item: CourseSelectLesson;
  busy: string | null;
  onDrop: (l: CourseSelectLesson) => void;
}) {
  const isBusy = busy === `drop:${item.id}`;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.courseName} numberOfLines={2}>
          {item.course?.nameZh || item.nameZh || `课程${item.id}`}
        </Text>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{item.pinned ? '待筛选' : '已选'}</Text>
        </View>
      </View>
      <Text style={styles.metaText}>
        {item.course?.code || item.code || ''}
        {item.course?.credits != null ? `　${item.course.credits} 学分` : ''}
      </Text>
      <Text style={styles.lessonLine} numberOfLines={2}>
        {lessonLine(item)}
      </Text>
      <TouchableOpacity
        style={[styles.actionBtn, styles.dropBtn, isBusy && styles.actionBusy]}
        disabled={isBusy || busy != null}
        onPress={() => onDrop(item)}
      >
        {isBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionText}>退课</Text>}
      </TouchableOpacity>
    </View>
  );
}

export function CourseSelectWorkspace({ turn, onBack, onSessionExpired }: Props) {
  const [tab, setTab] = useState<'repair' | 'selected'>('repair');
  const [data, setData] = useState<SelectWorkspaceData | null>(null);
  const dataRef = useRef<SelectWorkspaceData | null>(null);
  dataRef.current = data;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
      const next = await refreshSelectedLessons(turn.id, prev.repaired);
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

  const runDrop = useCallback(
    async (l: CourseSelectLesson) => {
      Alert.alert(
        '确认退课',
        `确定退掉「${l.course?.nameZh || l.nameZh}」这门课吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '退课',
            style: 'destructive',
            onPress: async () => {
              setBusy(`drop:${l.id}`);
              try {
                const res = await requestDrop(turn.id, l.id, l.coursePackAssoc ?? null);
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
        const res = await requestAdd(turn.id, [lessonId], needAttend !== undefined ? { needAttend } : {});
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
    if (selected) runDrop(l);
    else runAdd(l.id);
  };

  const repairedOpen = data?.repaired.filter((r) => r.lessons.length > 0).length ?? 0;
  const selectedCount = data?.selected.length ?? 0;
  const credits = data?.selected.reduce((s, x) => s + (x.course?.credits ?? 0), 0) ?? 0;

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

      {!loading && !error && data ? (
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>已选 {selectedCount} 门（{credits} 学分）</Text>
          <Text style={styles.statsText}>重修未通过 {data.repaired.length} 门（可开课 {repairedOpen}）</Text>
        </View>
      ) : null}

      <View style={styles.tabBar}>
        {(['repair', 'selected'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'repair' ? '重修选课' : '已选课程'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ListContainer loading={loading} error={error} onRetry={() => load()}>
        {tab === 'repair' ? (
          <FlatList
            data={data?.repaired ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>没有需要重修（不及格/未通过）的课程</Text>
            }
            renderItem={({ item }) => (
              <RepairedCardView
                item={item}
                expanded={expanded === item.id}
                busy={busy}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
                onAction={onLessonAction}
              />
            )}
          />
        ) : (
          <FlatList
            data={data?.selected ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            ListEmptyComponent={<Text style={styles.emptyText}>当前批次还没有已选课程</Text>}
            renderItem={({ item }) => (
              <SelectedCardView item={item} busy={busy} onDrop={(l) => runDrop(l)} />
            )}
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  statsText: { fontSize: 11, color: colors.textSecondary },
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.xs, borderRadius: 8, backgroundColor: colors.surface, padding: 2 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: '#fff', fontWeight: '600' },
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
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  lessonBox: { marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lessonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lessonInfo: { flex: 1, marginRight: spacing.sm },
  lessonLine: { fontSize: 12, color: colors.text, lineHeight: 18 },
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
