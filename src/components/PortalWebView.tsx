import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import type { WebViewHttpErrorEvent, WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';

export interface PortalWebViewHandle {
  reload: () => void;
  goBack: () => void;
  goForward: () => void;
}

export interface PortalWebViewProps {
  uri: string;
  requiresLogin?: boolean;
  userAgent?: string;
  onNavigationStateChange?: (nav: WebViewNavigation) => void;
  onLoadProgress?: (progress: number) => void;
  onError?: () => void;
  /** 是否处于未登录状态（通过注入脚本探测登录表单得出） */
  onLoginState?: (loggedIn: boolean) => void;
}

/**
 * 在页面加载完成后探测页面上是否存在登录表单，用于提示用户先在「首页」登录。
 * 仅对需要登录的页面注入。
 */
const LOGIN_DETECTOR = `(function () {
  function detect() {
    try {
      var username = document.querySelector(
        'input[name="username"], input[name="loginName"], input[placeholder*="学号"], input[placeholder*="账号"]'
      );
      var password = document.querySelector('input[type="password"]');
      var loggedIn = !(username && password);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'login-state', loggedIn: loggedIn })
        );
      }
    } catch (e) {}
  }
  detect();
  setTimeout(detect, 1500);
  setTimeout(detect, 3000);
  setTimeout(detect, 5000);
})();`;

export const PortalWebView = forwardRef<PortalWebViewHandle, PortalWebViewProps>(
  function PortalWebView(
    { uri, requiresLogin, userAgent, onNavigationStateChange, onLoadProgress, onError, onLoginState },
    ref,
  ) {
    const webViewRef = useRef<WebView>(null);

    useImperativeHandle(ref, () => ({
      reload: () => webViewRef.current?.reload(),
      goBack: () => webViewRef.current?.goBack(),
      goForward: () => webViewRef.current?.goForward(),
    }));

    return (
      <WebView
        ref={webViewRef}
        source={{ uri }}
        style={{ flex: 1, backgroundColor: '#fff' }}
        userAgent={userAgent}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled={Platform.OS === 'ios'}
        onNavigationStateChange={onNavigationStateChange}
        onLoadProgress={(event: WebViewProgressEvent) => {
          onLoadProgress?.(event.nativeEvent.progress);
        }}
        onError={onError}
        onHttpError={(event: WebViewHttpErrorEvent) => {
          onError?.();
        }}
        onMessage={(event) => {
          if (!requiresLogin || !onLoginState) {
            return;
          }
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'login-state') {
              onLoginState(Boolean(data.loggedIn));
            }
          } catch {
            // 忽略非本应用注入脚本产生的消息
          }
        }}
        injectedJavaScript={requiresLogin ? LOGIN_DETECTOR : undefined}
      />
    );
  },
);
