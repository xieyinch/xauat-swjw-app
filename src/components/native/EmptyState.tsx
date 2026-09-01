import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';

interface Props {
  text?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** 空数据占位 */
export function EmptyState({ text = '暂无数据', icon = 'file-tray-outline' }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={44} color={colors.textSecondary} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  text: { fontSize: 13, color: colors.textSecondary },
});
