import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export type AoraEmotion = 'idle' | 'curious' | 'happy' | 'focused' | 'receiving' | 'done' | 'searching';

const IDS: Record<AoraEmotion, string> = {
  idle: '02', curious: '03', happy: '10', focused: '16', receiving: '31', done: '33', searching: '40',
};

export function AoraBall({ emotion, pulse = 0 }: { emotion: AoraEmotion; pulse?: number }) {
  const ref = useRef<WebView>(null);
  const ready = useRef(false);
  const latest = useRef({ emotion, pulse });
  latest.current = { emotion, pulse };

  const send = useCallback((next: AoraEmotion, shouldBounce = false) => {
    ref.current?.postMessage(JSON.stringify({ emotion: IDS[next], bounce: shouldBounce }));
  }, []);

  useEffect(() => {
    if (ready.current) send(emotion, pulse > 0);
  }, [emotion, pulse, send]);

  if (Platform.OS !== 'android') {
    return <LinearGradient colors={['#FFD86A', '#F5A52E', '#E87A22']} style={styles.fallback} />;
  }

  const handleMessage = (_event: WebViewMessageEvent) => {
    ready.current = true;
    send(latest.current.emotion, latest.current.pulse > 0);
  };

  return <View pointerEvents="none" style={styles.frame}>
    <WebView
      ref={ref}
      source={{ uri: 'file:///android_asset/aora/index.html' }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled={false}
      scrollEnabled={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      androidLayerType="hardware"
      containerStyle={styles.transparent}
      style={styles.transparent}
      onMessage={handleMessage}
    />
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: 72, height: 72, overflow: 'visible' },
  transparent: { flex: 1, backgroundColor: 'transparent' },
  fallback: { width: 62, height: 62, margin: 5, borderRadius: 31 },
});
