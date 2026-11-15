import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchLibraryReservationRules, reservationRuleText } from '../api/libraryReservation';
import { FunctionShell } from '../components/FunctionShell';
import { ListContainer } from '../components/ListContainer';
import { useAsyncData } from '../hooks/useAsyncData';
import { colors, spacing } from '../theme';

const labels: Record<string, string> = { seat_rule: '座位', seminar_rule: '研讨间', activity_rule: '活动' };

export function LibraryReservationScreen({ onClose }: { onClose: () => void }) {
  const rules = useAsyncData({ loader: fetchLibraryReservationRules, deps: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const items = Object.entries(rules.data ?? {}).filter((entry): entry is [string, string] =>
    Boolean(labels[entry[0]]) && typeof entry[1] === 'string' && Boolean(entry[1].trim()));
  const active = items.find(([key]) => key === selected) ?? items[0];

  return (
    <FunctionShell title="图书馆预约规则" onClose={onClose}>
      <ListContainer loading={rules.loading || rules.refreshing} error={rules.error} onRetry={rules.retry}>
        <ScrollView contentContainerStyle={styles.content}>
          {!!active && (
            <View style={styles.tabs}>
              {items.map(([key]) => (
                <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === active[0] }}
                  onPress={() => setSelected(key)} style={[styles.tab, key === active[0] && styles.selected]}>
                  <Text style={styles.text}>{labels[key]}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {active
            ? reservationRuleText(active[1]).map((line, index) => <Text key={index} style={styles.text}>{line}</Text>)
            : <Text style={styles.text}>暂无预约规则</Text>}
        </ScrollView>
      </ListContainer>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm },
  text: { color: colors.text, fontSize: 15, lineHeight: 23 },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tab: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  selected: { borderColor: colors.primary, backgroundColor: colors.surface },
});
