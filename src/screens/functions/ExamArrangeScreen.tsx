import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchExamArrange } from '../../api/query';
import type { ExamArrangeItem } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function ExamArrangeScreen({ onClose, onSessionExpired }: Props) {
  const [items, setItems] = useState<ExamArrangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchExamArrange();
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '考试信息加载失败');
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

  return (
    <FunctionShell title="考试信息" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无考试安排">
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.courseName} numberOfLines={1}>{item.courseName}</Text>
                {item.seatNo ? <Text style={styles.seat}>座位 {item.seatNo}</Text> : null}
              </View>
              <Text style={styles.time}>{item.timeText}</Text>
              <Text style={styles.meta}>
                {[item.place, item.building, item.campus].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  seat: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  time: { fontSize: 14, color: colors.text, marginTop: spacing.sm, fontWeight: '500' },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
});
