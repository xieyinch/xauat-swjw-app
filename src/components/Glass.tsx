import React, { createContext, useContext, useRef, type PropsWithChildren } from 'react';
import { Image, StyleSheet, View, type ViewProps } from 'react-native';
import { useAppearance } from '../appearance';
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const Target = createContext<React.RefObject<View | null> | undefined>(undefined);

export function GlassRoot({ children }: PropsWithChildren) {
  const { theme, preferences } = useAppearance();
  const target = useRef<View | null>(null);
  return <Target.Provider value={target}>
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <BlurTargetView ref={target} pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
        {preferences.wallpaper && <Image source={{ uri: preferences.wallpaper }} resizeMode="cover" blurRadius={preferences.blur} style={StyleSheet.absoluteFill} />}
        {!preferences.wallpaper && <><View style={[styles.orb, { top: '4%', right: -110, backgroundColor: theme.colors.primarySoft }]} />
        <View style={[styles.orb, { top: '45%', left: -150, backgroundColor: theme.colors.primary, width: 340, height: 340, opacity: 0.15 }]} />
        <View style={[styles.orb, { bottom: -100, right: -100, backgroundColor: theme.colors.secondary }]} /></>}
      </BlurTargetView>
      <BlurView blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={preferences.wallpaper ? preferences.blur : 85} tint="light" pointerEvents="none" style={StyleSheet.absoluteFill} />
      {children}
    </View>
  </Target.Provider>;
}

export function GlassSurface({ style, children, ...props }: ViewProps) {
  const { theme } = useAppearance();
  const target = useContext(Target);
  return <View {...props} style={[styles.surface, style]}>
    <BlurView pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" intensity={45} tint="light" style={StyleSheet.absoluteFill} />
    <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.6)', theme.colors.background + '3D', theme.colors.primarySoft + '30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
    {children}
  </View>;
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', width: 300, height: 300, borderRadius: 180, opacity: 0.65 },
  surface: { overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,248,235,0.4)' },
});
