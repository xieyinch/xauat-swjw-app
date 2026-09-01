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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RoomFreeScreen({ onClose, onSessionExpired }: Props) {
  const [campuses, setCampuses] = useState<RoomCampusOption[]>([]);
  const [campus, setCampus] = useState<number | ''>('');
  const [units, setUnits] = useState<RoomUnitOption[]>([]);
  const [date, setDate] = useState(todayStr());
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [items, setItems] = useState<RoomFreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoomCampusList()
      .then((list) => {
        setCampuses(list);
        if (list.length && !campus) setCampus(list[0].value);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (campus === '') return;
    fetchRoomUnits(Number(campus))
      .then((list) => {
        setUnits(list);
        setSelectedUnits(list.slice(0, 2).map((u) => u.value));
      })
      .catch(() => setUnits([]));
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
        const data = await fetchRoomFree({ campusId: campus, date, units: selectedUnits, weeks: [] });
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
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.dateText}>{date}</Text>
        </View>
      </View>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无空闲教室">
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
              {item.capacity != null ? <Text style={styles.capacity}>{item.capacity}人</Text> : null}
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
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dateText: { fontSize: 13, color: colors.textSecondary },
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
  capacity: { fontSize: 13, color: colors.primary, fontWeight: '600' },
});
