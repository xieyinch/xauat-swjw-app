import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import { fetchOpenTurns } from '../../api/courseSelectEngine';
import { CourseSelectWorkspace } from './CourseSelectWorkspace';
import type { CourseSelectTurn } from '../../types';
import { colors, spacing } from '../../theme';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
  openWebPage?: (title: string, path: string) => void;
}

function Card({ turn, onEnter }: { turn: CourseSelectTurn; onEnter: () => void }) {
  const [rulesVisible, setRulesVisible] = useState(false);
  const open = turn.allowEnter;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.turnName} numberOfLines={2}>{turn.name}</Text>
        <View style={[styles.stateChip, open ? styles.stateOpen : styles.stateClosed]}>
          <Text style={[styles.stateText, open ? styles.stateOpenText : styles.stateClosedText]}>
            {open ? '可进入' : '未开放'}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.infoText}>选课时间：{turn.selectDateTimeText || '—'}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.infoText}>退课时间：{turn.dropDateTimeText || '—'}</Text>
      </View>
      {turn.bulletin ? (
        <View style={styles.bulletinBox}>
          <Text style={styles.bulletinText}>{turn.bulletin}</Text>
        </View>
      ) : null}

      {(turn.addRulesText.length || turn.dropRulesText.length) ? (
        <TouchableOpacity style={styles.rulesToggle} onPress={() => setRulesVisible((v) => !v)}>
          <Text style={styles.rulesToggleText}>选课与退课规则（共 {turn.addRulesText.length + turn.dropRulesText.length} 条）</Text>
          <Ionicons name={rulesVisible ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}
      {rulesVisible ? (
        <View style={styles.rulesBox}>
          {turn.addRulesText.length ? (
            <View>
              <Text style={styles.rulesTitle}>选课规则</Text>
              {turn.addRulesText.map((r, i) => (
                <Text key={`a-${i}`} style={styles.ruleText}>· {r}</Text>
              ))}
            </View>
          ) : null}
          {turn.dropRulesText.length ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={styles.rulesTitle}>退课规则</Text>
              {turn.dropRulesText.map((r, i) => (
                <Text key={`d-${i}`} style={styles.ruleText}>· {r}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {open ? (
        <TouchableOpacity style={styles.enterBtn} onPress={onEnter}>
          <Text style={styles.enterText}>进入选课</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.disallowBox}>
          {turn.disallowReasons.map((r, i) => (
            <Text key={`dr-${i}`} style={styles.disallowText}>· {r}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

export function CourseSelectTurnsScreen({ onClose, onSessionExpired }: Props) {
  const [turns, setTurns] = useState<CourseSelectTurn[]>([]);
  const [activeTurn, setActiveTurn] = useState<CourseSelectTurn | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchOpenTurns();
        setTurns(list);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '选课批次加载失败');
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

  const renderItem = ({ item }: { item: CourseSelectTurn }) => (
    <Card turn={item} onEnter={() => setActiveTurn(item)} />
  );

  return (
    <FunctionShell title="选课" onClose={onClose}>
      {activeTurn ? (
        <CourseSelectWorkspace
          turn={activeTurn}
          onBack={() => setActiveTurn(null)}
          onSessionExpired={onSessionExpired}
        />
      ) : (
        <ListContainer loading={loading} error={error} onRetry={() => load()} emptyIcon="albums-outline" emptyText="暂无开放的选课批次">
          <FlatList
            data={turns}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
            renderItem={renderItem}
          />
        </ListContainer>
      )}
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
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  turnName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, marginRight: spacing.sm },
  stateChip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  stateOpen: { borderColor: colors.success },
  stateClosed: { borderColor: colors.border },
  stateText: { fontSize: 11 },
  stateOpenText: { color: colors.success },
  stateClosedText: { color: colors.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 3 },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  bulletinBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.surface },
  bulletinText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  rulesToggle: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs },
  rulesToggleText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  rulesBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.surface },
  rulesTitle: { fontSize: 12, fontWeight: '700', color: colors.text, marginBottom: 2 },
  ruleText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  disallowBox: { marginTop: spacing.sm, padding: spacing.sm, borderRadius: 8, backgroundColor: colors.surface },
  disallowText: { fontSize: 12, color: colors.danger, lineHeight: 18 },
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
