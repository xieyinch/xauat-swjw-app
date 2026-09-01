import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchTutorChangeApplies } from '../../api/query';
import type { TutorChangeApply } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function TutorChangeApplyScreen({ onClose, onSessionExpired }: Props) {
  const [items, setItems] = useState<TutorChangeApply[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchTutorChangeApplies();
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '变更申请加载失败');
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

  const renderItem = ({ item }: { item: TutorChangeApply }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {item.beforeTutor || '—'} → {item.afterTutor || '—'}
        </Text>
        <Text style={styles.state}>{item.auditState || '—'}</Text>
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
        <Text style={styles.label}>申请时间</Text>
        <Text style={styles.value}>{item.applyTime || '—'}</Text>
      </View>
      {item.reason ? (
        <View style={styles.infoRow}>
          <Text style={styles.label}>申请理由</Text>
          <Text style={[styles.value, styles.reason]} numberOfLines={2}>
            {item.reason}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <FunctionShell title="导师变更申请" onClose={onClose}>
      <ListContainer
        loading={loading}
        error={error}
        onRetry={() => load()}
        emptyIcon="swap-horizontal-outline"
        emptyText="暂无变更申请记录"
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
  title: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
  state: {
    fontSize: 12,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 13, color: colors.textSecondary, marginRight: spacing.sm },
  value: { fontSize: 13, color: colors.text, flexShrink: 1, textAlign: 'right' },
  reason: { maxWidth: '65%' },
});
