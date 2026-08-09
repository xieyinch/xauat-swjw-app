import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing } from '../theme';

interface LoginScreenProps {
  username: string;
  password: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: string | null;
}

export function LoginScreen({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  submitting,
  error,
}: LoginScreenProps) {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="school" size={40} color="#fff" />
        </View>
        <Text style={styles.appName}>西建大教务通</Text>
        <Text style={styles.slogan}>课表 · 成绩 · 考试 · 通知，一站直达</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputWrap}>
          <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="学号"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={onUsernameChange}
            autoCapitalize="none"
            keyboardType="default"
            editable={!submitting}
          />
        </View>

        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="密码（统一身份认证密码）"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry={!showPwd}
            editable={!submitting}
          />
          <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={showPwd ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, (submitting || !username || !password) && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={submitting || !username || !password}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>登录</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.tip}>
          使用学校统一身份认证账号登录。登录成功后账号密码会保存在设备安全存储区，用于会话过期后自动重新登录；退出登录会清除。
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 40,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  slogan: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
  },
  form: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FDECEA',
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
  },
  button: {
    marginTop: spacing.sm,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tip: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
});
