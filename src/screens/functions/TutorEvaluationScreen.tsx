import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchTutorEvaluations } from '../../api/query';
import type { TutorEvaluation } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function TutorEvaluationScreen({ onClose, onSessionExpired }: Props) {
  const [items, setItems] = useState<TutorEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchTutorEvaluations();
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '评价记录加载失败');
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

  const renderItem = ({ item }: { item: TutorEvaluation }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.tutor}>{item.tutorName || '—'}</Text>
        <Text style={[styles.state, item.publishState === '已发布' ? styles.statePublished : null]}>
          {item.publishState || '—'}
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>所属学期</Text>
        <Text style={styles.value}>{item.semester || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>导师类型</Text>
        <Text style={styles.value}>{item.tutorType || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>得分</Text>
        <Text style={[styles.value, styles.score]}>{item.score || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>评价时间</Text>
        <Text style={styles.value}>{item.evaluateTime || '—'}</Text>
      </View>
    </View>
  );

  return (
    <FunctionShell title="评价导师" onClose={onClose}>
      <ListContainer
        loading={loading}
        error={error}
        onRetry={() => load()}
        emptyIcon="star-outline"
        emptyText="暂无评价记录"
      >
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={renderItem}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tutor: { fontSize: 15, fontWeight: '600', color: colors.text },
  state: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statePublished: { color: colors.primary, borderColor: colors.primary },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 13, color: colors.text },
  score: { fontSize: 16, color: colors.primary, fontWeight: '700' },
});
