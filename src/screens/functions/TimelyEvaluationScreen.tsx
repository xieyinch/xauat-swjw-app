import React, { useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SessionExpiredError } from '../../api/data';
import {
  buildEvaluationSubmission, fetchEvaluationHistory, fetchEvaluationResult, fetchEvaluationSurvey, fetchEvaluationTasks, submitEvaluation,
  surveyQuestions, TIMELY_EVALUATION_PATH,
  type EvaluationAnswer, type EvaluationResult, type EvaluationSurvey, type EvaluationTask, type SurveyQuestion,
} from '../../api/timelyEvaluation';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import type { NativeFunctionProps } from '../../config/nativeFunctions';
import { useAsyncData } from '../../hooks/useAsyncData';
import { colors, spacing } from '../../theme';

function Choice({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

function QuestionInput({ question, answer, change }: {
  question: SurveyQuestion; answer: EvaluationAnswer; change: (value: EvaluationAnswer) => void;
}) {
  const title = question.title + (question.required ? ' *' : '');
  const selected = answer.selected ?? [];

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{title}</Text>
      {question.type === 'upload' && <Text style={styles.muted}>附件题请在教务网页填写。</Text>}
      {question.type === 'multiple' && !!question.maxOptionCount && (
        <Text style={styles.muted}>最多选 {question.maxOptionCount} 项</Text>
      )}
      {(question.type === 'radio' || question.type === 'multiple') && question.options?.map(option => {
        const checked = selected.includes(option.name);
        const toggle = () => {
          if (question.type === 'radio') {
            change({ ...answer, selected: [option.name] });
          } else if (checked) {
            change({ ...answer, selected: selected.filter(value => value !== option.name) });
          } else if (!question.maxOptionCount || selected.length < question.maxOptionCount) {
            change({ ...answer, selected: [...selected, option.name] });
          }
        };
        return (
          <View key={option.name} style={styles.group}>
            <Choice label={option.name} selected={checked} onPress={toggle} />
            {checked && option.customize && (
              <TextInput
                accessibilityLabel={option.name}
                placeholder="请输入具体内容"
                placeholderTextColor={colors.textSecondary}
                maxLength={question.maxLength || undefined}
                style={styles.input}
                value={answer.custom?.[option.name] ?? ''}
                onChangeText={value => change({ ...answer, custom: { ...answer.custom, [option.name]: value } })}
              />
            )}
          </View>
        );
      })}
      {question.type === 'blank' && (
        <TextInput
          accessibilityLabel={title} multiline style={styles.input}
          maxLength={question.maxLength || undefined} value={answer.text ?? ''}
          onChangeText={text => change({ ...answer, text })}
        />
      )}
      {question.type === 'mulblank' && question.fillInBlankOptions?.map((option, index) => (
        <View key={index} style={styles.group}>
          <Text style={styles.text}>{option.name}</Text>
          <TextInput
            accessibilityLabel={option.name} multiline style={styles.input}
            maxLength={question.maxLength || 1000} value={answer.blanks?.[index] ?? ''}
            onChangeText={value => {
              const blanks = (question.fillInBlankOptions ?? []).map((_, i) => i === index ? value : answer.blanks?.[i] ?? '');
              change({ ...answer, blanks });
            }}
          />
        </View>
      ))}
      {question.type === 'mark' && (
        <View style={styles.choices}>
          {Array.from({ length: (question.count ?? 5) * 2 }, (_, i) => (i + 1) / 2).map(value => (
            <Choice key={value} label={String(value)} selected={answer.rating === value} onPress={() => change({ rating: value })} />
          ))}
        </View>
      )}
    </View>
  );
}

type EvaluationSession = Awaited<ReturnType<typeof fetchEvaluationTasks>>;

export function EvaluationForm({
  title, courseName, teacherName, surveyId, token, permissions, permissionPrefix,
  buildForm, submitForm, onBack, onDone, onSessionExpired, onOpenWeb,
}: {
  title: string;
  courseName: string;
  teacherName: string;
  surveyId: number | string;
  token: string;
  permissions: string[];
  permissionPrefix: 'timely-evaluation' | 'summative-evaluation';
  buildForm: (survey: EvaluationSurvey, answers: Record<string, EvaluationAnswer>, anonymity: boolean) => FormData;
  submitForm: (form: FormData, anonymity: boolean) => Promise<unknown>;
  onBack: () => void;
  onDone: () => void;
  onSessionExpired: () => void;
  onOpenWeb?: () => void;
}) {
  const survey = useAsyncData({
    loader: () => fetchEvaluationSurvey(token, surveyId),
    deps: [token, surveyId],
  });
  const [answers, setAnswers] = useState<Record<string, EvaluationAnswer>>({});
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [checkRequired, setCheckRequired] = useState(false);
  const questions = survey.data ? surveyQuestions(survey.data) : [];

  function confirm(anonymity: boolean) {
    if (!survey.data || sending.current || checkRequired) return;
    let form: FormData;
    try {
      form = buildForm(survey.data, answers, anonymity);
    } catch (error) {
      Alert.alert('请检查问卷', error instanceof Error ? error.message : '问卷无法提交');
      return;
    }
    Alert.alert('确认提交评教？', courseName, [
      { text: '继续填写', style: 'cancel' },
      { text: '提交', onPress: async () => {
        if (sending.current) return;
        sending.current = true;
        setBusy(true);
        try {
          await submitForm(form, anonymity);
          onDone();
        } catch (error) {
          setCheckRequired(true);
          if (error instanceof SessionExpiredError) onSessionExpired();
          Alert.alert('未能确认提交成功', '请返回列表刷新，核对该课程是否仍在待评列表中，再决定是否重试。');
        } finally {
          sending.current = false;
          setBusy(false);
        }
      } },
    ]);
  }

  return (
    <FunctionShell title={title} onClose={() => { if (!sending.current) onBack(); }}>
      <ListContainer loading={survey.loading || survey.refreshing} error={survey.error} onRetry={survey.retry}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>{survey.data?.nameZh}</Text>
          <Text style={styles.muted}>{courseName} · {teacherName}</Text>
          {!!survey.data?.description && <Text style={styles.text}>{survey.data.description}</Text>}
          {questions.map(question => (
            <QuestionInput
              key={question.type + question.id} question={question} answer={answers[question.id] ?? {}}
              change={value => setAnswers(previous => ({ ...previous, [question.id]: value }))}
            />
          ))}
          {checkRequired ? (
            <Choice label="返回并刷新待评列表" onPress={onBack} />
          ) : questions.some(question => question.type === 'upload') ? (
            onOpenWeb && <Choice label="打开教务网页" onPress={onOpenWeb} />
          ) : questions.some(question => question.type !== 'header') && (
            <View style={styles.choices}>
              {permissions.includes(permissionPrefix + ':submit') && <Choice label={busy ? '提交中…' : '提交'} onPress={() => confirm(false)} />}
              {permissions.includes(permissionPrefix + ':anonymity-submit') && <Choice label={busy ? '提交中…' : '匿名提交'} onPress={() => confirm(true)} />}
            </View>
          )}
        </ScrollView>
      </ListContainer>
    </FunctionShell>
  );
}

export function EvaluationResultScreen({ token, record, onClose, loadResult = fetchEvaluationResult }: {
  token: string; record: Pick<EvaluationResult, 'id' | 'lesson' | 'person'>; onClose: () => void;
  loadResult?: typeof fetchEvaluationResult;
}) {
  const detail = useAsyncData({ loader: () => loadResult(token, record.id), deps: [token, record.id, loadResult] });
  return (
    <FunctionShell title="已评详情" onClose={onClose}>
      <ListContainer loading={detail.loading || detail.refreshing} error={detail.error} onRetry={detail.retry}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>{record.lesson.course.nameZh}</Text>
          <Text style={styles.muted}>{record.person.nameZh} · {detail.data?.submitDateTime}</Text>
          <Text style={styles.text}>{detail.data?.survey.nameZh}</Text>
          {detail.data?.answers?.map((answer, index) => {
            let result: string | undefined = answer.questionResult?.replace(/<br\s*\/?\s*>/gi, '\n');
            if (answer.questionType === '单选题' && !detail.data?.displayConfig?.showQuestionScore) result = undefined;
            if (answer.questionType === '打分题') {
              result = detail.data?.displayConfig?.showMarkScore && answer.count != null ? String(answer.count) : undefined;
            }
            return (
              <View key={index} style={styles.card}>
                <Text style={styles.heading}>{answer.questionTitle}</Text>
                <Text style={styles.text}>{result ?? '—'}</Text>
              </View>
            );
          })}
          {detail.data?.feedbacks?.map((feedback, index) => (
            <View key={index} style={styles.card}>
              <Text style={styles.heading}>教师回复 · {feedback.updateTime}</Text>
              <Text style={styles.text}>{feedback.content}</Text>
            </View>
          ))}
        </ScrollView>
      </ListContainer>
    </FunctionShell>
  );
}

function EvaluationHistory({ session }: { session: EvaluationSession }) {
  const [record, setRecord] = useState<EvaluationResult | null>(null);
  const history = useAsyncData({
    loader: () => fetchEvaluationHistory(session.token, session.semesterId),
    deps: [session.token, session.semesterId],
  });
  if (record) return <EvaluationResultScreen token={session.token} record={record} onClose={() => setRecord(null)} />;
  return (
    <ListContainer loading={history.loading} error={history.error} onRetry={history.retry}>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={history.refreshing} onRefresh={history.reload} />}>
        {!history.data?.length && <Text style={styles.muted}>暂无已评记录</Text>}
        {history.data?.map(item => (
          <Pressable key={item.id} accessibilityRole="button" style={styles.card} onPress={() => setRecord(item)}>
            <Text style={styles.heading}>{item.lesson.course.nameZh}</Text>
            <Text style={styles.muted}>{item.person.nameZh} · {item.date}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </ListContainer>
  );
}

export function TimelyEvaluationScreen({ onClose, onSessionExpired, openWebPage }: NativeFunctionProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [week, setWeek] = useState<number | null>(null);
  const [task, setTask] = useState<EvaluationTask | null>(null);
  const list = useAsyncData({ loader: fetchEvaluationTasks, deps: [], onSessionExpired });

  if (task && list.data) {
    const { token, permissions } = list.data;
    const surveyId = task.surveies[task.surveies.length - 1].id;
    const back = () => { setTask(null); void list.reload(); };
    return (
      <EvaluationForm
        title="即时性评价问卷"
        courseName={task.lesson.course.nameZh}
        teacherName={task.evaluatedTeacher.person.nameZh}
        surveyId={surveyId} token={token} permissions={permissions} permissionPrefix="timely-evaluation"
        buildForm={(survey, answers, anonymity) => buildEvaluationSubmission(task, surveyId, survey, answers, anonymity)}
        submitForm={form => submitEvaluation(token, form)}
        onBack={back}
        onDone={() => { back(); Alert.alert('评教已提交'); }}
        onSessionExpired={onSessionExpired}
        onOpenWeb={openWebPage && (() => openWebPage('学生即时性评价', TIMELY_EVALUATION_PATH))}
      />
    );
  }

  return (
    <FunctionShell title="学生即时性评价" onClose={onClose}>
      <View style={styles.tabs}>
        <Choice label="我的评教" selected={!showHistory} onPress={() => setShowHistory(false)} />
        <Choice label="已评信息" selected={showHistory} onPress={() => setShowHistory(true)} />
      </View>
      {showHistory && list.data ? <EvaluationHistory session={list.data} /> : (
      <ListContainer loading={list.loading} error={list.error} onRetry={list.retry}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.reload} />}
        >
          {!list.data?.weeks.length && <Text style={styles.muted}>暂无即时性评价</Text>}
          {list.data?.weeks.map(item => (
            <View key={item.week} style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: week === item.week }} onPress={() => setWeek(week === item.week ? null : item.week)}>
                <Text style={styles.heading}>第 {item.week} 周 · {item.studentImmediateTasks.length} 项待评</Text>
                <Text style={styles.muted}>{item.startDate} — {item.endDate}</Text>
              </Pressable>
              {week === item.week && item.studentImmediateTasks.map(record => {
                const { lesson, schedule, evaluatedTeacher } = record;
                return (
                  <View key={[lesson.id, evaluatedTeacher.person.id, schedule.dateStr, schedule.unittimeBegin].join(':')} style={styles.task}>
                    <Text style={styles.heading}>{lesson.course.nameZh}</Text>
                    <Text style={styles.muted}>{evaluatedTeacher.person.nameZh} · {schedule.dateStr} · 第 {schedule.unittimeBegin}–{schedule.unittimeEnd} 节</Text>
                    {!!schedule.room?.nameZh && <Text style={styles.muted}>{schedule.room.nameZh}</Text>}
                    {!!record.surveies.length && <Choice label="填写评教" onPress={() => setTask(record)} />}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </ListContainer>
      )}
      {!!openWebPage && (
        <Pressable style={styles.web} onPress={() => openWebPage('学生即时性评价', TIMELY_EVALUATION_PATH)}>
          <Text style={styles.muted}>打开教务网页</Text>
        </Pressable>
      )}
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  tabs: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  group: { gap: spacing.xs },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, gap: spacing.sm },
  heading: { color: colors.text, fontWeight: '600', fontSize: 16 },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.textSecondary, fontSize: 13 },
  task: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: { padding: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.primary, backgroundColor: colors.background },
  input: { padding: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border, color: colors.text, textAlignVertical: 'top', minHeight: 48 },
  web: { alignItems: 'center', padding: spacing.md },
});
