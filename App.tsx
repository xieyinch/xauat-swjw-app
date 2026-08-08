import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabBar } from './src/components/BottomTabBar';
import { PortalWebView, PortalWebViewHandle } from './src/components/PortalWebView';
import { TopBar } from './src/components/TopBar';
import { TABS } from './src/config/site';
import { colors } from './src/theme';

export default function App() {
  const [activeKey, setActiveKey] = useState(TABS[0].key);
  const activeTab = TABS.find((tab) => tab.key === activeKey) ?? TABS[0];

  const webViewRef = useRef<PortalWebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const switchTab = (key: string) => {
    if (key === activeKey) {
      return;
    }
    setActiveKey(key);
    setProgress(0);
    setHasError(false);
    setNotLoggedIn(false);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.app}>
          <TopBar
            title={activeTab.title}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={() => webViewRef.current?.goBack()}
            onForward={() => webViewRef.current?.goForward()}
            onReload={() => webViewRef.current?.reload()}
          />

          {notLoggedIn && activeTab.requiresLogin ? <LoginHint /> : null}

          <View style={styles.webviewWrap}>
            <PortalWebView
              ref={webViewRef}
              uri={activeTab.uri}
              requiresLogin={activeTab.requiresLogin}
              onNavigationStateChange={(nav) => {
                setCanGoBack(nav.canGoBack);
                setCanGoForward(nav.canGoForward);
                setHasError(false);
              }}
              onLoadProgress={setProgress}
              onError={() => setHasError(true)}
              onLoginState={(loggedIn) => setNotLoggedIn(!loggedIn)}
            />

            {hasError ? (
              <ErrorOverlay onRetry={() => webViewRef.current?.reload()} />
            ) : progress > 0 && progress < 1 ? (
              <View style={styles.progressTrack} pointerEvents="none">
                <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            ) : null}
          </View>

          <BottomTabBar activeKey={activeKey} onSelect={switchTab} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function LoginHint() {
  return (
    <View style={styles.loginHint}>
      <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
      <Text style={styles.loginHintText}>尚未登录教务系统，请先到「首页」登录后刷新本页</Text>
    </View>
  );
}

function ErrorOverlay({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorOverlay}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.textSecondary} />
      <Text style={styles.errorTitle}>页面加载失败</Text>
      <Text style={styles.errorDesc}>请检查网络连接后重试</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>重新加载</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webviewWrap: {
    flex: 1,
    backgroundColor: colors.background,
  },
  progressTrack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 10,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.primary,
  },
  loginHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  loginHintText: {
    flex: 1,
    fontSize: 12,
    color: '#8A5A00',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  errorDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
