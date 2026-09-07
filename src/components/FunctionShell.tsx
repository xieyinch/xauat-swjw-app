import { useThemeColors, type Palette } from '../appearance';
import { MotionTouchableOpacity } from './MotionTouchableOpacity';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../theme';

interface FunctionShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** 原生功能页统一外壳：顶部关闭按钮 + 标题 + 内容 */
export function FunctionShell({ title, onClose, children }: FunctionShellProps) {
  const colors = useThemeColors();
  const styles = make_styles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MotionTouchableOpacity onPress={onClose} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={colors.text} />
        </MotionTouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.btn} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  content: { flex: 1 },
});
