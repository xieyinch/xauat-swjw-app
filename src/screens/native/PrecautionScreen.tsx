import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchPrecaution } from '../../api/data';
import { EmptyState } from '../../components/native/EmptyState';
import { NativePageShell } from '../../components/native/NativePageShell';
import { SectionCard } from '../../components/native/SectionCard';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { MenuFunction } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  fn: MenuFunction;
  onClose: () => void;
  onSessionExpired: () => void;
}

export function PrecautionScreen({ fn, onClose, onSessionExpired }: Props) {
  const load = useCallback(() => fetchPrecaution(), []);
  const { data, loading, error, refreshing, reload, retry } = useAsyncData({
    loader: load,
    deps: [],
    onSessionExpired,
  });

  return (
    <NativePageShell
      title={fn.title}
      loading={loading && !data}
      error={error}
      refreshing={refreshing}
      onClose={onClose}
      onReload={retry}
      onRefresh={reload}
    >
      {!loading && !error && data && data.length === 0 ? <EmptyState text="无预警数据" icon="checkmark-circle-outline" /> : null}
      <View style={styles.list}>
        {data?.map((item) => (
          <SectionCard key={item.index} title={item.courseName}>
            <View style={styles.row}>
              <Text style={styles.label}>课程代码</Text>
              <Text style={styles.value}>{item.courseCode}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>是否必修</Text>
              <Text style={styles.value}>{item.compulsory}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>学分</Text>
              <Text style={styles.value}>{item.credits}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>成绩</Text>
              <Text style={[styles.value, item.score === '不及格' ? styles.danger : null]}>{item.score}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>绩点</Text>
              <Text style={styles.value}>{item.gradePoint}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>系统检查情况</Text>
              <Text style={styles.value}>{item.checkResult}</Text>
            </View>
          </SectionCard>
        ))}
      </View>
    </NativePageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { flexDirection: 'row', paddingVertical: spacing.xs + 1, gap: spacing.lg },
  label: { width: 96, fontSize: 13, color: colors.textSecondary },
  value: { flex: 1, fontSize: 13, color: colors.text },
  danger: { color: colors.danger },
});
