import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchEvaluationResults } from '../../api/query';
import type { EvaluationResult } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function EvaluationResultScreen({ onClose, onSessionExpired }: Props) {
  const [items, setItems] = useState<EvaluationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchEvaluationResults();
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '被评结果加载失败');
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
    <FunctionShell title="我的被评结果" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyIcon="stats-chart-outline" emptyText="暂无被评结果">
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.courseName}</Text>
              {item.scores.length ? (
                <View style={styles.scoresWrap}>
                  {item.scores.map((s, idx) => (
                    <View key={idx} style={styles.scoreRow}>
                      <Text style={styles.scoreName}>{s.name}</Text>
                      <Text style={styles.scoreValue}>{s.score}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {item.totalScore ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>总分</Text>
                  <Text style={styles.totalValue}>{item.totalScore}</Text>
                </View>
              ) : null}
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
  },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  scoresWrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  scoreName: { fontSize: 13, color: colors.textSecondary },
  scoreValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm },
  totalLabel: { fontSize: 13, color: colors.text, fontWeight: '600' },
  totalValue: { fontSize: 16, color: colors.primary, fontWeight: '700' },
});
