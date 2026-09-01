import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SITE } from '../../config/site';
import { fetchCommonFiles } from '../../api/data';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { MenuFunction } from '../../types';
import { colors, spacing } from '../../theme';
import { EmptyState } from '../../components/native/EmptyState';
import { NativePageShell } from '../../components/native/NativePageShell';

const FILE_TYPES: Array<{ value: string | null; label: string }> = [
  { value: null, label: '全部' },
  { value: '1', label: '教学培养' },
  { value: '2', label: '学籍学位' },
  { value: '3', label: '成绩考试' },
];

interface Props {
  fn: MenuFunction;
  onClose: () => void;
  onSessionExpired: () => void;
}

export function CommonFileScreen({ fn, onClose, onSessionExpired }: Props) {
  const [type, setType] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [submittedKw, setSubmittedKw] = useState('');
  const [submittedType, setSubmittedType] = useState<string | null>(null);

  const load = useCallback(
    () => fetchCommonFiles(submittedKw, submittedType),
    [submittedKw, submittedType],
  );
  const { data, loading, error, refreshing, reload, retry } = useAsyncData({
    loader: load,
    deps: [submittedKw, submittedType],
    onSessionExpired,
  });

  const handleSearch = () => {
    setSubmittedKw(keyword.trim());
    setSubmittedType(type);
  };

  const handleDownload = (key: string) => {
    // 文件需登录态下载，交给系统浏览器（复用 WebView 会话失败时用户可自行登录）
    Linking.openURL(`${SITE.swjw}/student/common-file/download-by-key/${key}`).catch(() => undefined);
  };

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
      <View style={styles.filters}>
        <View style={styles.typeRow}>
          {FILE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.chip, type === t.value ? styles.chipActive : null]}
              onPress={() => setType(t.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, type === t.value ? styles.chipTextActive : null]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.input}
              placeholder="输入文件关键字"
              placeholderTextColor={colors.textSecondary}
              value={keyword}
              onChangeText={setKeyword}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.7}>
            <Text style={styles.searchBtnText}>查询</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!loading && !error && data && data.length === 0 ? <EmptyState text="暂无文件" /> : null}

      <View style={styles.list}>
        {data?.map((f, idx) => (
          <TouchableOpacity key={`${f.key}-${idx}`} style={styles.item} activeOpacity={0.6} onPress={() => handleDownload(f.key)}>
            <View style={styles.itemIcon}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.itemBody}>
              <Text style={styles.itemName} numberOfLines={2}>{f.name}</Text>
              <View style={styles.itemMeta}>
                <Text style={styles.itemType}>{f.typeName}</Text>
                <Text style={styles.itemTime}>{f.publishTime}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </NativePageShell>
  );
}

const styles = StyleSheet.create({
  filters: { marginBottom: spacing.lg },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: `${colors.primary}1A`, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: colors.primary, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    height: 38,
  },
  input: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  searchBtn: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: `${colors.primary}1A`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, color: colors.text, fontWeight: '600' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemType: { fontSize: 12, color: colors.primary },
  itemTime: { fontSize: 12, color: colors.textSecondary },
});
