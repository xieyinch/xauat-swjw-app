import React, { useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  AccessibilityInfo,
  Animated,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';

type MotionVariant = 'card' | 'pill' | 'icon';

interface MotionTouchableOpacityProps extends TouchableOpacityProps {
  motionVariant?: MotionVariant;
  feedback?: 'selection' | 'impact' | 'none';
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

let reduceMotionEnabled = false;
void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
  reduceMotionEnabled = enabled;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
  reduceMotionEnabled = enabled;
});

const PRESSED_SCALE: Record<MotionVariant, number> = {
  card: 0.97,
  pill: 0.94,
  icon: 0.9,
};

/**
 * A shared, native-driver press response for every tappable surface.
 * It preserves the original layout and callbacks while adding a soft,
 * spring-loaded "pressed into the surface" feeling.
 */
export function MotionTouchableOpacity({
  activeOpacity: _activeOpacity,
  disabled,
  motionVariant = 'card',
  feedback = 'selection',
  onPress,
  onPressIn,
  onPressOut,
  style,
  ...props
}: MotionTouchableOpacityProps) {
  const pressed = useRef(new Animated.Value(0)).current;

  const animateTo = (toValue: number) => {
    if (reduceMotionEnabled) {
      pressed.setValue(toValue);
      return;
    }
    Animated.spring(pressed, {
      toValue,
      useNativeDriver: true,
      speed: toValue ? 28 : 22,
      bounciness: toValue ? 1 : 5,
    }).start();
  };

  return (
    <AnimatedTouchableOpacity
      {...props}
      disabled={disabled}
      activeOpacity={1}
      onPress={(event) => {
        if (feedback !== 'none') {
          void (feedback === 'impact' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync()).catch(() => {});
        }
        onPress?.(event);
      }}
      onPressIn={(event) => {
        if (!disabled) animateTo(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(0);
        onPressOut?.(event);
      }}
      style={[
        style,
        {
          opacity: disabled ? 0.45 : pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }),
          transform: [
            { translateY: pressed.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) },
            { scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, PRESSED_SCALE[motionVariant]] }) },
          ],
        },
      ]}
    />
  );
}
