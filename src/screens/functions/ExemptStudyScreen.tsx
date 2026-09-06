import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { getStudentInfoCached } from '../../api/data';
import { exemptNewHref, fetchExemptGrades, fetchExemptStudyData } from '../../api/query';
import type { ExemptApplyRecord, ExemptApplyWindow, ExemptGradeItem } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
  openWebPage?: (title: string, path: string) => void;
}

type TabKey = 'apply' | 'grade';

function stateTone(state: string): string {
  const s = state || '';
  if (s.includes('通过')) return colors.success;
  if (s.includes('不通过') || s.includes('驳回') || s.includes('退回') || s.includes('拒绝') || s.includes('未通过')) {
    return colors.danger;
  }
  return colors.warning;
}

function WindowCard({ window, onNewApply }: { window: ExemptApplyWindow; onNewApply: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.infoText}>免修申请时间：{window.applyTimeText || '—'}</Text>
      </View>
      {window.bulletin ? (
        <View style={styles.bulletinBox}>
          <Text style={styles.bulletinText}>{window.bulletin}</Text>
        </View>
      ) : null}
      <TouchableOpacity style={styles.newBtn} onPress={onNewApply}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.newBtnText}>新建免修申请</Text>
      </TouchableOpacity>
    </View>
  );
}

function RecordCard({ item }: { item: ExemptApplyRecord }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.courseText} numberOfLines={3}>{item.courseText || '—'}</Text>
        <Text style={[styles.stateChip, { color: stateTone(item.auditState), borderColor: stateTone(item.auditState) }]}>
          {item.auditState || '—'}
        </Text>
      </View>
      <Text style={styles.metaText}>学期：{item.semester || '—'}</Text>
      <Text style={styles.metaText}>申请日期：{item.applyDate || '—'}</Text>
      {item.reason ? <Text style={styles.metaText}>申请原因：{item.reason}</Text> : null}
    </View>
  );
}

function GradeCard({ item }: { item: ExemptGradeItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.courseText} numberOfLines={3}>{item.courseText || '—'}</Text>
        <Text style={styles.gradeText}>{item.grade || '—'}</Text>
      </View>
      <Text style={styles.metaText}>学期：{item.semester || '—'}</Text>
      <Text style={styles.metaText}>是否加入成绩库：{item.inGradeBook || '—'}</Text>
    </View>
  );
}

export function ExemptStudyScreen({ onClose, onSessionExpired, openWebPage }: Props) {
  const [tab, setTab] = useState<TabKey>('apply');
  const [studentId, setStudentId] = useState(0);
  const [semesterId, setSemesterId] = useState<number | undefined>(undefined);
  const [windowInfo, setWindowInfo] = useState<ExemptApplyWindow | null>(null);
  const [records, setRecords] = useState<ExemptApplyRecord[]>([]);
  const [grades, setGrades] = useState<ExemptGradeItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApply = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const info = await getStudentInfoCached();
        setStudentId(info.studentId);
        const data = await fetchExemptStudyData();
        setWindowInfo(data.window);
        setRecords(data.records);
        setSemesterId(data.semesterId);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '免修申请加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onSessionExpired],
  );

  const loadGrades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await getStudentInfoCached();
      setStudentId(info.studentId);
      const list = await fetchExemptGrades();
      setGrades(list);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
      setError((e as Error).message || '免修成绩加载失败');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    loadApply();
  }, [loadApply]);

  useEffect(() => {
    if (tab === 'grade' && grades == null) {
      loadGrades();
    }
  }, [tab, grades, loadGrades]);

  const handleRefresh = useCallback(() => {
    if (tab === 'apply') loadApply(true);
    else loadGrades();
  }, [tab, loadApply, loadGrades]);

  const content =
    tab === 'apply' ? (
      <FlatList
        data={records}
        keyExtractor={(item, index) => `${item.applyDate}-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListHeaderComponent={
          windowInfo ? (
            <WindowCard
              window={windowInfo}
              onNewApply={() => {
                if (studentId && openWebPage) {
                  openWebPage('免修申请 - 新建', exemptNewHref(studentId, semesterId));
                }
              }}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={34} color={colors.textSecondary} />
            <Text style={styles.emptyText}>暂无免修申请记录</Text>
          </View>
        }
        renderItem={({ item }) => <RecordCard item={item} />}
      />
    ) : (
      <FlatList
        data={grades ?? []}
        keyExtractor={(item, index) => `${item.courseText}-${index}`}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="school-outline" size={34} color={colors.textSecondary} />
            <Text style={styles.emptyText}>暂无免修成绩</Text>
          </View>
        }
        renderItem={({ item }) => <GradeCard item={item} />}
      />
    );

  return (
    <FunctionShell title="免修申请" onClose={onClose}>
      <View style={styles.segRow}>
        {(
          [
            { key: 'apply', label: '我的申请' },
            { key: 'grade', label: '免修成绩' },
          ] as { key: TabKey; label: string }[]
        ).map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.segItem, active && styles.segActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.segText, active && styles.segActiveText]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ListContainer loading={loading} error={error} onRetry={handleRefresh}>
        {content}
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  segRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: 2,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  segActive: { backgroundColor: colors.primary },
  segText: { fontSize: 13, color: colors.textSecondary },
  segActiveText: { color: '#fff', fontWeight: '600' },
  listContent: { paddingBottom: spacing.xl },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  courseText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, marginRight: spacing.sm, lineHeight: 20 },
  stateChip: {
    fontSize: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  gradeText: { fontSize: 17, fontWeight: '700', color: colors.primary },
  metaText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  bulletinBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.surface },
  bulletinText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyBox: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { fontSize: 13, color: colors.textSecondary },
});
