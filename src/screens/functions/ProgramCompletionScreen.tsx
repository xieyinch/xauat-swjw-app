import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchProgramCompletion } from '../../api/query';
import { getStudentInfoCached } from '../../api/data';
import type { ProgramCompletion } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function ProgramCompletionScreen({ onClose, onSessionExpired }: Props) {
  const [data, setData] = useState<ProgramCompletion | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'passed' | 'failed'>('passed');

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const info = await getStudentInfoCached();
        const result = await fetchProgramCompletion(info.studentId);
        setData(result);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '完成情况加载失败');
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

  const courses = data ? (tab === 'passed' ? data.passedCourses : data.failedCourses) : [];

  return (
    <FunctionShell title="培养方案完成情况" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无完成情况数据">
        {data ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{data.requireCredits}</Text>
                <Text style={styles.statLabel}>要求学分</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.success }]}>{data.passedCredits}</Text>
                <Text style={styles.statLabel}>已修学分</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.danger }]}>{data.failedCredits}</Text>
                <Text style={styles.statLabel}>未修学分</Text>
              </View>
            </View>
            <View style={styles.tabs}>
              <TouchableOpacity style={[styles.tab, tab === 'passed' && styles.tabActive]} onPress={() => setTab('passed')}>
                <Text style={[styles.tabText, tab === 'passed' && styles.tabTextActive]}>已修课程 ({data.passedCourses.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, tab === 'failed' && styles.tabActive]} onPress={() => setTab('failed')}>
                <Text style={[styles.tabText, tab === 'failed' && styles.tabTextActive]}>未修课程 ({data.failedCourses.length})</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={courses}
              keyExtractor={(item, idx) => `${item.code}-${idx}`}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
              renderItem={({ item }) => (
                <View style={styles.courseCard}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseName} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.credits, tab === 'failed' && { color: colors.danger }]}>{item.credits} 学分</Text>
                  </View>
                  <Text style={styles.courseMeta}>
                    {[item.code, item.courseType].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              )}
            />
          </>
        ) : null}
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.text },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  courseCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  credits: { fontSize: 13, color: colors.success, fontWeight: '600' },
  courseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
});
