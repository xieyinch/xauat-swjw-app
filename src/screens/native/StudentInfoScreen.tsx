import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchStudentInfoDetail } from '../../api/data';
import { EmptyState } from '../../components/native/EmptyState';
import { FieldTable } from '../../components/native/FieldTable';
import { NativePageShell } from '../../components/native/NativePageShell';
import { SectionCard } from '../../components/native/SectionCard';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { MenuFunction } from '../../types';
import { colors } from '../../theme';

interface Props {
  fn: MenuFunction;
  onClose: () => void;
  onSessionExpired: () => void;
}

const SECTION_ICONS: Record<string, keyof typeof import('@expo/vector-icons').Ionicons.glyphMap> = {
  baseInfo: 'person-circle-outline',
  recruitInfo: 'school-outline',
  registrationInfo: 'create-outline',
  stdAlterInfo: 'swap-horizontal-outline',
  graduateInfo: 'ribbon-outline',
  degreeInfo: 'shield-checkmark-outline',
  aboardInfo: 'airplane-outline',
  experiences: 'briefcase-outline',
  contactInfo: 'call-outline',
  familyMember: 'people-outline',
};

export function StudentInfoScreen({ fn, onClose, onSessionExpired }: Props) {
  const load = useCallback(() => fetchStudentInfoDetail(), []);
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
      {data && data.sections.length === 0 ? <EmptyState text="暂无学籍信息" icon="person-outline" /> : null}
      {data?.sections.map((sec) => (
        <SectionCard key={sec.key} title={sec.title} icon={SECTION_ICONS[sec.key]}>
          <FieldTable fields={sec.fields} />
        </SectionCard>
      ))}
      <View style={styles.footer}>
        <Text style={styles.footerText}>数据来自教务系统</Text>
      </View>
    </NativePageShell>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', paddingVertical: 4 },
  footerText: { fontSize: 12, color: colors.textSecondary },
});
