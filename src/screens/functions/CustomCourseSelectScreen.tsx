import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { getStudentInfoCached } from '../../api/data';
import { customSelectApplyHref, fetchCustomSelectSwitches } from '../../api/query';
import type { CustomSelectSwitch } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
  openWebPage?: (title: string, path: string) => void;
}

function fmtRange(range: CustomSelectSwitch['selectDateTimeRange']): string {
  if (!range) return '';
  const short = (s: string | undefined) => (s ? s.slice(5, 16) : '');
  const a = short(range.startDateTime);
  const b = short(range.endDateTime);
  return a && b ? `${a} ~ ${b}` : a || b || '';
}

function Flag({ open, label }: { open: boolean; label: string }) {
  return (
    <View style={[styles.flag, open ? styles.flagOpen : styles.flagClosed]}>
      <Text style={[styles.flagText, open ? styles.flagOpenText : styles.flagClosedText]}>{label}</Text>
      <Ionicons
        name={open ? 'checkmark-circle' : 'close-circle'}
        size={14}
        color={open ? colors.success : colors.textSecondary}
      />
    </View>
  );
}

function Bulletin({ title, text }: { title: string; text?: string | null }) {
  if (!text) return null;
  return (
    <View style={styles.bulletinBox}>
      <Text style={styles.bulletinTitle}>{title}</Text>
      <Text style={styles.bulletinText}>{text}</Text>
    </View>
  );
}

function SwitchCard({ sw, onEnter }: { sw: CustomSelectSwitch; onEnter: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.semester}>{sw.semester.nameZh}</Text>
        <Text style={styles.tag}>个性化选课</Text>
      </View>

      <View style={styles.flagRow}>
        <Flag open={sw.selectOpen} label="选课申请" />
        <Flag open={sw.dropOpen} label="退课申请" />
        <Flag open={sw.exchangeOpen} label="换班申请" />
      </View>

      {sw.selectDateTimeRange ? (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>选课申请时间：{fmtRange(sw.selectDateTimeRange)}</Text>
        </View>
      ) : null}
      {sw.dropDateTimeRange ? (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>退课申请时间：{fmtRange(sw.dropDateTimeRange)}</Text>
        </View>
      ) : null}
      {sw.exchangeDateTimeRange ? (
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>换班申请时间：{fmtRange(sw.exchangeDateTimeRange)}</Text>
        </View>
      ) : null}

      <Bulletin title="选课公告" text={sw.selectBulletin} />
      <Bulletin title="退课公告" text={sw.dropBulletin} />
      <Bulletin title="换班公告" text={sw.exchangeBulletin} />

      <TouchableOpacity style={styles.enterBtn} onPress={onEnter}>
        <Text style={styles.enterText}>申请或退换课程</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export function CustomCourseSelectScreen({ onClose, onSessionExpired, openWebPage }: Props) {
  const [switches, setSwitches] = useState<CustomSelectSwitch[]>([]);
  const [studentId, setStudentId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const info = await getStudentInfoCached();
        setStudentId(info.studentId);
        const list = await fetchCustomSelectSwitches();
        setSwitches(list);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '个性化选课加载失败');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [onSessionExpired],
  );

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: CustomSelectSwitch }) => (
    <SwitchCard
      sw={item}
      onEnter={() => {
        if (studentId && openWebPage) {
          openWebPage('个性化选课', customSelectApplyHref(studentId, item));
        }
      }}
    />
  );

  return (
    <FunctionShell title="个性化选课申请" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyIcon="albums-outline" emptyText="暂无个性化选课安排">
        <FlatList
          data={switches}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          renderItem={renderItem}
        />
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  semester: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  tag: {
    fontSize: 11,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flagOpen: { borderColor: colors.success },
  flagClosed: { borderColor: colors.border },
  flagText: { fontSize: 11 },
  flagOpenText: { color: colors.success },
  flagClosedText: { color: colors.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  bulletinBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.surface },
  bulletinTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 2 },
  bulletinText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  enterText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
