import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchGuidanceRecords } from '../../api/query';
import type { GuidanceRecord } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function GuidanceRecordScreen({ onClose, onSessionExpired }: Props) {
  const [records, setRecords] = useState<GuidanceRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchGuidanceRecords();
        setRecords(data.records);
        setTotalCount(data.totalCount);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '指导记录加载失败');
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
    <FunctionShell title="指导过程查看" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyIcon="chatbubbles-outline" emptyText="暂无指导记录">
        {records.length ? <Text style={styles.summary}>累计被指导 {totalCount} 次</Text> : null}
        <FlatList
          data={records}
          keyExtractor={(item, idx) => `${item.name}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.name}</Text>
              {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
              {item.content ? <Text style={styles.content}>{item.content}</Text> : null}
              {item.attendance ? <Text style={styles.meta}>出席情况：{item.attendance}</Text> : null}
            </View>
          )}
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  content: { fontSize: 13, color: colors.text, marginTop: 8, lineHeight: 20 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
});
