import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { CAS_LOGIN_URL, InteractiveLoginRequired, signInToPortal } from './src/api/cas';
import { abortPortalRequests, clearPortalCookies, portalRequest, SessionExpiredError } from './src/api/portalClient';
import { resetCourseSelectContext } from './src/api/courseSelectEngine';
import { resetApplyContext } from './src/api/personalSelectEngine';
import { clearStudentInfoCache } from './src/api/data';
import { clearCredentials, clearUser, loadCredentials, loadUser, saveCredentials, saveUser, type StoredCredentials, type StoredUser } from './src/api/storage';
import { BottomTabBar } from './src/components/BottomTabBar';
import { ANDROID_CHROME_USER_AGENT, SITE, TABS } from './src/config/site';
import { AllScreen } from './src/screens/AllScreen';
import { CourseTableScreen } from './src/screens/CourseTableScreen';
import { ExamScreen } from './src/screens/ExamScreen';
import { FunctionPageScreen } from './src/screens/FunctionPageScreen';
import { GradeScreen } from './src/screens/GradeScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { NoticeDetailScreen } from './src/screens/NoticeDetailScreen';
import { NoticeScreen } from './src/screens/NoticeScreen';
import { SportsScreen } from './src/screens/SportsScreen';
import { colors, spacing, themeInitDiagnostics } from './src/theme';
import type { MenuFunction, NoticeItem } from './src/types';
import { autoRefreshCourseWidget } from './src/widget/courseWidget';

type Phase = 'boot' | 'login' | 'school-login' | 'main';
type LibraryPage = { title: string; uri: string } | null;
const CAS_SOURCE = { uri: CAS_LOGIN_URL };
const LIBRARY_RESERVE_URL = 'https://libspace.xauat.edu.cn/h5/index.html#/home';
const MY_LIBRARY_URL = 'https://libopac.xauat.edu.cn/mspace/reader/readerHome';
const portal = new URL(SITE.portal);

function resetPortalData() {
  clearStudentInfoCache();
  resetCourseSelectContext();
  resetApplyContext();
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('boot');
  // Keep the current tab and one recently used tab mounted for quick back-and-forth.
  const [recentTabs, setRecentTabs] = useState(() => [TABS[0].key]);
  const activeKey = recentTabs[0];
  const setActiveKey = useCallback((key: string) => {
    setRecentTabs(current => current[0] === key ? current : [key, current[0]]);
  }, []);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [noticeDetail, setNoticeDetail] = useState<NoticeItem | null>(null);
  const [noticesVisible, setNoticesVisible] = useState(false);
  const [functionPage, setFunctionPage] = useState<MenuFunction | null>(null);
  const [sportsVisible, setSportsVisible] = useState(false);
  const [libraryPage, setLibraryPage] = useState<LibraryPage>(null);
  const phaseRef = useRef<Phase>('boot');
  const credentialsRef = useRef<StoredCredentials | null>(null);
  const authRun = useRef(0);
  const authPending = useRef(false);
  const lastAutoLoginRef = useRef(0);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const enterPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const enterMain = useCallback((authenticatedCredentials?: StoredCredentials) => {
    if (authenticatedCredentials) {
      const account = { stdNo: authenticatedCredentials.stdNo, name: '' };
      credentialsRef.current = authenticatedCredentials;
      setUser(account);
      void saveUser(account).catch(() => undefined);
      void saveCredentials(authenticatedCredentials).catch(() => undefined);
    }
    setPassword('');
    setLoginError(null);
    resetPortalData();
    setRecentTabs(current => [current[0]]);
    setSessionEpoch(value => value + 1);
    enterPhase('main');
  }, [enterPhase]);

  const signIn = useCallback(async (credentials?: StoredCredentials) => {
    if (authPending.current) return;
    const run = ++authRun.current;
    authPending.current = true;
    setSubmitting(true);
    setLoginError(null);
    try {
      await signInToPortal(credentials);
      if (run === authRun.current) enterMain(credentials);
    } catch (error) {
      if (run !== authRun.current) return;
      if (error instanceof InteractiveLoginRequired) {
        enterPhase('school-login');
      } else {
        setLoginError('暂时无法完成认证，请重试或使用学校认证页面');
        enterPhase('login');
      }
    } finally {
      if (run === authRun.current) {
        authPending.current = false;
        setSubmitting(false);
      }
    }
  }, [enterMain, enterPhase]);

  const handleLogout = useCallback(async () => {
    ++authRun.current;
    authPending.current = false;
    credentialsRef.current = null;
    resetPortalData();
    setUser(null);
    setUsername('');
    setPassword('');
    setLoginError(null);
    setSubmitting(true);
    setFunctionPage(null);
    setSportsVisible(false);
    setLibraryPage(null);
    setNoticesVisible(false);
    setNoticeDetail(null);
    setRecentTabs([TABS[0].key]);
    enterPhase('login');
    const results = await Promise.allSettled([clearUser(), clearCredentials(), clearPortalCookies()]);
    if (results.some(result => result.status === 'rejected')) {
      setLoginError('部分登录数据未能清除，请重新退出或重启 App');
    }
    setSubmitting(false);
  }, [enterPhase]);

  const handleSessionExpired = useCallback(() => {
    if (phaseRef.current !== 'main' || authPending.current) return;
    abortPortalRequests();
    resetPortalData();
    const credentials = credentialsRef.current;
    const now = Date.now();
    if (credentials && now - lastAutoLoginRef.current > 180000) {
      lastAutoLoginRef.current = now;
      enterPhase('boot');
      void signIn(credentials);
    } else {
      setLoginError('登录已过期，请重新登录');
      enterPhase('login');
    }
  }, [enterPhase, signIn]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [savedUser, credentials] = await Promise.all([loadUser(), loadCredentials()]);
      if (cancelled) return;
      setUser(savedUser);
      credentialsRef.current = credentials;
      setUsername(credentials?.stdNo ?? savedUser?.stdNo ?? '');
      try {
        await portalRequest(SITE.portal);
        if (!cancelled) enterMain();
      } catch (error) {
        if (cancelled) return;
        if (error instanceof SessionExpiredError && credentials) {
          lastAutoLoginRef.current = Date.now();
          void signIn(credentials);
        } else {
          if (!(error instanceof SessionExpiredError)) setLoginError('暂时无法连接教务系统');
          enterPhase('login');
        }
      }
    })().catch(() => { if (!cancelled) enterPhase('login'); });
    return () => { cancelled = true; };
  }, [enterMain, enterPhase, signIn]);

  useEffect(() => {
    let mounted = true;
    const openByUrl = (url: string | null) => {
      if (url?.includes('course-table')) setActiveKey('schedule');
    };
    Linking.getInitialURL().then(url => { if (mounted) openByUrl(url); }).catch(() => undefined);
    const urlSub = Linking.addEventListener('url', event => openByUrl(event.url));
    const appSub = AppState.addEventListener('change', status => {
      if (status === 'active' && phaseRef.current === 'main') void autoRefreshCourseWidget();
      if (status === 'background') {
        setRecentTabs(current => current.length === 1 ? current : [current[0]]);
      }
    });
    return () => { mounted = false; urlSub.remove(); appSub.remove(); };
  }, [setActiveKey]);

  const handleSchoolLoginLoad = useCallback((url: string) => {
    if (phaseRef.current !== 'school-login' || authPending.current) return;
    let current: URL;
    try {
      current = new URL(url);
    } catch {
      return;
    }
    if (current.origin !== portal.origin || current.pathname !== portal.pathname) return;
    authPending.current = true;
    void portalRequest(SITE.portal).then(async () => {
      if (phaseRef.current !== 'school-login') return;
      // QR sign-in or manual entry may have used a different school account.
      credentialsRef.current = null;
      setUser(null);
      setUsername('');
      await Promise.allSettled([clearUser(), clearCredentials()]);
      if (phaseRef.current === 'school-login') enterMain();
    }).catch(() => {
      if (phaseRef.current === 'school-login') {
        setLoginError('学校认证已返回，App 未能读取教务会话，请重试');
        enterPhase('login');
      }
    }).finally(() => { authPending.current = false; });
  }, [enterMain, enterPhase]);

  const handleNavigate = useCallback((key: string) => {
    if (key === 'sports') setSportsVisible(true);
    else if (key === 'library-reserve') setLibraryPage({ title: '图书馆预约', uri: LIBRARY_RESERVE_URL });
    else if (key === 'my-library') setLibraryPage({ title: '我的图书馆', uri: MY_LIBRARY_URL });
    else setActiveKey(key);
  }, [setActiveKey]);

  const renderTab = (key: string) => {
    switch (key) {
      case 'schedule': return <CourseTableScreen onSessionExpired={handleSessionExpired} />;
      case 'grade': return <GradeScreen onSessionExpired={handleSessionExpired} />;
      case 'exam': return <ExamScreen onSessionExpired={handleSessionExpired} />;
      case 'all': return <AllScreen onOpenFunction={setFunctionPage} onOpenNotices={() => setNoticesVisible(true)} onNavigateTab={setActiveKey} onSessionExpired={handleSessionExpired} />;
      default: return <HomeScreen user={user} onNavigate={handleNavigate} onSessionExpired={handleSessionExpired} onLogout={handleLogout} />;
    }
  };
 return <SafeAreaProvider><SafeAreaView style={styles.safeArea} edges={['top','left','right']}><StatusBar style="light"/>{phase==='boot'?<View style={styles.bootView}><View style={styles.bootLogo}><Ionicons name="school" size={40} color="#fff"/></View><Text style={styles.bootName}>西建大教务通</Text><ActivityIndicator color={colors.primary} style={styles.bootSpinner}/></View>:phase==='login'?(
   <LoginScreen
     username={username}
     password={password}
     onUsernameChange={setUsername}
     onPasswordChange={setPassword}
     onSubmit={() => void signIn({ stdNo: username.trim(), password })}
     onOpenSchoolLogin={() => enterPhase('school-login')}
     submitting={submitting}
     error={loginError}
   />
 ) : phase==='school-login'?(
   <View style={styles.loggingWrap}>
     <View style={styles.loggingHeader}>
       <TouchableOpacity onPress={() => enterPhase('login')}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
       <Text style={styles.loggingTitle}>学校统一身份认证</Text>
       <View style={styles.loggingHeaderSpacer} />
     </View>
     <WebView
       source={CAS_SOURCE}
       style={styles.schoolWebView}
       userAgent={Platform.OS === 'android' ? ANDROID_CHROME_USER_AGENT : undefined}
       javaScriptEnabled
       domStorageEnabled
       thirdPartyCookiesEnabled
       sharedCookiesEnabled
       setSupportMultipleWindows={false}
       onLoadEnd={event => handleSchoolLoginLoad(event.nativeEvent.url)}
     />
   </View>
 ):<View style={styles.main}><View style={styles.header}><Text style={styles.headerTitle}>{TABS.find(t=>t.key===activeKey)?.title??''}</Text><TouchableOpacity style={styles.headerBtn} onPress={handleLogout}><Ionicons name="log-out-outline" size={20} color={colors.textSecondary}/></TouchableOpacity></View>{themeInitDiagnostics.state&&!themeInitDiagnostics.state.startsWith('ok')?<View style={styles.diagBar}><Text style={styles.diagText}>动态取色诊断:{themeInitDiagnostics.state}</Text></View>:null}<View style={styles.content} key={sessionEpoch}>{TABS.map(tab=>recentTabs.includes(tab.key)?<View key={tab.key} style={[styles.tabPage,tab.key!==activeKey&&styles.tabHidden]} pointerEvents={tab.key===activeKey?'auto':'none'}>{renderTab(tab.key)}</View>:null)}</View><BottomTabBar activeKey={activeKey} onSelect={setActiveKey}/></View>}{sportsVisible?<View style={StyleSheet.absoluteFill}><SportsScreen onClose={()=>setSportsVisible(false)}/></View>:null}{libraryPage?<View style={StyleSheet.absoluteFill}><LibraryScreen title={libraryPage.title} uri={libraryPage.uri} showReservationRules={libraryPage.uri === LIBRARY_RESERVE_URL} onClose={()=>setLibraryPage(null)}/></View>:null}{noticesVisible?<View style={StyleSheet.absoluteFill}><View style={styles.overlayHeader}><TouchableOpacity onPress={()=>setNoticesVisible(false)} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="close" size={24} color={colors.text}/></TouchableOpacity><Text style={styles.overlayTitle}>通知公告</Text><View style={styles.overlaySpacer}/></View><NoticeScreen onOpenNotice={setNoticeDetail}/></View>:null}{functionPage?<View style={StyleSheet.absoluteFill}><FunctionPageScreen fn={functionPage} onClose={()=>setFunctionPage(null)} onSessionExpired={handleSessionExpired}/></View>:null}{noticeDetail?<View style={StyleSheet.absoluteFill}><NoticeDetailScreen url={noticeDetail.url} title={noticeDetail.title} onClose={()=>setNoticeDetail(null)}/></View>:null}</SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:colors.primary},bootView:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background,gap:spacing.md},bootLogo:{width:72,height:72,borderRadius:36,backgroundColor:colors.primary,alignItems:'center',justifyContent:'center'},bootName:{fontSize:18,fontWeight:'700',color:colors.text},bootSpinner:{marginTop:spacing.sm},loggingWrap:{flex:1,backgroundColor:colors.background},loggingHeader:{flexDirection:'row',alignItems:'center',paddingHorizontal:spacing.md,paddingVertical:spacing.sm,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},loggingTitle:{flex:1,textAlign:'center',fontSize:15,fontWeight:'600',color:colors.text},loggingHeaderSpacer:{width:24},main:{flex:1,backgroundColor:colors.background},header:{height:44,flexDirection:'row',alignItems:'center',justifyContent:'center',backgroundColor:colors.background,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},headerTitle:{fontSize:16,fontWeight:'600',color:colors.text},headerBtn:{position:'absolute',right:spacing.md,padding:spacing.xs},content:{flex:1},tabPage:{flex:1},tabHidden:{display:'none'},diagBar:{backgroundColor:colors.danger,paddingHorizontal:spacing.md,paddingVertical:2},diagText:{color:'#fff',fontSize:10},schoolWebView:{flex:1,backgroundColor:'#fff'},overlayHeader:{height:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},overlayTitle:{fontSize:16,fontWeight:'600',color:colors.text},overlaySpacer:{width:24}});
