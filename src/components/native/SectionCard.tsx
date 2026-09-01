import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** 分组卡片容器，用于学籍信息/培养方案等分区展示 */
export function SectionCard({ title, children, icon }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {icon ? <Ionicons name={icon} size={16} color={colors.primary} /> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
});
