import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import type { WebViewProgressEvent } from 'react-native-webview/lib/WebViewTypes';

import { ANDROID_CHROME_USER_AGENT } from '../config/site';

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
}

export const PortalWebView = forwardRef<PortalWebViewHandle, PortalWebViewProps>(
  function PortalWebView(
    {
      uri,
      requiresLogin,
      userAgent,
      onNavigationStateChange,
      onLoadProgress,
      onError,
    },
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
        userAgent={userAgent ?? (requiresLogin && Platform.OS === 'android' ? ANDROID_CHROME_USER_AGENT : undefined)}
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
        onHttpError={onError}
      />
    );
  },
);
