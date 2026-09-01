import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../theme';

interface ListContainerProps {
  loading: boolean;
  error?: string | null;
  empty?: React.ReactNode;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
  emptyText?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

/** 通用数据列表容器：loading / error / empty / 正常内容 */
export function ListContainer({
  loading,
  error,
  empty,
  emptyIcon = 'file-tray-outline',
  emptyText = '暂无数据',
  onRetry,
  children,
}: ListContainerProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
        <Text style={styles.errorText}>{error}</Text>
        {onRetry ? (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
  if (empty != null) return <>{empty}</>;
  return <View style={styles.flex}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  errorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
