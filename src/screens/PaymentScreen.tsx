import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { PortalWebView, PortalWebViewHandle } from '../components/PortalWebView';
import { colors, spacing } from '../theme';

interface Props {
  onClose: () => void;
}

// 从西建大缴费大厅真实微信会话抓包确认的 OAuth 入口。
// 这里不复用任何临时 code/openid；这些值必须由服务端在当前会话重新签发。
const PAYMENT_OAUTH_URL =
  'http://wx.weiweixiao.net/connect/oauth2/authorize?appid=3074787599&redirect_uri=http%3A%2F%2Fdk.xauat.edu.cn%2FwxOath2.aspx%3Fmethod%3Dweixin&scope=snsapi_userinfo';

// 微微校 OAuth 中转会检查微信浏览器 UA。真实 OAuth code 仍由服务器产生，
// 因此这里只复现入口环境，不写入抓包里的 code/openid/cookie。
const WECHAT_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.42.2460(0x28002A3B) WeChat/arm64 Language/zh_CN';

export function PaymentScreen({ onClose }: Props) {
  const webViewRef = useRef<PortalWebViewHandle>(null);
  const canGoBackRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);

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
        <Text style={styles.headerTitle} numberOfLines={1}>生活缴费</Text>
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
        uri={PAYMENT_OAUTH_URL}
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
