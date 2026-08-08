import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { attachWebView, handleWebViewMessage, markWebReady } from './src/api/bridge';
import { clearStudentInfoCache } from './src/api/data';
import { clearUser, loadUser, saveUser, type StoredUser } from './src/api/storage';
import { BottomTabBar } from './src/components/BottomTabBar';
import { SITE, TABS } from './src/config/site';
import { CourseTableScreen } from './src/screens/CourseTableScreen';
import { ExamScreen } from './src/screens/ExamScreen';
import { GradeScreen } from './src/screens/GradeScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NoticeDetailScreen } from './src/screens/NoticeDetailScreen';
import { NoticeScreen } from './src/screens/NoticeScreen';
import { colors, spacing } from './src/theme';
import type { NoticeItem } from './src/types';

type Phase = 'boot' | 'login' | 'logging' | 'main';

const CAS_LOGIN_URL = `${SITE.authLogin}?service=${encodeURIComponent(SITE.ssoService)}`;

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [activeKey, setActiveKey] = useState(TABS[0].key);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [noticeDetail, setNoticeDetail] = useState<NoticeItem | null>(null);

  const webViewRef = useRef<WebView>(null);
  const phaseRef = useRef<Phase>('boot');
  const usernameRef = useRef('');
  const passwordRef = useRef('');
  const currentUrlRef = useRef('');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const handleSessionExpired = useCallback(() => {
    setPhase('login');
    setLoginError('登录已过期，请重新登录');
  }, []);

  const handleLogout = useCallback(async () => {
    await clearUser();
    clearStudentInfoCache();
    setUser(null);
    setUsername('');
    setPassword('');
    usernameRef.current = '';
    passwordRef.current = '';
    setLoginError(null);
    setPhase('login');
  }, []);

  const handleNav = useCallback((nav: { url: string }) => {
    currentUrlRef.current = nav.url;
    const ph = phaseRef.current;
    if (ph === 'boot') {
      if (nav.url.startsWith(SITE.swjw)) {
        markWebReady();
        setPhase('main');
      } else if (nav.url.includes('authserver')) {
        setPhase('login');
      }
    } else if (ph === 'logging') {
      if (nav.url.startsWith(SITE.swjw)) {
        saveUser({ stdNo: usernameRef.current.trim(), name: '' });
        setLoginError(null);
        markWebReady();
        setPhase('main');
      }
    } else if (ph === 'main') {
      if (nav.url.includes('authserver')) {
        setPhase('login');
        setLoginError('登录已过期，请重新登录');
      }
    }
  }, []);

  const injectAutoLogin = useCallback(() => {
    const wv = webViewRef.current;
    const un = usernameRef.current.trim();
    const pw = passwordRef.current;
    if (!wv || !un || !pw) return;
    const js = `(function () {
      var un = ${JSON.stringify(un)};
      var pw = ${JSON.stringify(pw)};
      function setVal(el, v) {
        var proto = Object.getPrototypeOf(el);
        var desc = Object.getOwnPropertyDescriptor(proto, 'value');
        if (desc && desc.set) desc.set.call(el, v);
        else el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }
      function attempt() {
        var u = document.querySelector('input[name="username"]');
        var p = document.querySelector('input[name="password"]');
        if (!u || !p) return false;
        setVal(u, un);
        setVal(p, pw);
        var btn = document.querySelector('#login_submit')
          || document.querySelector('.auth_login_btn')
          || document.querySelector('button[type="submit"]')
          || document.querySelector('input[type="submit"]');
        if (btn) { btn.click(); return true; }
        return false;
      }
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        try {
          if (attempt()) {
            clearInterval(iv);
            window.ReactNativeWebView.postMessage(JSON.stringify({ __t: -2, ok: true }));
          } else if (tries >= 20) {
            clearInterval(iv);
            window.ReactNativeWebView.postMessage(JSON.stringify({ __t: -1, ok: false, e: 'login-inject-failed' }));
          }
        } catch (err) {
          if (tries >= 20) clearInterval(iv);
        }
      }, 300);
    })(); true;`;
    wv.injectJavaScript(js);
  }, []);

  const handleLoadEnd = useCallback(() => {
    const ph = phaseRef.current;
    const url = currentUrlRef.current;
    if (ph === 'logging' && url.includes('authserver')) {
      injectAutoLogin();
    }
  }, [injectAutoLogin]);

  const handleMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data && data.__t === -1) {
          if (phaseRef.current === 'logging') {
            setLoginError('自动登录失败，请在下方网页中手动完成登录');
          }
          return;
        }
      } catch {
        // 非本应用消息，交给数据桥处理
      }
      handleWebViewMessage(event);
    },
    [],
  );

  useEffect(() => {
    loadUser().then((u) => setUser(u));
  }, []);

  useEffect(() => {
    if (phase !== 'boot') return;
    const timer = setTimeout(() => {
      setPhase((p) => (p === 'boot' ? 'login' : p));
    }, 12000);
    return () => clearTimeout(timer);
  }, [phase]);

  const handleLoginSubmit = useCallback(() => {
    if (!usernameRef.current.trim() || !passwordRef.current) return;
    setLoginError(null);
    setPhase('logging');
  }, []);

  const renderTab = () => {
    switch (activeKey) {
      case 'schedule':
        return <CourseTableScreen onSessionExpired={handleSessionExpired} />;
      case 'grade':
        return <GradeScreen onSessionExpired={handleSessionExpired} />;
      case 'exam':
        return <ExamScreen onSessionExpired={handleSessionExpired} />;
      case 'notice':
        return <NoticeScreen onOpenNotice={setNoticeDetail} />;
      case 'home':
      default:
        return (
          <HomeScreen
            user={user}
            onNavigate={setActiveKey}
            onSessionExpired={handleSessionExpired}
            onLogout={handleLogout}
          />
        );
    }
  };

  const renderBridgeWebView = (visible: boolean) => (
    <WebView
      ref={(wv) => {
        webViewRef.current = wv;
        attachWebView(wv);
      }}
      source={{ uri: phase === 'logging' ? CAS_LOGIN_URL : SITE.portal }}
      style={styles.bridgeInner}
      javaScriptEnabled
      domStorageEnabled
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      cacheEnabled
      setSupportMultipleWindows={false}
      onNavigationStateChange={handleNav}
      onLoadEnd={handleLoadEnd}
      onMessage={handleMessage}
    />
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {phase === 'boot' ? (
          <View style={styles.bootView}>
            <View style={styles.bootLogo}>
              <Ionicons name="school" size={40} color="#fff" />
            </View>
            <Text style={styles.bootName}>西建大教务通</Text>
            <ActivityIndicator color={colors.primary} style={styles.bootSpinner} />
          </View>
        ) : phase === 'login' ? (
          <LoginScreen
            username={username}
            password={password}
            onUsernameChange={(v) => {
              setUsername(v);
              usernameRef.current = v;
            }}
            onPasswordChange={(v) => {
              setPassword(v);
              passwordRef.current = v;
            }}
            onSubmit={handleLoginSubmit}
            submitting={false}
            error={loginError}
          />
        ) : phase === 'logging' ? (
          <View style={styles.loggingWrap}>
            <View style={styles.loggingHeader}>
              <TouchableOpacity onPress={() => setPhase('login')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.loggingTitle}>正在登录教务系统</Text>
              <View style={styles.loggingHeaderSpacer} />
            </View>
            {renderBridgeWebView(true)}
          </View>
        ) : (
          <View style={styles.main}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{TABS.find((t) => t.key === activeKey)?.title ?? ''}</Text>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={handleLogout}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.content}>{renderTab()}</View>
            <BottomTabBar activeKey={activeKey} onSelect={setActiveKey} />
          </View>
        )}

        {phase !== 'logging' ? (
          <View style={styles.bridgeHidden} pointerEvents="none">
            {renderBridgeWebView(false)}
          </View>
        ) : null}

        {noticeDetail ? (
          <View style={StyleSheet.absoluteFill}>
            <NoticeDetailScreen
              url={noticeDetail.url}
              title={noticeDetail.title}
              onClose={() => setNoticeDetail(null)}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  bootView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  bootLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootName: { fontSize: 18, fontWeight: '700', color: colors.text },
  bootSpinner: { marginTop: spacing.sm },
  loggingWrap: { flex: 1, backgroundColor: colors.background },
  loggingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  loggingTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.text },
  loggingHeaderSpacer: { width: 24 },
  main: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  headerBtn: { position: 'absolute', right: spacing.md, padding: spacing.xs },
  content: { flex: 1 },
  bridgeHidden: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  bridgeInner: { flex: 1, backgroundColor: '#fff' },
});
