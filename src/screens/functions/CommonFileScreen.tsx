import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchCommonFileCategories, fetchCommonFiles } from '../../api/query';
import type { CommonFileItem } from '../../types';
import { SITE } from '../../config/site';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function CommonFileScreen({ onClose, onSessionExpired }: Props) {
  const [categories, setCategories] = useState<Array<{ id: number; nameZh: string }>>([]);
  const [category, setCategory] = useState<number | null>(null);
  const [items, setItems] = useState<CommonFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const list = await fetchCommonFileCategories();
      setCategories(list);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') {
        onSessionExpired();
        return;
      }
    }
  }, [onSessionExpired]);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchCommonFiles(category ?? undefined);
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '文件列表加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [category, onSessionExpired],
  );

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = useCallback((item: CommonFileItem) => {
    Linking.openURL(`${SITE.swjw}${item.downloadUrl}`).catch(() => {});
  }, []);

  return (
    <FunctionShell title="常用文件下载" onClose={onClose}>
      <View style={styles.filters}>
        <View style={styles.chipRow}>
          <TouchableOpacity style={[styles.chip, category == null && styles.chipActive]} onPress={() => setCategory(null)}>
            <Text style={[styles.chipText, category == null && styles.chipTextActive]}>全部</Text>
          </TouchableOpacity>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, category === c.id && styles.chipActive]}
              onPress={() => setCategory(c.id)}
            >
              <Text style={[styles.chipText, category === c.id && styles.chipTextActive]}>{c.nameZh}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无文件">
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => handleDownload(item)}>
              <View style={styles.iconWrap}>
                <Ionicons name="document-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.main}>
                <Text style={styles.fileName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.meta}>
                  {[item.category, item.sizeText].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.date}>{item.publishDate}</Text>
                <Ionicons name="download-outline" size={18} color={colors.primary} />
              </View>
            </TouchableOpacity>
          )}
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}1A`,
    marginRight: spacing.md,
  },
  main: { flex: 1, marginRight: spacing.md },
  fileName: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 20 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  right: { alignItems: 'flex-end', gap: spacing.xs },
  date: { fontSize: 11, color: colors.textSecondary },
});
