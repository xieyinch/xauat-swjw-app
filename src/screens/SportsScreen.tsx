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

export function SportsScreen({ onClose }: Props) {
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
        <Text style={styles.headerTitle} numberOfLines={1}>体育馆预约</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => webViewRef.current?.goBack()}
            disabled={!canGoBack}
            style={styles.btn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={20}
              color={canGoBack ? colors.text : colors.textSecondary}
            />
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
        uri={SITE.sports}
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
