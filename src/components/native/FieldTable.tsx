import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../../theme';

interface Props {
  fields: Array<{ label: string; value: string }>;
  /** 当 value 无有效内容时展示的占位符 */
  placeholder?: string;
  onPress?: (label: string, value: string) => void;
}

/** 键值对信息表：每行展示一组 标签 + 值 */
export function FieldTable({ fields, placeholder = '--', onPress }: Props) {
  return (
    <View style={styles.wrap}>
      {fields.map((f, idx) => (
        <TouchableOpacity
          key={`${f.label}-${idx}`}
          style={styles.row}
          activeOpacity={onPress ? 0.6 : 1}
          onPress={onPress ? () => onPress(f.label, f.value) : undefined}
        >
          <Text style={styles.label}>{f.label}</Text>
          <View style={styles.valueWrap}>
            <Text style={[styles.value, !f.value ? styles.empty : null]} numberOfLines={4}>
              {f.value || placeholder}
            </Text>
            {onPress && f.value ? <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} /> : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  label: { width: 96, fontSize: 13, color: colors.textSecondary },
  valueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { flex: 1, fontSize: 13, color: colors.text },
  empty: { color: colors.textSecondary },
});
