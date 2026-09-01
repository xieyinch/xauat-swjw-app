import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchDegreeApplyRecords } from '../../api/query';
import type { DegreeApplyRecord } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function DegreeApplyScreen({ onClose, onSessionExpired }: Props) {
  const [items, setItems] = useState<DegreeApplyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchDegreeApplyRecords();
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '学位申请记录加载失败');
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

  const renderItem = ({ item }: { item: DegreeApplyRecord }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{item.studentName || '—'}</Text>
        <Text style={[styles.state, item.auditState === '通过' ? styles.statePass : null]}>{item.auditState || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>学年学期</Text>
        <Text style={styles.value}>{item.semester || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>培养类型</Text>
        <Text style={styles.value}>{item.trainingType || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>年级</Text>
        <Text style={styles.value}>{item.grade || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>学号</Text>
        <Text style={styles.value}>{item.studentNo || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>院系</Text>
        <Text style={styles.value}>{item.college || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.label}>专业</Text>
        <Text style={styles.value}>{item.major || '—'}</Text>
      </View>
    </View>
  );

  return (
    <FunctionShell title="授予学士学位申请" onClose={onClose}>
      <ListContainer
        loading={loading}
        error={error}
        onRetry={() => load()}
        emptyIcon="school-outline"
        emptyText="暂无学位申请记录"
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
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  state: {
    fontSize: 12,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statePass: { color: colors.primary, borderColor: colors.primary },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 13, color: colors.textSecondary },
  value: { fontSize: 13, color: colors.text },
});
