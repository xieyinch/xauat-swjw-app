import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { FunctionShell } from '../../components/FunctionShell';
import { KeyValueCard } from '../../components/KeyValueCard';
import { ListContainer } from '../../components/ListContainer';
import { fetchStudentInfoDetail } from '../../api/query';
import type { StudentInfoGroup } from '../../types';

interface Props {
  onClose: () => void;
  onSessionExpired: () => void;
}

export function StudentInfoScreen({ onClose, onSessionExpired }: Props) {
  const [groups, setGroups] = useState<StudentInfoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh?: boolean) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await fetchStudentInfoDetail();
        setGroups(data);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') {
          onSessionExpired();
          return;
        }
        setError((e as Error).message || '学籍信息加载失败');
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

  return (
    <FunctionShell title="学籍信息" onClose={onClose}>
      <ListContainer loading={loading} error={error} onRetry={() => load()} emptyText="暂无学籍信息">
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {groups.map((g) => (
            <KeyValueCard key={g.key} title={g.name} entries={g.entries} />
          ))}
        </ScrollView>
      </ListContainer>
    </FunctionShell>
  );
}
