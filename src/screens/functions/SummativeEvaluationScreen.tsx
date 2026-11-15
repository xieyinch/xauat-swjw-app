import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  acknowledgeSummativeNotice, buildSurveySubmission, fetchSummativeResult, fetchSummativeSession,
  fetchSummativeTasks, submitSummativeEvaluation, SUMMATIVE_EVALUATION_PATH, type SummativeTask,
} from '../../api/timelyEvaluation';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import type { NativeFunctionProps } from '../../config/nativeFunctions';
import { useAsyncData } from '../../hooks/useAsyncData';
import { colors, spacing } from '../../theme';
import { EvaluationForm, EvaluationResultScreen } from './TimelyEvaluationScreen';

type Session = Awaited<ReturnType<typeof fetchSummativeSession>>;
const ROLES: Record<string, string> = { MAJOR: '主讲', MINOR: '助教', ASSISTANT: '助理' };
const DEFAULT_LIMITS: Record<string, { overCount: number; limitLine: number }> = {
  MAJOR: { overCount: 3, limitLine: 3 },
  MINOR: { overCount: 1, limitLine: 1 },
  ASSISTANT: { overCount: 999, limitLine: 0 },
};

function Button({ label, onPress, disabled = false, selected = false }: {
  label: string; onPress: () => void; disabled?: boolean; selected?: boolean;
}) {
  return (
    <Pressable style={[styles.button, selected && styles.selected]} accessibilityRole="button"
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}>
      <Text style={disabled ? styles.muted : styles.text}>{label}</Text>
    </Pressable>
  );
}

function Notice({ session, onRead }: { session: Session; onRead: () => void }) {
  const [remaining, setRemaining] = useState(Math.max(0, Number(session.config.time) || 0));
  const [busy, setBusy] = useState(false);
  const acknowledging = useRef(false);
  useEffect(() => {
    const end = Date.now() + Math.max(0, Number(session.config.time) || 0) * 1000;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [session.config.time]);
  const content = session.config.content?.replace(/<br\s*\/?\s*>|<\/p>/gi, '\n').replace(/<[^>]*>/g, '');
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.heading}>评教说明</Text>
      <Text style={styles.text}>{content}</Text>
      <Button label={busy ? '确认中…' : remaining ? `请阅读（${remaining} 秒）` : '已阅读'}
        disabled={busy || remaining > 0} onPress={async () => {
          if (acknowledging.current || remaining > 0) return;
          acknowledging.current = true;
          setBusy(true);
          try {
            await acknowledgeSummativeNotice(session.token);
            onRead();
          } catch (error) {
            Alert.alert('确认失败', error instanceof Error ? error.message : '请重试');
          } finally {
            acknowledging.current = false;
            setBusy(false);
          }
        }} />
    </ScrollView>
  );
}

function ByTask({ session, onClose, onSessionExpired, openWebPage }: NativeFunctionProps & { session: Session }) {
  const [term, setTerm] = useState(session.current.id);
  const [history, setHistory] = useState(false);
  const [read, setRead] = useState(session.read);
  const [task, setTask] = useState<SummativeTask | null>(null);
  const [result, setResult] = useState<SummativeTask | null>(null);
  const list = useAsyncData({
    loader: () => fetchSummativeTasks(session.token, term),
    deps: [session.token, term],
    onSessionExpired,
  });

  const openWeb = openWebPage && (() => openWebPage('学生总结性评教', SUMMATIVE_EVALUATION_PATH));

  if (task?.survey) {
    const { id: surveyId } = task.survey;
    const back = () => { setTask(null); void list.reload(); };
    return (
      <EvaluationForm
        title="总结性评教问卷" courseName={task.lesson.course.nameZh} teacherName={task.person.nameZh}
        surveyId={surveyId} token={session.token} permissions={session.permissions}
        permissionPrefix="summative-evaluation"
        buildForm={(survey, answers, anonymity) => buildSurveySubmission({ surveyId, taskId: task.id }, survey, answers, anonymity)}
        submitForm={(form, anonymity) => submitSummativeEvaluation(session.token, form, anonymity)}
        onBack={back} onDone={() => { back(); Alert.alert('评教已提交'); }}
        onSessionExpired={onSessionExpired} onOpenWeb={openWeb}
      />
    );
  }
  if (result) {
    return <EvaluationResultScreen token={session.token} record={result} onClose={() => setResult(null)} loadResult={fetchSummativeResult} />;
  }

  const rows = history ? list.data?.results : list.data?.tasks;
  const limits = { ...DEFAULT_LIMITS };
  for (const limit of session.config.limitDetails ?? []) limits[limit.role] = limit;
  const progressByCourse = new Map<string, { count: number; completed: number }>();
  const courseRole = (item: SummativeTask) => item.lesson.code + ':' + item.evaluatedTeacherType;
  for (const item of [...(list.data?.tasks ?? []), ...(list.data?.results ?? [])]) {
    const key = courseRole(item);
    const progress = progressByCourse.get(key) ?? { count: 0, completed: 0 };
    progress.count++;
    if (item.submitted || item.submitDateTime) progress.completed++;
    progressByCourse.set(key, progress);
  }
  return (
    <FunctionShell title="学生总结性评教" onClose={onClose}>
      {!read ? <Notice session={session} onRead={() => setRead(true)} /> : (
        <ListContainer loading={list.loading} error={list.error} onRetry={list.retry}>
          <ScrollView contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.reload} />}>
            <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
              {session.terms.map(item => <Button key={item.id} label={item.nameZh} selected={String(item.id) === String(term)} onPress={() => setTerm(item.id)} />)}
            </ScrollView>
            <View style={styles.row}>
              <Button label="我的评教" selected={!history} onPress={() => setHistory(false)} />
              <Button label="已完成评教" selected={history} onPress={() => setHistory(true)} />
            </View>
            {!history && session.config.intervalScoreEvaluations?.map((range, index) => (
              <Text key={index} style={styles.muted}>
                {range.intervalMinScore} ≤ 分数 {range.scoreIncludes ? '≤' : '<'} {range.intervalMaxScore} 的教师人数不超过 {range.intervalScoreRate}%
              </Text>
            ))}
            {!history && !!session.config.intervalScoreEvaluations?.length && (
              <Text style={styles.muted}>请先确定各分数区间的教师，再按从高到低的顺序依次打分。</Text>
            )}
            {!rows?.length && <Text style={styles.muted}>{history ? '暂无已完成评教' : '暂无待评任务'}</Text>}
            {rows?.map(item => {
              const progress = progressByCourse.get(courseRole(item));
              const limit = limits[item.evaluatedTeacherType];
              const submitted = Boolean(item.submitted || item.submitDateTime);
              return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.heading}>{item.lesson.course.nameZh}</Text>
                <Text style={styles.muted}>{item.person.nameZh} · {ROLES[item.evaluatedTeacherType] ?? item.evaluatedTeacherType} · {item.lesson.code}</Text>
                <Text style={styles.muted}>{item.surveyName ?? item.survey?.nameZh}</Text>
                {!history && limit && progress && progress.count > limit.overCount && (
                  <Text style={styles.muted}>该课程至少评价 {limit.limitLine} 人，已评价 {progress.completed} 人</Text>
                )}
                {history ? <Button label="查看详情" onPress={() => setResult(item)} /> : (
                  <Button label={submitted ? '已完成' : item.timeLimit ? '填写评教' : '未开放'}
                    disabled={submitted || !item.timeLimit || !item.survey} onPress={() => setTask(item)} />
                )}
              </View>
              );
            })}
          </ScrollView>
        </ListContainer>
      )}
      {!!openWeb && <Button label="打开教务网页" onPress={openWeb} />}
    </FunctionShell>
  );
}

export function SummativeEvaluationScreen(props: NativeFunctionProps) {
  const session = useAsyncData({ loader: fetchSummativeSession, deps: [], onSessionExpired: props.onSessionExpired });
  if (session.data) return <ByTask session={session.data} {...props} />;
  return (
    <FunctionShell title="学生总结性评教" onClose={props.onClose}>
      <ListContainer loading={session.loading || session.refreshing} error={session.error} onRetry={session.retry}>
        {null}
      </ListContainer>
      {!!props.openWebPage && <Button label="打开教务网页" onPress={() => props.openWebPage?.('学生总结性评教', SUMMATIVE_EVALUATION_PATH)} />}
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  heading: { color: colors.text, fontSize: 16, fontWeight: '600' },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.textSecondary, fontSize: 13 },
  button: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, alignItems: 'center' },
  selected: { borderColor: colors.primary, backgroundColor: colors.surface },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
});
