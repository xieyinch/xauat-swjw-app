import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchProgram } from '../../api/query';
import { getStudentInfoCached } from '../../api/data';
import type { ProgramCourse, ProgramModule } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

interface FlattenNode {
  depth: number;
  id: number;
  name: string;
  meta: string;
  childrenCount: number;
  isModule: boolean;
}

function flatten(module: ProgramModule, depth = 0): FlattenNode[] {
  const node: FlattenNode = {
    depth,
    id: module.id,
    name: module.name,
    meta: module.requireCredits != null ? `要求 ${module.requireCredits} 学分` : module.typeName ?? '',
    childrenCount: module.children.length,
    isModule: module.children.length > 0,
  };
  const result = [node];
  for (const child of module.children) {
    result.push(...flatten(child, depth + 1));
  }
  return result;
}

export function ProgramScreen({ onClose, onSessionExpired }: Props) {
  const [nodes, setNodes] = useState<FlattenNode[]>([]);
  const [courses, setCourses] = useState<ProgramCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [showCourses, setShowCourses] = useState(false);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const info = await getStudentInfoCached();
        const data = await fetchProgram(info.studentId);
        setCourses(data.courses);
        setNodes(flatten(data.root));
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '培养方案加载失败');
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

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visible = nodes.filter(
    (n, idx) => !nodes.slice(0, idx).some((p) => p.isModule && p.depth < n.depth && collapsed.has(p.id)),
  );

  return (
    <FunctionShell title="我的培养方案" onClose={onClose}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, !showCourses && styles.tabActive]} onPress={() => setShowCourses(false)}>
          <Text style={[styles.tabText, !showCourses && styles.tabTextActive]}>模块结构</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, showCourses && styles.tabActive]} onPress={() => setShowCourses(true)}>
          <Text style={[styles.tabText, showCourses && styles.tabTextActive]}>全部课程</Text>
        </TouchableOpacity>
      </View>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无培养方案">
        {showCourses ? (
          <FlatList
            data={courses}
            keyExtractor={(item, idx) => `${item.code}-${idx}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            renderItem={({ item }) => (
              <View style={styles.courseCard}>
                <View style={styles.courseHeader}>
                  <Text style={styles.courseName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.credits}>{item.credits} 学分</Text>
                </View>
                <Text style={styles.courseMeta}>
                  {[item.code, item.courseType].filter(Boolean).join(' · ')}
                </Text>
              </View>
            )}
          />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => String(item.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.node, { paddingLeft: spacing.lg + item.depth * 16 }]}
                onPress={item.isModule ? () => toggleCollapse(item.id) : undefined}
                activeOpacity={item.isModule ? 0.6 : 1}
              >
                {item.isModule ? (
                  <Ionicons
                    name={collapsed.has(item.id) ? 'chevron-forward' : 'chevron-down'}
                    size={16}
                    color={colors.textSecondary}
                  />
                ) : (
                  <View style={styles.dot} />
                )}
                <View style={styles.nodeMain}>
                  <Text style={[styles.nodeName, !item.isModule && styles.courseName2]} numberOfLines={1}>{item.name}</Text>
                  {item.meta ? <Text style={styles.nodeMeta} numberOfLines={1}>{item.meta}</Text> : null}
                </View>
                {item.isModule ? <Text style={styles.nodeCount}>{item.childrenCount}</Text> : null}
              </TouchableOpacity>
            )}
          />
        )}
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: 10, overflow: 'hidden' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.text },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary, marginHorizontal: 5 },
  nodeMain: { flex: 1 },
  nodeName: { fontSize: 14, fontWeight: '600', color: colors.text },
  courseName2: { fontWeight: '400' },
  nodeMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  nodeCount: { fontSize: 12, color: colors.textSecondary },
  courseCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  courseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, marginRight: spacing.sm },
  credits: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  courseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
});
