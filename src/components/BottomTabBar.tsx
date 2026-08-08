import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TABS } from '../config/site';
import { colors } from '../theme';

interface BottomTabBarProps {
  activeKey: string;
  onSelect: (key: string) => void;
}

export function BottomTabBar({ activeKey, onSelect }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.6}
          >
            <Ionicons
              name={active ? (tab.activeIcon as keyof typeof Ionicons.glyphMap) : (tab.icon as keyof typeof Ionicons.glyphMap)}
              size={24}
              color={active ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});
