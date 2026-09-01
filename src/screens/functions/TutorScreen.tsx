import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchTutor } from '../../api/query';
import type { TutorInfo } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

const FIELDS: Array<{ key: keyof TutorInfo; label: string }> = [
  { key: 'name', label: '导师姓名' },
  { key: 'department', label: '所属部门' },
  { key: 'title', label: '职称' },
  { key: 'tutorType', label: '导师类型' },
  { key: 'period', label: '聘期' },
  { key: 'phone', label: '联系电话' },
  { key: 'email', label: '邮箱' },
];

export function TutorScreen({ onClose, onSessionExpired }: Props) {
  const [tutor, setTutor] = useState<TutorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchTutor();
        setTutor(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '导师信息加载失败');
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
    <FunctionShell title="我的导师" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyIcon="people-outline" emptyText="暂无导师">
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
          {tutor ? (
            <View style={styles.card}>
              <View style={styles.avatarWrap}>
                <Ionicons name="person-circle-outline" size={56} color={colors.primary} />
              </View>
              <Text style={styles.tutorName}>{tutor.name}</Text>
              {FIELDS.map((f) =>
                tutor[f.key] ? (
                  <View key={f.key} style={styles.row}>
                    <Text style={styles.label}>{f.label}</Text>
                    <Text style={styles.value}>{tutor[f.key]}</Text>
                  </View>
                ) : null,
              )}
            </View>
          ) : null}
        </ScrollView>
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
  },
  avatarWrap: { marginTop: spacing.sm },
  tutorName: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: spacing.sm, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  label: { width: 90, fontSize: 13, color: colors.textSecondary },
  value: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
});
