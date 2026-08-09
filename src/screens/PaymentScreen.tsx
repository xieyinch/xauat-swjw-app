import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { PortalWebView, PortalWebViewHandle } from '../components/PortalWebView';
import { SITE } from '../config/site';
import { colors, spacing } from '../theme';

interface Props {
  onClose: () => void;
}

// 微微校缴费页面会根据 UA 判断是否处于微信内置浏览器。
// 普通 WebView 会被引导到二维码页，因此仅对缴费大厅模拟微信 Android WebView 环境。
const WECHAT_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 XWEB/1160117 MMWEBSDK/20230805 MMWEBID/123 MicroMessenger/8.0.42.2460(0x28002A3B) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64';

export function PaymentScreen({ onClose }: Props) {
  const webViewRef = useRef<PortalWebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const canGoBackRef = useRef(false);

  const handleNav = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
    setCanGoBack(nav.canGoBack);
  }, []);

  const handleBack = useCallback(() => {
    if (canGoBackRef.current) {
      webViewRef.current?.goBack();
    } else {
      onClose();
    }
    return true;
  }, [onClose]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>缴费大厅</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => webViewRef.current?.goBack()}
            disabled={!canGoBack}
            style={styles.btn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={canGoBack ? colors.text : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => webViewRef.current?.reload()}
            style={styles.btn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <PortalWebView
        ref={webViewRef}
        uri={SITE.payment}
        userAgent={WECHAT_ANDROID_UA}
        onNavigationStateChange={handleNav}
      />
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
  actions: { flexDirection: 'row', alignItems: 'center' },
});
