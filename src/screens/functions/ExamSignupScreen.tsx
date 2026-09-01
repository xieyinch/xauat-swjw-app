import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchExamSignup } from '../../api/query';
import type { ExamScoreItem, ExamSignupItem } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function ExamSignupScreen({ onClose, onSessionExpired }: Props) {
  const [signupItems, setSignupItems] = useState<ExamSignupItem[]>([]);
  const [scoreItems, setScoreItems] = useState<ExamScoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchExamSignup();
        setSignupItems(data.signupItems);
        setScoreItems(data.scoreItems);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '等级考试加载失败');
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
    <FunctionShell title="等级考试" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()}>
        <FlatList
          data={['signup', 'score']}
          keyExtractor={(key) => key}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) =>
            item === 'signup' ? (
              <View>
                <Text style={styles.sectionTitle}>报名信息</Text>
                {signupItems.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>暂无报名信息</Text>
                  </View>
                ) : (
                  signupItems.map((s, idx) => (
                    <View key={idx} style={styles.card}>
                      <Text style={styles.name}>{s.subject}</Text>
                      <Text style={styles.meta}>批次：{s.batch}</Text>
                      {s.place ? <Text style={styles.meta}>地点：{s.place}</Text> : null}
                      {s.arrangement ? <Text style={styles.meta}>安排：{s.arrangement}</Text> : null}
                      <Text style={styles.meta}>报名时间：{s.signupTime}</Text>
                      <Text style={styles.meta}>费用：{s.fee || '--'} · 缴费状态：{s.payStatus || '--'}</Text>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View>
                <Text style={styles.sectionTitle}>我的成绩</Text>
                {scoreItems.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>暂无成绩</Text>
                  </View>
                ) : (
                  scoreItems.map((s, idx) => (
                    <View key={idx} style={styles.card}>
                      <View style={styles.scoreHeader}>
                        <Text style={styles.name}>{s.subject}</Text>
                        <Text style={[styles.score, s.passed === '是' && styles.passed]}>{s.score}</Text>
                      </View>
                      <Text style={styles.meta}>考试种类：{s.examType}</Text>
                      <Text style={styles.meta}>是否通过：{s.passed || '--'} {s.certNo ? ` · 证书：${s.certNo}` : ''}</Text>
                    </View>
                  ))
                )}
              </View>
            )
          }
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  score: { fontSize: 18, fontWeight: '700', color: colors.text },
  passed: { color: colors.success },
  emptyBox: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.xl,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: colors.textSecondary },
});
