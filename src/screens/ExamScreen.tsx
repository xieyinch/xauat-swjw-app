import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchExams } from '../api/data';
import type { ExamItem } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  onSessionExpired: () => void;
}

export function ExamScreen({ onSessionExpired }: Props) {
  const [exams, setExams] = React.useState<ExamItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchExams();
        setExams(list);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '考试安排加载失败');
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

  const sorted = useMemo(() => {
    const list = exams ?? [];
    return list.slice().sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }, [exams]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item, idx) => `${item.courseName}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={
            exams && exams.length ? <Text style={styles.count}>共 {exams.length} 场考试</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.examCard}>
              <View style={styles.examTime}>
                <Text style={styles.dateText}>{item.dateTime.split(' ')[0] ?? item.dateTime}</Text>
                <Text style={styles.timeText}>{item.dateTime.split(' ')[1] ?? ''}</Text>
              </View>
              <View style={styles.examBody}>
                <Text style={styles.courseName} numberOfLines={2}>{item.courseName}</Text>
                <Text style={styles.meta}>
                  <Ionicons name="location-outline" size={12} color={colors.textSecondary} /> {item.place}
                  {item.building ? ` · ${item.building}` : ''}
                  {item.campus ? ` · ${item.campus}` : ''}
                </Text>
                {item.seatNo ? <Text style={styles.meta}>座位号：{item.seatNo}</Text> : null}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="time-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyText}>当前暂无考试安排</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  count: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  examCard: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  examTime: {
    width: 92,
    marginRight: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  timeText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  examBody: { flex: 1 },
  courseName: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});
