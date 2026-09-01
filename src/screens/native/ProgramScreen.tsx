import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getStudentInfoCached, fetchProgram } from '../../api/data';
import { EmptyState } from '../../components/native/EmptyState';
import { NativePageShell } from '../../components/native/NativePageShell';
import { SectionCard } from '../../components/native/SectionCard';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { MenuFunction, ProgramModule } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  fn: MenuFunction;
  onClose: () => void;
  onSessionExpired: () => void;
}

interface TreeNodeProps {
  module: ProgramModule;
  depth: number;
  defaultExpanded: boolean;
}

function TreeNode({ module, depth, defaultExpanded }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = module.children.length > 0;
  const hasCourses = module.courses.length > 0;

  return (
    <View>
      <TouchableOpacity
        style={[styles.nodeRow, { paddingLeft: spacing.md + depth * 14 }]}
        activeOpacity={0.6}
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.nodeArrow}>{hasChildren ? (expanded ? '▾' : '▸') : '•'}</Text>
        <Text style={styles.nodeText} numberOfLines={2}>
          {module.nameZh}
        </Text>
        {module.requiredCredits ? <Text style={styles.nodeCredits}>{module.requiredCredits}学分</Text> : null}
      </TouchableOpacity>
      {expanded && hasChildren ? (
        <View>
          {module.children.map((c) => (
            <TreeNode key={c.id} module={c} depth={depth + 1} defaultExpanded={false} />
          ))}
          {module.courses.map((c, i) => (
            <View key={`${c.code}-${i}`} style={[styles.courseRow, { paddingLeft: spacing.md + (depth + 1) * 14 }]}>
              <Text style={styles.courseName} numberOfLines={2}>{c.nameZh}</Text>
              <Text style={styles.courseCredits}>{c.credits != null ? `${c.credits}学分` : ''}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {expanded && !hasChildren && hasCourses ? (
        <View>
          {module.courses.map((c, i) => (
            <View key={`${c.code}-${i}`} style={[styles.courseRow, { paddingLeft: spacing.md + (depth + 1) * 14 }]}>
              <Text style={styles.courseName} numberOfLines={2}>{c.nameZh}</Text>
              <Text style={styles.courseCredits}>{c.credits != null ? `${c.credits}学分` : ''}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ProgramScreen({ fn, onClose, onSessionExpired }: Props) {
  const load = useCallback(async () => {
    const info = await getStudentInfoCached();
    return fetchProgram(info.studentId);
  }, []);

  const { data, loading, error, refreshing, reload, retry } = useAsyncData({
    loader: load,
    deps: [],
    onSessionExpired,
  });

  const topModules = useMemo(() => data?.root.children ?? [], [data]);
  const courseCount = useMemo(() => {
    let n = 0;
    const walk = (mods: ProgramModule[]) => {
      for (const m of mods) {
        n += m.courses.length;
        walk(m.children);
      }
    };
    walk(topModules);
    return n;
  }, [topModules]);

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
      {!loading && !error && data ? (
        <>
          <SectionCard title="培养方案概览" icon="reader-outline">
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>课程模块</Text>
              <Text style={styles.summaryValue}>{data.root.nameZh || '-'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>计划课程</Text>
              <Text style={styles.summaryValue}>{courseCount} 门</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>点击模块展开</Text>
              <Text style={styles.summaryValue}>▸</Text>
            </View>
          </SectionCard>
          {topModules.length === 0 ? (
            <EmptyState text="暂无培养方案" icon="reader-outline" />
          ) : (
            <SectionCard title="课程结构">
              {topModules.map((m) => (
                <TreeNode key={m.id} module={m} depth={0} defaultExpanded={true} />
              ))}
            </SectionCard>
          )}
        </>
      ) : null}
    </NativePageShell>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  summaryLabel: { fontSize: 13, color: colors.textSecondary },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '600' },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  nodeArrow: { width: 14, fontSize: 13, color: colors.primary },
  nodeText: { flex: 1, fontSize: 13, color: colors.text, fontWeight: '600' },
  nodeCredits: { fontSize: 12, color: colors.primary },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  courseName: { flex: 1, fontSize: 12.5, color: colors.text },
  courseCredits: { fontSize: 12, color: colors.textSecondary },
});
