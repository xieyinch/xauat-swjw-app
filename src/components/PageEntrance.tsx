import React, { useEffect, useRef, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

export function PageEntrance({ children }: PropsWithChildren) {
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!alive || reduced) return;
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
    return () => { alive = false; progress.stopAnimation(); };
  }, [progress]);
  return <Animated.View style={{ flex: 1, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>{children}</Animated.View>;
}
