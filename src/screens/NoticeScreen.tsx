import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fetchNotices } from '../api/data';
import type { NoticeItem } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  onOpenNotice: (notice: NoticeItem) => void;
}

export function NoticeScreen({ onOpenNotice }: Props) {
  const [notices, setNotices] = React.useState<NoticeItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = useCallback(async (refresh?: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setNotices(await fetchNotices());
    } catch (e) {
      setError((e as Error).message || '通知加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notices ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListHeaderComponent={
            notices && notices.length ? <Text style={styles.count}>共 {notices.length} 条公告</Text> : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.noticeItem} onPress={() => onOpenNotice(item)} activeOpacity={0.6}>
              <View style={styles.noticeBody}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.date}>{item.date}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={40} color={colors.textSecondary} />
              <Text style={styles.emptyText}>暂无通知</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  count: { fontSize: 13, color: colors.textSecondary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  noticeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  noticeBody: { flex: 1, marginRight: spacing.sm },
  title: { fontSize: 15, color: colors.text, lineHeight: 21 },
  date: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm },
});
