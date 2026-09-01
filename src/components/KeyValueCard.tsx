import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import type { StudentInfoEntry } from '../types';

interface KeyValueCardProps {
  title: string;
  entries: StudentInfoEntry[];
}

/** 键值对卡片：每行三列（标签-值-标签-值） */
export function KeyValueCard({ title, entries }: KeyValueCardProps) {
  const rows: StudentInfoEntry[][] = [];
  for (let i = 0; i < entries.length; i += 2) {
    rows.push(entries.slice(i, i + 2));
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {rows.map((row, idx) => (
        <View key={idx} style={[styles.row, idx === rows.length - 1 && styles.lastRow]}>
          {row.map((e, j) => (
            <View key={j} style={[styles.cell, j > 0 && styles.cellBorder]}>
              <Text style={styles.label}>{e.label}</Text>
              <Text style={styles.value} numberOfLines={3}>{e.value || '--'}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, paddingVertical: spacing.md },
  row: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lastRow: { borderBottomWidth: 0 },
  cell: { flex: 1, paddingVertical: spacing.md, paddingRight: spacing.sm },
  cellBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border, paddingLeft: spacing.lg },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  value: { fontSize: 14, color: colors.text, fontWeight: '500', lineHeight: 20 },
});
