import { useThemeColors, type Palette } from '../appearance';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABS } from '../config/site';
import { colors } from '../theme';
import { MotionTouchableOpacity } from './MotionTouchableOpacity';
import { GlassSurface } from './Glass';

interface BottomTabBarProps {
  activeKey: string;
  onSelect: (key: string) => void;
}

interface TabItemProps {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}

function TabItem({ active, icon, activeIcon, title, onPress }: TabItemProps) {
  const colors = useThemeColors();
  const styles = make_styles(colors);

  const selected = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(selected, {
      toValue: active ? 1 : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 7,
    }).start();
  }, [active, selected]);

  return (
    <MotionTouchableOpacity
      style={styles.item}
      motionVariant="pill"
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={title}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.activeSurface,
          {
            opacity: selected,
            transform: [{ scale: selected.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { translateY: selected.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
            { scale: selected.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
          ],
        }}
      >
        <Ionicons name={active ? activeIcon : icon} size={20} color={active ? '#FFFDF7' : colors.textSecondary} />
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]}>{title}</Text>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.warmGlint,
          {
            opacity: selected.interpolate({ inputRange: [0, 1], outputRange: [0, 0.72] }),
            transform: [{ scaleX: selected }],
          },
        ]}
      />
    </MotionTouchableOpacity>
  );
}

export function BottomTabBar({ activeKey, onSelect }: BottomTabBarProps) {
  const colors = useThemeColors();
  const styles = make_styles(colors);

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <GlassSurface style={styles.container} accessibilityRole="tablist">
        {TABS.map((tab) => (
          <TabItem
            key={tab.key}
            active={tab.key === activeKey}
            icon={tab.icon as keyof typeof Ionicons.glyphMap}
            activeIcon={tab.activeIcon as keyof typeof Ionicons.glyphMap}
            title={tab.title}
            onPress={() => onSelect(tab.key)}
          />
        ))}
      </GlassSurface>
    </View>
  );
}

const make_styles = (colors: Palette) => StyleSheet.create({
  safeArea: { backgroundColor: 'transparent', paddingHorizontal: 14, paddingTop: 8 },
  container: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: 'rgba(255,249,239,0.32)',
    padding: 6,
    shadowColor: '#4C4535',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  item: {
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    gap: 2,
  },
  activeSurface: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 17,
    backgroundColor: colors.primaryDark,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 3,
  },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
  labelActive: { color: '#FFFDF7', fontWeight: '800' },
  warmGlint: {
    position: 'absolute',
    bottom: 3,
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#D9BD78',
  },
});
