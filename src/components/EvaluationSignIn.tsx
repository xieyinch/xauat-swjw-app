import React, { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { currentEvaluationSignIn, evaluationTicket, subscribeEvaluationSignIn } from '../api/evaluationSignIn';
import { isPortalLoginUrl } from '../api/portalClient';
import { ANDROID_CHROME_USER_AGENT, SITE } from '../config/site';

export function EvaluationSignIn() {
  const job = useSyncExternalStore(subscribeEvaluationSignIn, currentEvaluationSignIn);
  useEffect(() => () => currentEvaluationSignIn()?.finish(), []);
  if (!job) return null;

  function inspectNavigation(raw: string) {
    if (raw === 'about:blank') return true;
    try {
      const url = new URL(raw);
      const ticket = evaluationTicket(url);
      if (ticket) {
        job?.finish(ticket);
        return false;
      }
      if (url.origin === SITE.swjw && url.pathname.startsWith('/student/') && !isPortalLoginUrl(url)) return true;
    } catch {
      // Reject unknown destinations.
    }
    job?.finish();
    return false;
  }

  return (
    <View style={styles.hidden} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <WebView
        source={{ uri: job.entry }}
        userAgent={ANDROID_CHROME_USER_AGENT}
        sharedCookiesEnabled
        javaScriptEnabled
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={event => event.isTopFrame === false || inspectNavigation(event.url)}
        onNavigationStateChange={event => inspectNavigation(event.url)}
        onError={() => job.finish()}
        onHttpError={() => job.finish()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
