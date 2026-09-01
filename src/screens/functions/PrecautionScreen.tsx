import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchPrecaution } from '../../api/query';
import type { PrecautionItem } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function PrecautionScreen({ onClose, onSessionExpired }: Props) {
  const [items, setItems] = useState<PrecautionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchPrecaution();
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '学业预警加载失败');
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
    <FunctionShell title="学业预警" onClose={onClose}>
      <ListContainer
        loading={loading}
        error={error}
        onRetry={() => load()}
        emptyIcon="shield-checkmark-outline"
        emptyText="无预警数据"
      >
        <FlatList
          data={items}
          keyExtractor={(item, idx) => `${item.courseCode}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.nameWrap}>
                  <Text style={styles.courseName} numberOfLines={1}>{item.courseName}</Text>
                  <Text style={styles.courseCode}>{item.courseCode}</Text>
                </View>
                <Text style={[styles.score, item.score !== '未通过' && item.score !== '不及格' ? styles.scoreOk : styles.scoreBad]}>
                  {item.score}
                </Text>
              </View>
              <Text style={styles.meta}>
                {[item.required ? '必修' : '选修', item.credits != null ? `${item.credits} 学分` : '', item.gradePoint ? `绩点 ${item.gradePoint}` : ''].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.checkResult} numberOfLines={3}>检查结果：{item.checkResult}</Text>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nameWrap: { flex: 1, marginRight: spacing.md },
  courseName: { fontSize: 15, fontWeight: '600', color: colors.text },
  courseCode: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  score: { fontSize: 18, fontWeight: '700', color: colors.danger },
  scoreOk: { color: colors.success },
  scoreBad: { color: colors.danger },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  checkResult: { fontSize: 12, color: colors.warning, marginTop: 6, lineHeight: 18 },
});
