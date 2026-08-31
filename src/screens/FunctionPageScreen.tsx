import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { PortalWebView, PortalWebViewHandle } from '../components/PortalWebView';
import { SITE } from '../config/site';
import type { MenuFunction } from '../types';
import { colors, spacing } from '../theme';

/**
 * 在原教务页面加载后注入移动端适配脚本：
 * 页面是 1300 固定宽度的桌面布局，先把 viewport 置为 device-width
 * 测出真实屏宽与页面实际宽度，再按页面宽度缩放，使整页恰好铺满手机屏。
 */
const MOBILE_ADAPT_JS = `(function () {
  function setViewport(content) {
    try {
      var vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', content);
      else {
        var m = document.createElement('meta');
        m.name = 'viewport';
        m.content = content;
        document.head.appendChild(m);
      }
    } catch (e) {}
  }
  function adapt() {
    try {
      setViewport('width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes');
      var dev = window.innerWidth || document.documentElement.clientWidth || 375;
      if (!dev) return;
      var body = document.body || document.documentElement;
      var bw = Math.max(body.scrollWidth || 0, document.documentElement.scrollWidth || 0, dev);
      if (bw <= dev) return;
      var scale = dev / bw;
      setViewport('width=' + bw + ', initial-scale=' + scale + ', maximum-scale=5, user-scalable=yes');
    } catch (e) {}
  }
  if (document.readyState === 'complete') setTimeout(adapt, 150);
  else window.addEventListener('load', function () { setTimeout(adapt, 150); setTimeout(adapt, 900); });
  setTimeout(adapt, 300);
  setTimeout(adapt, 1500);
})();`;

interface Props {
  fn: MenuFunction;
  onClose: () => void;
  onSessionExpired: () => void;
}

export function FunctionPageScreen({ fn, onClose, onSessionExpired }: Props) {
  const webViewRef = useRef<PortalWebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const canGoBackRef = useRef(false);
  const expiredRef = useRef(false);

  const uri = fn.href ? `${SITE.swjw}${fn.href}` : SITE.portal;

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
    if (canGoBackRef.current) webViewRef.current?.goBack();
    else onClose();
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
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{fn.title}</Text>
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
        injectedJavaScriptExtra={MOBILE_ADAPT_JS}
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
