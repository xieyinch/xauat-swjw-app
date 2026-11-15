import React, { useRef, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  changeFeedback, fetchFeedbackAttachmentUrl, fetchFeedbackCategories, fetchFeedbackDepartments,
  fetchFeedbackDetail, fetchFeedbackSession, fetchFeedbackTerm, submitFeedback,
  type FeedbackRecord,
} from '../../api/teachingFeedback';
import { SessionExpiredError } from '../../api/data';
import { FunctionShell } from '../../components/FunctionShell';
import { ListContainer } from '../../components/ListContainer';
import type { NativeFunctionProps } from '../../config/nativeFunctions';
import { useAsyncData } from '../../hooks/useAsyncData';
import { colors, spacing } from '../../theme';
import { AttachmentInput } from './TimelyEvaluationScreen';

type Id = string | number;
type Session = Awaited<ReturnType<typeof fetchFeedbackSession>>;
const statuses: Record<string, string> = {
  SUBMITTED: '已提交', PROCESSING: '处理中', FINISHED: '已结束', WITHDRAW: '已撤回', REJECTED: '已驳回',
};
const attachmentTypes = new Set(['doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'zip', 'rar']);

function Action({ title, onPress, selected = false, disabled = false }: {
  title: string; onPress: () => void; selected?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled}
    onPress={onPress} style={[styles.action, selected && styles.selected]}>
    <Text style={disabled ? styles.muted : styles.text}>{title}</Text>
  </Pressable>;
}

function Options({ choices, selected, set, placeholder }: {
  choices: { id: Id; nameZh: string }[]; selected: Id | null; set: (id: Id) => void; placeholder: string;
}) {
  return <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
    {choices.length ? choices.map(choice => (
      <Action key={choice.id} title={choice.nameZh} selected={choice.id === selected} onPress={() => set(choice.id)} />
    )) : <Text style={styles.muted}>{placeholder}</Text>}
  </ScrollView>;
}

function FeedbackForm({ session, term, record, onClose, onDone, onSessionExpired }: {
  session: Session; term: Id; record?: FeedbackRecord; onClose: () => void; onDone: () => void; onSessionExpired: () => void;
}) {
  const [first, setFirst] = useState<Id | null>(record?.questionFirstCategory.id ?? null);
  const [second, setSecond] = useState<Id | null>(record?.questionSecondCategory.id ?? null);
  const [department, setDepartment] = useState<Id | null>(record?.departmentVm?.id ?? null);
  const [content, setContent] = useState(record?.feedbackContent ?? '');
  const [attachment, setAttachment] = useState<{ file: Blob; name: string }>();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const categories = useAsyncData({ loader: () => fetchFeedbackCategories(session.token), deps: [session.token], onSessionExpired });
  const children = useAsyncData({
    loader: () => first == null ? Promise.resolve([]) : fetchFeedbackCategories(session.token, first),
    deps: [session.token, first], onSessionExpired,
  });
  const subcategory = children.data?.find(item => item.id === second);
  const needsDepartment = subcategory?.departmentSource === 'BY_USER';
  const bizType = needsDepartment ? subcategory.bizTypeAssoc : undefined;
  const departments = useAsyncData({
    loader: () => bizType == null ? Promise.resolve([]) : fetchFeedbackDepartments(session.token, bizType),
    deps: [session.token, bizType], onSessionExpired,
  });
  const valid = first != null && second != null && !!subcategory && !!content.trim()
    && (!needsDepartment || department != null) && !children.loading;
  const submit = () => {
    if (!valid || first == null || second == null) return;
    Alert.alert('提交教学反馈？', '', [
      { text: '取消', style: 'cancel' },
      { text: '提交', onPress: async () => {
        if (sending.current) return;
        sending.current = true;
        setBusy(true);
        try {
          await submitFeedback(session.token, {
            term, first, second, content: content.trim(), department: department ?? undefined, attachment, existing: record,
          });
          onDone();
        } catch (error) {
          if (error instanceof SessionExpiredError) onSessionExpired();
          Alert.alert('提交未确认', error instanceof Error ? error.message : '请返回列表核对后重试');
        } finally {
          sending.current = false;
          setBusy(false);
        }
      } },
    ]);
  };

  return <FunctionShell title={record ? '修改教学反馈' : '教学信息反馈'} onClose={() => { if (!sending.current) onClose(); }}>
    <ListContainer loading={categories.loading || categories.refreshing} error={categories.error} onRetry={categories.retry}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" pointerEvents={busy ? 'none' : 'auto'}>
        <Text style={styles.text}>一级分类</Text>
        <Options choices={categories.data ?? []} selected={first} placeholder="暂无分类" set={id => {
          if (id === first) return;
          setFirst(id); setSecond(null); setDepartment(null);
        }} />
        <Text style={styles.text}>二级分类</Text>
        {children.error ? <Action title="重试加载分类" onPress={children.retry} /> : (
          <Options choices={children.loading ? [] : children.data ?? []} selected={second} placeholder={first == null ? '先选择一级分类' : '暂无分类或正在加载'}
            set={id => { setSecond(id); setDepartment(null); }} />
        )}
        {needsDepartment && <>
          <Text style={styles.text}>处理部门</Text>
          {departments.error ? <Action title="重试加载部门" onPress={departments.retry} /> : (
            <Options choices={departments.loading ? [] : departments.data ?? []} selected={department} placeholder="暂无部门或正在加载" set={setDepartment} />
          )}
        </>}
        <TextInput accessibilityLabel="反馈内容" multiline placeholder="填写反馈内容" placeholderTextColor={colors.textSecondary}
          style={styles.input} value={content} onChangeText={setContent} editable={!busy} />
        {record?.file && !attachment && <Text style={styles.muted}>已附文件：{record.file.name}</Text>}
        <AttachmentInput value={attachment} onChange={setAttachment} extensions={attachmentTypes} />
        <Action title={busy ? '提交中…' : '提交反馈'} disabled={!valid || busy} onPress={submit} />
      </ScrollView>
    </ListContainer>
  </FunctionShell>;
}

function FeedbackDetails({ token, record, onClose, onSessionExpired }: {
  token: string; record: FeedbackRecord; onClose: () => void; onSessionExpired: () => void;
}) {
  const detail = useAsyncData({ loader: () => fetchFeedbackDetail(token, record.id), deps: [token, record.id], onSessionExpired });
  const info = detail.data?.teachingFeedbackTask ?? record;
  const solution = detail.data?.openResult ? detail.data.teachingFeedbackSolution : null;
  const files = [info.file, solution?.fileInfo].filter(file => file != null);
  return <FunctionShell title="反馈详情" onClose={onClose}>
    <ListContainer loading={detail.loading || detail.refreshing} error={detail.error} onRetry={detail.retry}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>{info.questionFirstCategory?.nameZh} · {info.questionSecondCategory?.nameZh}</Text>
        <Text style={styles.text}>{info.feedbackContent || '暂无正文'}</Text>
        {!!solution?.solution && <Text style={styles.text}>{solution.solution}</Text>}
        {files.map(file => <Action key={file.id} title={file.name} onPress={() => {
          void fetchFeedbackAttachmentUrl(token, file.id).then(url => Linking.openURL(url))
            .catch(() => Alert.alert('无法打开附件'));
        }} />)}
      </ScrollView>
    </ListContainer>
  </FunctionShell>;
}

function FeedbackList({ session, onClose, onSessionExpired }: NativeFunctionProps & { session: Session }) {
  const [term, setTerm] = useState(session.current.id);
  const [record, setRecord] = useState<FeedbackRecord | null>(null);
  const [editor, setEditor] = useState<{ existing?: FeedbackRecord } | null>(null);
  const [busy, setBusy] = useState(false);
  const changing = useRef(false);
  const list = useAsyncData({ loader: () => fetchFeedbackTerm(session.token, term), deps: [session.token, term], onSessionExpired });
  const canWrite = session.canWrite && list.data?.canProcess === true && !list.loading && !list.error;
  if (editor) return <FeedbackForm session={session} term={term} record={editor.existing} onSessionExpired={onSessionExpired}
    onClose={() => setEditor(null)} onDone={() => { setEditor(null); void list.reload(); }} />;
  if (record) return <FeedbackDetails token={session.token} record={record} onClose={() => setRecord(null)} onSessionExpired={onSessionExpired} />;

  function confirm(item: FeedbackRecord, action: 'withdraw' | 'delete') {
    const title = action === 'withdraw' ? '撤回' : '删除';
    Alert.alert(`确认${title}这条反馈？`, '', [
      { text: '取消', style: 'cancel' },
      { text: title, style: 'destructive', onPress: async () => {
        if (changing.current) return;
        changing.current = true;
        setBusy(true);
        try {
          await changeFeedback(session.token, term, item.id, action);
          await list.reload();
        } catch (error) {
          if (error instanceof SessionExpiredError) onSessionExpired();
          Alert.alert(`${title}未确认`, error instanceof Error ? error.message : '请刷新列表核对');
        } finally {
          changing.current = false;
          setBusy(false);
        }
      } },
    ]);
  }
  return <FunctionShell title="教学信息反馈" onClose={onClose}>
    <ListContainer loading={list.loading} error={list.error} onRetry={list.retry}>
      <ScrollView contentContainerStyle={styles.content} pointerEvents={busy ? 'none' : 'auto'}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.reload} />}>
        <Options choices={session.terms} selected={term} set={setTerm} placeholder="暂无学期" />
        <Action title={canWrite ? '问题反馈' : '当前不可新建反馈'} disabled={!canWrite} onPress={() => setEditor({})} />
        {!list.data?.records.length && <Text style={styles.muted}>暂无反馈记录</Text>}
        {list.data?.records.map(item => <View key={item.id} style={styles.card}>
          <Text style={styles.text}>{item.questionFirstCategory?.nameZh} · {item.questionSecondCategory?.nameZh}</Text>
          <Text style={styles.muted}>{statuses[item.status] ?? item.status} · {item.submitDateTime}</Text>
          {item.status === 'REJECTED' && !!item.solution && <Text style={styles.text}>{item.solution}</Text>}
          <View style={styles.row}>
            <Action title="详情" onPress={() => setRecord(item)} />
            {list.data?.canProcess && item.status === 'WITHDRAW' && <>
              <Action title="修改" onPress={() => setEditor({ existing: item })} />
              <Action title="删除" onPress={() => confirm(item, 'delete')} />
            </>}
            {list.data?.canProcess && item.status === 'SUBMITTED' && <Action title="撤回" onPress={() => confirm(item, 'withdraw')} />}
          </View>
        </View>)}
      </ScrollView>
    </ListContainer>
  </FunctionShell>;
}

export function TeachingFeedbackScreen(props: NativeFunctionProps) {
  const session = useAsyncData({ loader: fetchFeedbackSession, deps: [], onSessionExpired: props.onSessionExpired });
  if (session.data) return <FeedbackList session={session.data} {...props} />;
  return <FunctionShell title="教学信息反馈" onClose={props.onClose}>
    <ListContainer loading={session.loading || session.refreshing} error={session.error} onRetry={session.retry}>{null}</ListContainer>
  </FunctionShell>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.textSecondary, fontSize: 13 },
  action: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center' },
  selected: { borderColor: colors.primary, backgroundColor: colors.surface },
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: 10, backgroundColor: colors.surface },
  input: { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, minHeight: 100, textAlignVertical: 'top' },
});
