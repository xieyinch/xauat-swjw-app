import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchTutorSelectResult } from '../../api/query';
import type { TutorSelectResult } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function TutorSelectResultScreen({ onClose, onSessionExpired }: Props) {
  const [items, setItems] = useState<TutorSelectResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchTutorSelectResult();
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '互选结果加载失败');
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
    <FunctionShell title="导师互选结果查询" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyIcon="people-outline" emptyText="暂无互选结果">
        <FlatList
          data={items}
          keyExtractor={(item, idx) => `${item.stdNo}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.tutorName}>{item.tutorName}</Text>
                <Text style={styles.tutorType}>{item.tutorType}</Text>
              </View>
              <Text style={styles.meta}>导师所属：{item.tutorDepartment}</Text>
              <Text style={styles.meta}>学生：{item.studentName}（{item.stdNo}）</Text>
              <Text style={styles.meta}>
                {[item.grade, item.department, item.major].filter(Boolean).join(' · ')}
              </Text>
              {item.period ? <Text style={styles.meta}>聘期：{item.period}</Text> : null}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tutorName: { fontSize: 16, fontWeight: '700', color: colors.text },
  tutorType: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
});
