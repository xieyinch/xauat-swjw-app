import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect } from 'react';
import { Alert, BackHandler, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SITE } from '../config/site';
import { colors, spacing } from '../theme';

interface Props {
  onClose: () => void;
}

/**
 * 缴费大厅依赖真实微信环境完成网页 OAuth。
 * 普通浏览器/WebView 会被引导到二维码页，仅伪装微信 UA 又会因为缺少
 * 微信 OAuth / JSBridge 上下文而白屏，因此这里直接交给微信处理认证。
 */
export function PaymentScreen({ onClose }: Props) {
  const openInWeChat = useCallback(async () => {
    // Android 微信可通过 weixin:// 打开；具体 H5 URL 仍由微信扫码/网页环境处理。
    // 优先尝试唤起微信，避免继续在普通 WebView 中触发二维码/白屏分支。
    const wechatScheme = 'weixin://';
    try {
      const supported = await Linking.canOpenURL(wechatScheme);
      if (!supported) {
        Alert.alert('未检测到微信', '缴费大厅需要微信 OAuth 验证，请先安装并登录微信。');
        return;
      }
      await Linking.openURL(wechatScheme);
    } catch {
      Alert.alert('无法打开微信', '请手动打开微信后进入学校缴费大厅。');
    }
  }, []);

  const handleBack = useCallback(() => {
    onClose();
    return true;
  }, [onClose]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  useEffect(() => {
    void openInWeChat();
  }, [openInWeChat]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>缴费大厅</Text>
        <View style={styles.btn} />
      </View>

      <View style={styles.content}>
        <Ionicons name="logo-wechat" size={64} color="#07C160" />
        <Text style={styles.title}>请在微信中完成缴费</Text>
        <Text style={styles.description}>
          学校缴费大厅需要微信 OAuth 身份验证，无法直接在 App 内置浏览器中完成认证。
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={openInWeChat} activeOpacity={0.8}>
          <Ionicons name="logo-wechat" size={22} color="#fff" />
          <Text style={styles.primaryButtonText}>打开微信</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>进入微信后，请从学校公众号/原缴费入口进入缴费大厅。</Text>
      </View>
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
  btn: { width: 32, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { marginTop: 20, fontSize: 20, fontWeight: '700', color: colors.text },
  description: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  primaryButton: {
    marginTop: 28,
    minWidth: 180,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#07C160',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
