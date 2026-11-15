import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { PortalWebView, PortalWebViewHandle } from '../components/PortalWebView';
import { SITE } from '../config/site';
import { nativeComponentFor } from '../config/nativeFunctions';
import type { MenuFunction } from '../types';
import { colors, spacing } from '../theme';

interface Props {
  fn: MenuFunction;
  onClose: () => void;
  onSessionExpired: () => void;
}

interface OverridePage {
  title: string;
  path: string;
}

export function FunctionPageScreen({ fn, onClose, onSessionExpired }: Props) {
  const webViewRef = useRef<PortalWebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [overridePage, setOverridePage] = useState<OverridePage | null>(null);
  const canGoBackRef = useRef(false);
  const expiredRef = useRef(false);

  // 已原生化的功能直接渲染原生组件，跳过 WebView
  const Native = nativeComponentFor(fn);

  const uri = overridePage
    ? `${SITE.swjw}${overridePage.path}`
    : fn.href
      ? `${SITE.swjw}${fn.href}`
      : SITE.portal;
  const title = overridePage?.title ?? fn.title;

  const handleNav = useCallback(
    (nav: WebViewNavigation) => {
      canGoBackRef.current = nav.canGoBack;
      setCanGoBack(nav.canGoBack);
      setCanGoForward(nav.canGoForward);
      if (nav.url.includes('authserver') && !expiredRef.current) {
        expiredRef.current = true;
        onSessionExpired();
      }
    },
    [onSessionExpired],
  );

  const handleBack = useCallback(() => {
    // 原生页无 WebView 历史，返回键直接关闭页面回到上级菜单
    if (Native && !overridePage) {
      onClose();
      return true;
    }
    if (canGoBackRef.current) webViewRef.current?.goBack();
    else onClose();
    return true;
  }, [Native, overridePage, onClose]);

  // 无论原生页还是 WebView 页都必须注册返回键，否则硬件返回会直接退出 App
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => subscription.remove();
  }, [handleBack]);

  if (Native && !overridePage) {
    const openWebPage = (pageTitle: string, path: string) => setOverridePage({ title: pageTitle, path });
    return <Native onClose={onClose} onSessionExpired={onSessionExpired} openWebPage={openWebPage} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => webViewRef.current?.goBack()}
            disabled={!canGoBack}
            style={styles.btn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={20} color={canGoBack ? colors.text : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => webViewRef.current?.goForward()}
            disabled={!canGoForward}
            style={styles.btn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-forward" size={20} color={canGoForward ? colors.text : colors.textSecondary} />
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
        uri={uri}
        requiresLogin
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
  btn: { width: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
