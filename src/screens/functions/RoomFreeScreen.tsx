import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchRoomCampusList, fetchRoomFree, fetchRoomUnits, type RoomCampusOption, type RoomUnitOption } from '../../api/query';
import type { RoomFreeItem } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function RoomFreeScreen({ onClose, onSessionExpired }: Props) {
  const [campuses, setCampuses] = useState<RoomCampusOption[]>([]);
  const [campus, setCampus] = useState<number | ''>('');
  const [units, setUnits] = useState<RoomUnitOption[]>([]);
  const [date, setDate] = useState<Date>(() => new Date());
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [items, setItems] = useState<RoomFreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shiftDate = useCallback((delta: number) => {
    setDate((d) => {
      const r = new Date(d);
      r.setDate(r.getDate() + delta);
      return r;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRoomCampusList()
      .then(async (list) => {
        if (cancelled) return;
        setCampuses(list);
        // 部分校区未配置节次（get-unit-campus 返回空），默认选第一个有节次的校区
        for (const c of list) {
          if (cancelled) return;
          const units = await fetchRoomUnits(c.value).catch(() => []);
          if (cancelled) return;
          if (units.length > 0) {
            setCampus(c.value);
            return;
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (campus === '') return;
    let cancelled = false;
    fetchRoomUnits(Number(campus))
      .then((list) => {
        if (cancelled) return;
        setUnits(list);
        setSelectedUnits(list.slice(0, 2).map((u) => u.value));
      })
      .catch(() => {
        if (!cancelled) setUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [campus]);

  const toggleUnit = useCallback((value: string) => {
    setSelectedUnits((prev) => (prev.includes(value) ? prev.filter((u) => u !== value) : [...prev, value].sort()));
  }, []);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (campus === '' || selectedUnits.length === 0) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchRoomFree({ campusId: campus, date: fmt(date), units: selectedUnits, weeks: [] });
        setItems(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '空闲教室查询失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [campus, date, selectedUnits, onSessionExpired],
  );

  // 当前校区无节次配置时给出提示，避免静默空白
  const noUnits = campus !== '' && units.length === 0;

  useEffect(() => {
    load();
  }, [load]);

  const campusOptions = useMemo(
    () => [{ text: '全部校区', value: '' as const }, ...campuses],
    [campuses],
  );

  return (
    <FunctionShell title="空闲教室查询" onClose={onClose}>
      <View style={styles.filters}>
        <View style={styles.chipRow}>
          {campusOptions.map((c) => (
            <TouchableOpacity
              key={String(c.value)}
              style={[styles.chip, campus === c.value && styles.chipActive]}
              onPress={() => setCampus(c.value as number | '')}
            >
              <Text style={[styles.chipText, campus === c.value && styles.chipTextActive]}>{c.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.chipRow}>
          {units.map((u) => (
            <TouchableOpacity
              key={u.value}
              style={[styles.chip, selectedUnits.includes(u.value) && styles.chipActive]}
              onPress={() => toggleUnit(u.value)}
            >
              <Text style={[styles.chipText, selectedUnits.includes(u.value) && styles.chipTextActive]}>
                {u.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateArrow} onPress={() => shiftDate(-1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateCenter} onPress={() => setDate(new Date())} activeOpacity={0.6}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.dateText}>{fmt(date)}</Text>
            <Text style={styles.dateWeekday}>周{WEEKDAYS[date.getDay()]}</Text>
            <Text style={styles.dateToday}>今天</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dateArrow} onPress={() => shiftDate(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <ListContainer
        loading={loading}
        error={error}
        onRetry={() => load()}
        emptyText={noUnits ? '该校区未配置查询节次，请选择其他校区' : '暂无空闲教室'}
      >
        <FlatList
          data={items}
          keyExtractor={(item, idx) => `${item.name}-${item.building}-${idx}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={({ item }) => (
            <View style={styles.roomCard}>
              <View style={styles.roomMain}>
                <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.roomMeta}>
                  {[item.building, item.campus, item.roomType].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.freeBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.freeBadgeText}>空闲</Text>
              </View>
            </View>
          )}
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  dateArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  dateText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  dateWeekday: { fontSize: 12, color: colors.textSecondary },
  dateToday: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  roomMain: { flex: 1, marginRight: spacing.md },
  roomName: { fontSize: 15, fontWeight: '600', color: colors.text },
  roomMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(18,183,106,0.12)',
  },
  freeBadgeText: { fontSize: 12, color: colors.success, fontWeight: '600' },
});
