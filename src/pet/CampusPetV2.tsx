import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useAppearance } from '../appearance';
import { fetchCourseTable, fetchGrades, fetchNotices, fetchSemesters, getStudentInfoCached, resolveCurrentSemester } from '../api/data';
import { todaySchedule } from '../api/schedule';
import { useSchoolDay } from '../hooks/useSchoolDay';
import { GlassSurface } from '../components/Glass';
import type { CourseTableData } from '../types';
import { cancelClassReminders, courseReminders, notifyUpdate, scheduleCourses } from './reminders';
import { petLine } from './lines';
import { changedKeys } from './diff';
import { AoraBall, type AoraEmotion } from './AoraBall';

type Message = { id: string; title: string; text: string; emotion: AoraEmotion; target?: string };
type SavedPosition = { side: 'left' | 'right'; yRatio: number };

const PET_SIZE = 72;
const EDGE = 10;
const TOP_GUARD = 50;
const BOTTOM_GUARD = 92;
const POSITION_KEY = 'xauat.pet.position.v2';
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function CampusPet({ onNavigate, onSessionExpired }: {
  onNavigate: (target: string) => void;
  onSettings: () => void;
  onSessionExpired: () => void;
}) {
  const { preferences, theme } = useAppearance();
  const colors = theme.colors;
  const day = useSchoolDay();
  const [message, setMessage] = useState<Message | null>(null);
  const [table, setTable] = useState<CourseTableData | null>(null);
  const [reduced, setReduced] = useState(false);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [positionLoaded, setPositionLoaded] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [pulse, setPulse] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;
  const currentPosition = useRef({ x: 0, y: 0 });
  const savedPosition = useRef<SavedPosition>({ side: 'right', yRatio: 0.68 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const counter = useRef(Math.floor(Math.random() * 10));
  const lastCheck = useRef(0);
  const greetingDay = useRef('');
  const shown = useRef(new Set<string>());
  const prefs = useRef(preferences);
  prefs.current = preferences;

  const verticalRange = useCallback((height: number) => ({
    min: Math.min(TOP_GUARD, Math.max(EDGE, height - PET_SIZE)),
    max: Math.max(TOP_GUARD, height - PET_SIZE - BOTTOM_GUARD),
  }), []);
  const show = useCallback((next: Message) => { setMessage(next); setPulse(value => value + 1); }, []);

  useEffect(() => {
    AsyncStorage.getItem(POSITION_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw) as SavedPosition;
        if ((parsed.side === 'left' || parsed.side === 'right') && Number.isFinite(parsed.yRatio)) {
          savedPosition.current = { side: parsed.side, yRatio: clamp(parsed.yRatio, 0, 1) };
          setSide(parsed.side);
        }
      }
    }).catch(() => {}).finally(() => setPositionLoaded(true));
  }, []);

  useEffect(() => {
    if (!positionLoaded || !bounds.width || !bounds.height) return;
    const range = verticalRange(bounds.height);
    const saved = savedPosition.current;
    const next = {
      x: saved.side === 'left' ? EDGE : bounds.width - PET_SIZE - EDGE,
      y: range.min + saved.yRatio * Math.max(0, range.max - range.min),
    };
    currentPosition.current = next;
    position.setValue(next);
  }, [bounds, position, positionLoaded, verticalRange]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 9000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    let disposed = false;
    let running = false;
    async function sync(force = false) {
      if (running || AppState.currentState !== 'active' || (!force && Date.now() - lastCheck.current < 5 * 60000)) return;
      running = true;
      lastCheck.current = Date.now();
      try {
        const info = await getStudentInfoCached();
        if (disposed) return;
        const key = `xauat.pet.${info.studentId}`;
        if (prefs.current.greeting && greetingDay.current !== day) {
          const last = await AsyncStorage.getItem(`${key}.hello`);
          if (!disposed && last !== day) {
            show({ id: `hello-${day}`, title: '橙橙 · 问候', text: petLine('hello', prefs.current.tone, counter.current++), emotion: 'happy' });
            await AsyncStorage.setItem(`${key}.hello`, day);
          }
          greetingDay.current = day;
        }

        const semesters = await fetchSemesters();
        if (disposed) return;
        const current = resolveCurrentSemester(semesters);
        if (current) try {
          const fresh = await fetchCourseTable(current.id);
          if (!disposed) setTable(fresh);
        } catch {}

        const compare = async (kind: 'grade' | 'notice', snapshot: Record<string, string>, target: string) => {
          if (disposed) return;
          const storageKey = `${key}.${kind}`;
          const stored = await AsyncStorage.getItem(storageKey);
          const previous = stored ? JSON.parse(stored) as Record<string, string> : null;
          const changes = changedKeys(previous, snapshot);
          await AsyncStorage.setItem(storageKey, JSON.stringify({ ...previous, ...snapshot }));
          if (!changes.length || disposed) return;
          const suffix = changes.length > 1 ? `（共 ${changes.length} 条）` : '';
          const text = petLine(kind, prefs.current.tone, counter.current++) + suffix;
          show({ id: `${kind}-${Date.now()}`, title: '橙橙 · 有新消息', text, emotion: kind === 'grade' ? 'done' : 'receiving', target });
          if (prefs.current.reminders) await notifyUpdate(text, target).catch(() => {});
        };

        try {
          const snapshot: Record<string, string> = {};
          const currentYear = Number(day.slice(0, 4));
          for (const semester of semesters.filter(item => /^\d{4}/.test(item.nameZh) && Number(item.nameZh.slice(0, 4)) <= currentYear)) {
            if (disposed || AppState.currentState !== 'active') return;
            const data = await fetchGrades(info.studentId, semester.id);
            for (const item of data.items) {
              if (item.published !== false && item.score !== '未录入') snapshot[`${semester.id}:${item.courseCode || item.courseName}`] = item.score;
            }
          }
          await compare('grade', snapshot, 'grade');
        } catch {}

        try {
          const notices = await fetchNotices();
          if (notices.length) await compare('notice', Object.fromEntries(notices.map(item => [item.id, `${item.title}|${item.date}`])), 'notices');
        } catch {}
      } catch (error) {
        if (!disposed && (error as Error).name === 'SessionExpiredError') onSessionExpired();
      } finally {
        running = false;
      }
    }
    void sync(true);
    const interval = setInterval(() => void sync(), 30000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void sync(true); });
    return () => { disposed = true; clearInterval(interval); sub.remove(); };
  }, [day, onSessionExpired, show]);

  useEffect(() => {
    if (!table) return;
    if (preferences.reminders) void scheduleCourses(table, preferences.classTimes).catch(() => {});
    else void cancelClassReminders().catch(() => {});
  }, [table, preferences.reminders, preferences.classTimes]);

  useEffect(() => {
    if (!table) return;
    const check = () => {
      if (AppState.currentState !== 'active') return;
      for (const reminder of courseReminders(table, preferences.classTimes, Date.now() - 60000)) {
        if (reminder.at <= Date.now() && !shown.current.has(reminder.id)) {
          shown.current.add(reminder.id);
          show({ id: reminder.id, title: '橙橙 · 该出发啦', text: petLine('class', preferences.tone, counter.current++, { course: reminder.course, place: reminder.place }), emotion: 'focused', target: 'schedule' });
        }
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [table, preferences.classTimes, preferences.tone, show]);

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse) => {
      const target = String(response.notification.request.content.data?.target || '');
      if (['schedule', 'grade', 'notices'].includes(target)) onNavigate(target);
    };
    void Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) { handle(response); void Notifications.clearLastNotificationResponseAsync(); }
    });
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [onNavigate]);

  const talk = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    const index = counter.current++;
    const today = table ? todaySchedule(table, day) : null;
    const text = index % 3 === 0 && today?.lessons.length
      ? `今天有 ${today.lessons.length} 门课，慢慢来，提前看一眼教室就好。`
      : petLine(index % 3 === 0 ? 'care' : 'touch', preferences.tone, index);
    show({ id: `touch-${Date.now()}`, title: `橙橙 · ${index % 2 ? '好奇' : '在这里'}`, text, emotion: index % 2 ? 'curious' : 'happy' });
  }, [day, preferences.tone, show, table]);

  const responders = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragging.current = false; dragStart.current = currentPosition.current; },
    onPanResponderMove: (_event, gesture) => {
      if (!bounds.width || !bounds.height) return;
      if (Math.hypot(gesture.dx, gesture.dy) > 4) dragging.current = true;
      if (!dragging.current) return;
      const range = verticalRange(bounds.height);
      const next = {
        x: clamp(dragStart.current.x + gesture.dx, EDGE, bounds.width - PET_SIZE - EDGE),
        y: clamp(dragStart.current.y + gesture.dy, range.min, range.max),
      };
      currentPosition.current = next;
      position.setValue(next);
    },
    onPanResponderRelease: (_event, gesture) => {
      if (!dragging.current && Math.hypot(gesture.dx, gesture.dy) < 5) { talk(); return; }
      const nextSide = currentPosition.current.x + PET_SIZE / 2 < bounds.width / 2 ? 'left' : 'right';
      const range = verticalRange(bounds.height);
      const x = nextSide === 'left' ? EDGE : bounds.width - PET_SIZE - EDGE;
      const yRatio = clamp((currentPosition.current.y - range.min) / Math.max(1, range.max - range.min), 0, 1);
      currentPosition.current = { x, y: currentPosition.current.y };
      savedPosition.current = { side: nextSide, yRatio };
      setSide(nextSide);
      void AsyncStorage.setItem(POSITION_KEY, JSON.stringify(savedPosition.current));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (reduced) position.setValue(currentPosition.current);
      else Animated.spring(position, { toValue: currentPosition.current, useNativeDriver: false, speed: 20, bounciness: 5 }).start();
    },
    onPanResponderTerminate: () => position.setValue(currentPosition.current),
  }), [bounds, position, reduced, talk, verticalRange]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== bounds.width || height !== bounds.height) setBounds({ width, height });
  };

  if (!preferences.pet) return null;
  const bubbleWidth = Math.min(296, Math.max(240, bounds.width - 32));
  const bubbleAbove = currentPosition.current.y > 165;

  return <View pointerEvents="box-none" onLayout={onLayout} style={StyleSheet.absoluteFill}>
    {bounds.width > 0 && <Animated.View pointerEvents="box-none" style={[styles.petAnchor, { transform: position.getTranslateTransform() }]}>
      {message && <Pressable
        accessibilityRole={message.target ? 'button' : undefined}
        accessibilityLabel={message.target ? `${message.text}，点击查看` : message.text}
        onPress={message.target ? () => { onNavigate(message.target!); setMessage(null); } : undefined}
        style={[styles.bubbleSlot, { width: bubbleWidth }, side === 'left' ? styles.bubbleLeft : styles.bubbleRight, bubbleAbove ? styles.bubbleAbove : styles.bubbleBelow]}
      >
        <GlassSurface style={[styles.bubble, { backgroundColor: colors.surface }]}>
          <Text style={[styles.bubbleTitle, { color: colors.primaryDark }]}>{message.title}</Text>
          <Text numberOfLines={3} style={[styles.bubbleText, { color: colors.text }]}>{message.text}</Text>
        </GlassSurface>
      </Pressable>}
      <Animated.View style={styles.ballTouch} {...responders.panHandlers}>
        <AoraBall emotion={message?.emotion || 'idle'} pulse={pulse} />
      </Animated.View>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  petAnchor: { position: 'absolute', left: 0, top: 0, width: PET_SIZE, height: PET_SIZE, zIndex: 20, elevation: 20 },
  ballTouch: { width: PET_SIZE, height: PET_SIZE },
  bubbleSlot: { position: 'absolute' },
  bubbleLeft: { left: 0 },
  bubbleRight: { right: 0 },
  bubbleAbove: { bottom: PET_SIZE + 8 },
  bubbleBelow: { top: PET_SIZE + 8 },
  bubble: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 22 },
  bubbleTitle: { fontSize: 13, lineHeight: 18, fontWeight: '800', letterSpacing: 0.3 },
  bubbleText: { marginTop: 7, fontSize: 16, lineHeight: 23, fontWeight: '600' },
});
