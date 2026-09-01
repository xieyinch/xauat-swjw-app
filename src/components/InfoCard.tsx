import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

interface InfoRowProps {
  label: string;
  value: string;
  last?: boolean;
}

/** 单行键值信息（详情页用） */
export function InfoRow({ label, value, last }: InfoRowProps) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={4}>{value || '--'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { width: 100, fontSize: 13, color: colors.textSecondary },
  value: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500', lineHeight: 20 },
});

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
}

/** 分组卡片容器 */
export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <View style={cardStyles.card}>
      {title ? <Text style={cardStyles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, paddingVertical: spacing.md },
});
