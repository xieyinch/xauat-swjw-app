import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing } from '../../theme';

interface Props {
  title: string;
  loading?: boolean;
  error?: string | null;
  refreshing?: boolean;
  children: React.ReactNode;
  onClose: () => void;
  onReload?: () => void;
  onRefresh?: () => void;
}

/**
 * 原生子页面外壳：标题栏（返回/刷新）+ 内容区。
 * 与 FunctionPageScreen 的 WebView 外壳保持一致的顶部栏风格，方便从「全部」无缝进入。
 */
export function NativePageShell({ title, loading, error, refreshing, children, onClose, onReload, onRefresh }: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleBack = useCallback(() => {
    onCloseRef.current();
    return true;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.actions}>
          {onReload ? (
            <TouchableOpacity onPress={onReload} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="refresh-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{error}</Text>
          {onReload ? (
            <TouchableOpacity style={styles.retryBtn} onPress={onReload}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : onRefresh ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          refreshControl={<RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />}
        >
          {children}
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
          {children}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  btn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center' },
  content: { flex: 1 },
  contentInner: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
