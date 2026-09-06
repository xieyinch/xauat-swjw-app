import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import {
  fetchCourseSubstituteRows,
  fetchExamDelayApplyRows,
  fetchGradeAbandonRows,
  fetchRecommendApplyInfo,
  fetchStdAlterationData,
  fetchTutorWarehouseRows,
} from '../../api/query';
import type {
  FeatureApplyRow,
  RecommendApplyInfo,
  StdAlterationData,
} from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
  openWebPage?: (title: string, path: string) => void;
}

interface RowListSpec {
  /** 原生页标题（与菜单标题一致） */
  title: string;
  /** 打开原功能页的 WebView 标题 */
  webTitle?: string;
  /** 打开原功能页的路径（带 /student 前缀） */
  webPath?: string;
  /** 列表为空时的说明 */
  emptyText: string;
  load: () => Promise<FeatureApplyRow[]>;
  /** 列表头部的引导语 */
  hint?: string;
  /** 列表底部提示 */
  footerNote?: string;
}

function stateTone(state: string): string {
  const s = state || '';
  if (s.includes('通过') && !s.includes('不')) return colors.success;
  if (s.includes('不通过') || s.includes('驳回') || s.includes('退回') || s.includes('拒绝') || s.includes('未通过')) {
    return colors.danger;
  }
  if (s.includes('审核中') || s.includes('待审核')) return colors.warning;
  return colors.textSecondary;
}

function ApplyListScreen({ onClose, onSessionExpired, openWebPage, spec }: Props & { spec: RowListSpec }) {
  const [rows, setRows] = useState<FeatureApplyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await spec.load();
        setRows(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [spec, onSessionExpired],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openWeb = useCallback(() => {
    if (openWebPage && spec.webPath) openWebPage(spec.webTitle ?? spec.title, spec.webPath);
  }, [openWebPage, spec.webPath, spec.webTitle, spec.title]);

  let lastGroup: string | null = null;

  return (
    <FunctionShell title={spec.title} onClose={onClose}>
      <View style={styles.headerRow}>
        <Text style={styles.headerHint}>{spec.hint ?? '以下为教务系统实时数据，办理需在网页端完成。'}</Text>
        {spec.webPath ? (
          <TouchableOpacity style={styles.webBtn} onPress={openWeb}>
            <Ionicons name="open-outline" size={14} color="#fff" />
            <Text style={styles.webBtnText}>原功能页</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ListContainer loading={loading} error={error} onRetry={() => load()}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          contentContainerStyle={styles.listContent}
        >
          {rows.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={34} color={colors.textSecondary} />
              <Text style={styles.emptyText}>{spec.emptyText}</Text>
            </View>
          ) : (
            rows.map((row, i) => {
              const grouped = row.group && row.group !== lastGroup;
              if (row.group) lastGroup = row.group;
              return (
                <View key={i}>
                  {grouped ? (
                    <View style={styles.groupRow}>
                      <Text style={styles.groupText}>{row.group}</Text>
                    </View>
                  ) : null}
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle} numberOfLines={3}>{row.title || '—'}</Text>
                      {row.status ? (
                        <Text style={[styles.stateChip, { color: stateTone(row.status), borderColor: stateTone(row.status) }]}>
                          {row.status}
                        </Text>
                      ) : row.applyNote ? (
                        <Text style={[styles.stateChip, { color: colors.success, borderColor: colors.success }]}>{row.applyNote}</Text>
                      ) : null}
                    </View>
                    {row.meta ? <Text style={styles.metaText}>{row.meta}</Text> : null}
                    {row.lines.map((line, j) => (
                      <Text key={j} style={styles.metaText}>
                        <Text style={styles.labelText}>{line.label}：</Text>
                        {line.value}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })
          )}
          {spec.footerNote ? <Text style={styles.footerNote}>{spec.footerNote}</Text> : null}
        </ScrollView>
      </ListContainer>
    </FunctionShell>
  );
}

// ---------- 各功能薄封装：以 permCode 名导出，便于在 nativeFunctions 中注册 ----------

export function ExamDelayApplyScreen(props: Props) {
  return (
    <ApplyListScreen
      {...props}
      spec={{
        title: '缓考申请',
        webTitle: '缓考申请',
        webPath: '/student/for-std/exam-delay-apply',
        emptyText: '暂无可申请缓考的考试记录',
        load: fetchExamDelayApplyRows,
      }}
    />
  );
}

export function CourseSubstituteApplyScreen(props: Props) {
  return (
    <ApplyListScreen
      {...props}
      spec={{
        title: '课程替代申请',
        webTitle: '课程替代申请',
        webPath: '/student/for-std/course-substitute-apply',
        emptyText: '暂无课程替代申请记录',
        load: fetchCourseSubstituteRows,
      }}
    />
  );
}

export function GradeAbandonApplyScreen(props: Props) {
  return (
    <ApplyListScreen
      {...props}
      spec={{
        title: '放弃成绩申请',
        webTitle: '放弃成绩申请',
        webPath: '/student/for-std/grade-abandon-apply',
        emptyText: '暂无放弃成绩申请记录',
        load: fetchGradeAbandonRows,
      }}
    />
  );
}

export function TutorIntentApplyScreen(props: Props) {
  return (
    <ApplyListScreen
      {...props}
      spec={{
        title: '选择意向导师',
        webTitle: '选择意向导师',
        webPath: '/student/for-std/select/std-tutor-apply',
        emptyText: '当前无开放选择的导师',
        load: fetchTutorWarehouseRows,
      }}
    />
  );
}

// ---------- 学籍异动申请：类型窗口卡列表 ----------

export function StdAlterationApplyScreen({ onClose, onSessionExpired, openWebPage }: Props) {
  const [data, setData] = useState<StdAlterationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await fetchStdAlterationData());
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onSessionExpired],
  );

  useEffect(() => {
    load();
  }, [load]);

  const openWeb = useCallback(
    (name: string) => {
      if (openWebPage) openWebPage(name, '/student/for-std/std-alteration-apply');
    },
    [openWebPage],
  );

  return (
    <FunctionShell title="学籍异动申请" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          contentContainerStyle={styles.listContent}
        >
          {(data?.applyTypes ?? []).length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="albums-outline" size={34} color={colors.textSecondary} />
              <Text style={styles.emptyText}>暂无可申请的学籍异动类型</Text>
            </View>
          ) : (
            (data?.applyTypes ?? []).map((t, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t.name}</Text>
                  {t.canApply ? (
                    <TouchableOpacity style={styles.webBtn} onPress={() => openWeb(t.name)}>
                      <Text style={styles.webBtnText}>立即申请</Text>
                      <Ionicons name="chevron-forward" size={13} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.stateChip}>未开放</Text>
                  )}
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
                  <Text style={styles.infoText}>申请起止时间：{t.applyTimeText || '—'}</Text>
                </View>
                {t.notice ? (
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>公告：{t.notice}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
          {data?.appliedText ? <Text style={styles.footerNote}>{data.appliedText}</Text> : null}
          <Text style={styles.footerNote}>申请提交与材料上传需在教务网页端完成。</Text>
        </ScrollView>
      </ListContainer>
    </FunctionShell>
  );
}

// ---------- 研究生推免：服务端提示信息 ----------

export function RecommendStudentApplyScreen({ onClose, onSessionExpired, openWebPage }: Props) {
  const [info, setInfo] = useState<RecommendApplyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await fetchRecommendApplyInfo());
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

  return (
    <FunctionShell title="研究生推免" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={load}>
        <View style={styles.emptyBox}>
          <Ionicons name="ribbon-outline" size={38} color={colors.textSecondary} />
          <Text style={styles.emptyText}>{info?.note || '暂无推免信息'}</Text>
          {openWebPage ? (
            <TouchableOpacity
              style={[styles.webBtn, styles.fullBtn]}
              onPress={() => openWebPage('研究生推免', '/student/for-std/recommend-student-apply')}
            >
              <Text style={styles.webBtnText}>前往教务页面查看</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerHint: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  listContent: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  groupRow: { marginTop: spacing.md, marginBottom: -spacing.xs, paddingHorizontal: spacing.lg },
  groupText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs, gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  stateChip: {
    fontSize: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
    color: colors.textSecondary,
  },
  metaText: { fontSize: 12, color: colors.textSecondary, lineHeight: 19 },
  labelText: { color: colors.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  noticeBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.surface },
  noticeText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  webBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  fullBtn: { justifyContent: 'center', marginTop: spacing.md },
  webBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  emptyBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  footerNote: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.lg },
});
