import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getStudentInfoCached, fetchTutorSelectResult } from '../../api/data';
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

export function TutorSelectResultScreen({ fn, onClose, onSessionExpired }: Props) {
  const load = useCallback(async () => {
    const info = await getStudentInfoCached();
    return fetchTutorSelectResult(info.studentId);
  }, []);
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
      {!loading && !error && data && data.length === 0 ? <EmptyState text="暂无互选结果" icon="people-outline" /> : null}
      <View style={styles.list}>
        {data?.map((item, idx) => (
          <SectionCard key={`${item.stdNo}-${idx}`} title={`${item.tutorName || '导师'} · ${item.tutorType || ''}`.replace(' · ', ' ').trim() || '导师信息'}>
            <View style={styles.row}>
              <Text style={styles.label}>学生</Text>
              <Text style={styles.value}>{item.studentName}（{item.stdNo}）</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>专业</Text>
              <Text style={styles.value}>{item.grade} {item.college} {item.major}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>导师部门</Text>
              <Text style={styles.value}>{item.tutorDept}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>聘期(年)</Text>
              <Text style={styles.value}>{item.termYears}</Text>
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
  label: { width: 80, fontSize: 13, color: colors.textSecondary },
  value: { flex: 1, fontSize: 13, color: colors.text },
});
