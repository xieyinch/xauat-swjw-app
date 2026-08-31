import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { WebViewNavigation } from 'react-native-webview';
import { PortalWebView, PortalWebViewHandle } from '../components/PortalWebView';
import { SITE } from '../config/site';
import type { MenuFunction } from '../types';
import { colors, spacing } from '../theme';

/**
 * 原教务页面是 1300 固定宽度的桌面布局。适配脚本只通过 viewport 做单一缩放，
 * 不做 DOM transform（避免双重缩放导致布局错乱）。
 * - 流式/响应式页面：保持 device-width 原样展示；
 * - 固定宽度页面：默认「铺满」模式（整页缩小铺满手机屏）；
 * - 提供「原始 1:1」模式（横向滚动，文字最清晰），由窗口上的按钮切换。
 * 两种模式都允许双指缩放到 8 倍。
 */
const MOBILE_ADAPT_JS = `(function () {
  function setVp(content) {
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
  function measure() {
    // 先恢复页面自然布局宽度，测出内容真实宽度
    setVp('width=1300, initial-scale=1, maximum-scale=8, user-scalable=yes');
    var body = document.body || document.documentElement;
    var bw = Math.max(body.scrollWidth || 0, document.documentElement.scrollWidth || 0, 980);
    // 再测设备屏宽
    setVp('width=device-width, initial-scale=1, maximum-scale=8, user-scalable=yes');
    var dev = window.innerWidth || document.documentElement.clientWidth || 375;
    return { bw: bw, dev: dev };
  }
  var fit = { bw: 0, dev: 0 };
  function apply(mode) {
    try {
      if (!fit.bw || !fit.dev) fit = measure();
      if (!fit.dev) return;
      if (fit.bw <= fit.dev + 24) {
        setVp('width=device-width, initial-scale=1, maximum-scale=8, user-scalable=yes');
        return;
      }
      var scale = fit.dev / fit.bw;
      if (mode === 'natural') {
        setVp('width=' + fit.bw + ', initial-scale=1, maximum-scale=8, user-scalable=yes');
      } else {
        setVp('width=' + fit.bw + ', initial-scale=' + scale + ', maximum-scale=8, user-scalable=yes');
      }
    } catch (e) {}
  }
  window.__setFitMode = function (mode) { apply(mode); };
  function boot() {
    apply('fit');
    setTimeout(function () { apply('fit'); }, 600);
  }
  if (document.readyState === 'complete') setTimeout(boot, 120);
  else window.addEventListener('load', boot);
  setTimeout(boot, 300);
  setTimeout(boot, 1600);
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
  const [naturalMode, setNaturalMode] = useState(false);
  const canGoBackRef = useRef(false);
  const expiredRef = useRef(false);

  const uri = fn.href ? `${SITE.swjw}${fn.href}` : SITE.portal;

  const toggleFitMode = useCallback(() => {
    setNaturalMode((prev) => {
      const next = !prev;
      webViewRef.current?.injectJavaScript(
        `if (window.__setFitMode) window.__setFitMode('${next ? 'natural' : 'fit'}');`,
      );
      return next;
    });
  }, []);

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
            onPress={toggleFitMode}
            style={styles.btn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={naturalMode ? 'scan-outline' : 'contract-outline'}
              size={20}
              color={naturalMode ? colors.primary : colors.text}
            />
          </TouchableOpacity>
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
