import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  applyReasons,
  cancelApply,
  checkApplyRange,
  checkCanApply,
  checkCanCancel,
  checkCanRevoke,
  fetchApplyWorkspace,
  fetchAssignees,
  fetchHistoryRows,
  fetchRevokeCandidates,
  fetchSelectCandidates,
  submitApply,
  lessonCourseName,
  lessonTeachers,
  lessonTimePlace,
  type AccountOption,
  type ApplyItem,
  type AppliedRow,
  type ApplyLesson,
  type SubmitApplyInput,
} from '../../api/personalSelectEngine';
import { SessionExpiredError } from '../../api/data';
import { getStudentInfoCached } from '../../api/data';
import type { CustomSelectSwitch } from '../../types';
import { colors, spacing } from '../../theme';
import { ListContainer } from '../../components/ListContainer';

type Tab = 'mine' | 'select' | 'revoke' | 'history';

interface Props {
  sw: CustomSelectSwitch;
  onBack: () => void;
  onSessionExpired: () => void;
  openWebPage?: (title: string, path: string) => void;
}

function ruleValue(rules: Array<{ rule: string; value: string | null }>, rule: string): string | null {
  const hit = rules.find((r) => r.rule === rule);
  return hit ? hit.value : null;
}

function MineRow({
  row,
  busy,
  onCancel,
  onOpen,
}: {
  row: AppliedRow;
  busy: boolean;
  onCancel: () => void;
  onOpen: (path: string, title: string) => void;
}) {
  const b = row.byHeader;
  const labels = [
    ['课程信息', b['课程信息']],
    ['教学班', b['教学班']],
    ['授课教师', b['授课教师']],
    ['时间地点', b['时间地点']],
    ['已选/上限', b['已选/人数上限']],
    ['申请类型', b['申请类型']],
    ['审核状态', b['审核状态']],
  ].filter(([, v]) => v && v !== '无数据');
  return (
    <View style={styles.card}>
      {labels.map(([k, v], i) => (
        <Text key={i} style={styles.cardRow} numberOfLines={2}>
          <Text style={styles.cardKey}>{k}：</Text>
          {v}
        </Text>
      ))}
      <View style={styles.opRow}>
        {row.cancelId ? (
          <TouchableOpacity
            style={[styles.opBtn, styles.opDanger]}
            disabled={busy}
            onPress={onCancel}
          >
            <Text style={styles.opDangerText}>取消申请</Text>
          </TouchableOpacity>
        ) : null}
        {row.infoId
          ? (() => {
              const p = `/student/for-std/course-select-apply/info/${row.infoId}?REDIRECT_URL=${encodeURIComponent(
                '/student/for-std/course-select-apply',
              )}`;
              return (
                <TouchableOpacity style={styles.opBtn} onPress={() => onOpen(p, '申请详情')}>
                  <Text style={styles.opText}>详情</Text>
                </TouchableOpacity>
              );
            })()
          : null}
        {row.printId
          ? (() => {
              const p = `/student/for-std/course-select-apply/print/${row.printId}?REDIRECT_URL=${encodeURIComponent(
                '/student/for-std/course-select-apply',
              )}`;
              return (
                <TouchableOpacity style={styles.opBtn} onPress={() => onOpen(p, '打印')}>
                  <Text style={styles.opText}>打印</Text>
                </TouchableOpacity>
              );
            })()
          : null}
      </View>
    </View>
  );
}

function SubmitModal({
  visible,
  applyType,
  selectedNames,
  conflictText,
  telephone,
  assignees,
  stage,
  nextNode,
  busy,
  onClose,
  onBack,
  onConfirm,
}: {
  visible: boolean;
  applyType: 'SELECT' | 'REVOKE' | 'EXCHANGE';
  selectedNames: string[];
  conflictText?: string | null;
  telephone?: string;
  assignees: AccountOption[];
  stage: 'form' | 'assign';
  nextNode?: string;
  busy: boolean;
  onClose: () => void;
  onBack: () => void;
  onConfirm: (payload: {
    reasonAssocs: number[];
    telephone: string;
    email: string;
    remark: string;
    assigneeId?: number | null;
  }) => void;
}) {
  const [reasons, setReasons] = useState<number[]>([]);
  const [phone, setPhone] = useState(telephone ?? '');
  const [email, setEmail] = useState('');
  const [remark, setRemark] = useState('');
  const [assignee, setAssignee] = useState<number | null>(null);
  useEffect(() => {
    if (visible) {
      setReasons([]);
      setPhone(telephone ?? '');
      setEmail('');
      setRemark('');
      setAssignee(null);
    }
  }, [visible, telephone]);
  useEffect(() => {
    setAssignee(null);
  }, [stage]);
  if (!visible) return null;
  const toggleReason = (v: number) =>
    setReasons((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const submitPayload = (assigneeId?: number | null) => ({
    reasonAssocs: reasons,
    telephone: phone,
    email,
    remark,
    assigneeId,
  });
  return (
    <View style={styles.modalMask}>
      <View style={styles.modalBox}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>
            {applyType === 'SELECT' ? '选课申请' : applyType === 'REVOKE' ? '退课申请' : '换班申请'} - 提交
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.md }}>
          {selectedNames.length ? (
            <Text style={styles.infoLine} numberOfLines={3}>
              {selectedNames.join('；')}
            </Text>
          ) : null}
          {conflictText ? (
            <Text style={styles.warnLine}>{conflictText}</Text>
          ) : null}
          {stage === 'form' ? (
            <>
              <Text style={styles.fieldLabel}>申请理由（可多选）</Text>
              <View style={styles.reasonWrap}>
                {applyReasons().map((r) => {
                  const on = reasons.includes(r.value);
                  return (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.reasonChip, on && styles.reasonChipOn]}
                      onPress={() => toggleReason(r.value)}
                    >
                      <Text style={[styles.reasonText, on && styles.reasonTextOn]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>联系电话</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="选填，便于审核联系"
                keyboardType="phone-pad"
              />
              <Text style={styles.fieldLabel}>邮箱</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="选填"
                keyboardType="email-address"
              />
              <Text style={styles.fieldLabel}>备注</Text>
              <TextInput
                style={[styles.input, styles.inputArea]}
                value={remark}
                onChangeText={setRemark}
                placeholder="选填（100字以内）"
                multiline
                maxLength={100}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, busy && styles.btnBusy]}
                disabled={busy}
                onPress={() => {
                  if (!reasons.length) {
                    Alert.alert('提示', '请选择至少一项申请理由');
                    return;
                  }
                  onConfirm(submitPayload(null));
                }}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>提交</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.backLinkRow} onPress={onBack}>
                <Ionicons name="arrow-back" size={15} color={colors.textSecondary} />
                <Text style={styles.backLinkText}>返回修改申请信息</Text>
              </TouchableOpacity>
              {nextNode ? <Text style={styles.infoLine}>下一审核节点：{nextNode}</Text> : null}
              <Text style={styles.fieldLabel}>选择审核人</Text>
              {assignees.map((a) => {
                const label = `${a.person?.nameZh ?? ''} (${a.loginName ?? ''})`;
                const dept = a.mngtDepartment?.nameZh;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.assignRow, assignee === a.id && styles.assignRowOn]}
                    onPress={() => setAssignee(a.id)}
                  >
                    <Text style={styles.assignText}>
                      {label}
                      {dept ? ` ${dept}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.primaryBtn, (busy || assignee == null) && styles.btnBusy]}
                disabled={busy || assignee == null}
                onPress={() => onConfirm(submitPayload(assignee))}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>提交</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function TabBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnOn]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PersonalApplyWorkspace({ sw, onBack, onSessionExpired, openWebPage }: Props) {
  const semesterId = sw.semester.id;
  const [tab, setTab] = useState<Tab>('mine');
  const [rows, setRows] = useState<AppliedRow[]>([]);
  const [mineLoading, setMineLoading] = useState(true);
  const [history, setHistory] = useState<AppliedRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cands, setCands] = useState<ApplyLesson[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [candRange, setCandRange] = useState<{ ok: boolean; message?: string } | null>(null);
  const [revokes, setRevokes] = useState<ApplyLesson[]>([]);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeRange, setRevokeRange] = useState<{ ok: boolean; message?: string } | null>(null);
  const [kw, setKw] = useState('');
  const [chosen, setChosen] = useState<Map<number, ApplyLesson>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<null | {
    applyType: 'SELECT' | 'REVOKE' | 'EXCHANGE';
    items: ApplyItem[];
    allApplys: ApplyLesson[];
    exemptApplys: ApplyItem[];
    selectedNames: string[];
    conflictText?: string | null;
  }>(null);
  const [assignees, setAssignees] = useState<AccountOption[]>([]);
  const [stage, setStage] = useState<'form' | 'assign'>('form');
  const [nextNode, setNextNode] = useState<string | undefined>(undefined);
  const [submitBusy, setSubmitBusy] = useState(false);

  const exemptMode = ruleValue(sw.selectRules ?? [], 'SELECT_APPLY_CONFLICT_EXEMPT');

  const loadMine = useCallback(
    async (asRefresh?: boolean) => {
      if (asRefresh) setRefreshing(true);
      setMineLoading(true);
      try {
        const w = await fetchApplyWorkspace(sw, {
          selectOpen: sw.selectOpen,
          dropOpen: sw.dropOpen,
          exchangeOpen: sw.exchangeOpen,
        });
        setRows(w.rows);
      } catch (e) {
        if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
        else Alert.alert('加载失败', (e as Error).message || '请稍后再试');
      } finally {
        setMineLoading(false);
        setRefreshing(false);
      }
    },
    [sw, onSessionExpired],
  );

  const loadSelect = useCallback(async () => {
    setCandLoading(true);
    try {
      const range = await checkApplyRange('SELECT', semesterId);
      setCandRange(range);
      if (range.ok) {
        const list = await fetchSelectCandidates(semesterId);
        setCands(list);
      } else {
        setCands([]);
      }
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
      else {
        setCandRange({ ok: false, message: (e as Error).message || '加载失败' });
        setCands([]);
      }
    } finally {
      setCandLoading(false);
    }
  }, [semesterId, onSessionExpired]);

  const loadRevoke = useCallback(async () => {
    setRevokeLoading(true);
    try {
      const range = await checkApplyRange('REVOKE', semesterId);
      setRevokeRange(range);
      if (range.ok) {
        const list = await fetchRevokeCandidates(semesterId);
        setRevokes(list);
      } else {
        setRevokes([]);
      }
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
      else {
        setRevokeRange({ ok: false, message: (e as Error).message || '加载失败' });
        setRevokes([]);
      }
    } finally {
      setRevokeLoading(false);
    }
  }, [semesterId, onSessionExpired]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const list = await fetchHistoryRows(semesterId);
      setHistory(list);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
      else Alert.alert('加载失败', (e as Error).message || '请稍后再试');
    } finally {
      setHistoryLoading(false);
    }
  }, [semesterId, onSessionExpired]);

  useEffect(() => {
    if (tab === 'mine' && !rows.length) loadMine();
    else if (tab === 'history') loadHistory();
    else if (tab === 'select') loadSelect();
    else if (tab === 'revoke') loadRevoke();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    if (!kw.trim()) return cands;
    const q = kw.trim().toLowerCase();
    return cands.filter(
      (l) =>
        (l.code || '').toLowerCase().includes(q) ||
        lessonCourseName(l).toLowerCase().includes(q) ||
        (l.nameZh || '').toLowerCase().includes(q),
    );
  }, [cands, kw]);

  const open = (path: string, title: string) => {
    if (openWebPage) openWebPage(title, path);
    else Alert.alert('提示', '当前环境不支持打开页面');
  };

  const doCancel = async (row: AppliedRow) => {
    const id = Number(row.cancelId);
    if (!id) return;
    setBusyId(`cancel:${id}`);
    try {
      const can = await checkCanCancel(id);
      if (!can) {
        Alert.alert('提示', '当前不在可取消时段内');
        return;
      }
      Alert.alert('取消申请', '确认取消该申请吗？', [
        { text: '再想想', style: 'cancel' },
        {
          text: '确认取消',
          style: 'destructive',
          onPress: async () => {
            try {
              const info = await getStudentInfoCached();
              await cancelApply([id], `/for-std/course-select-apply/${info.studentId}/switch/${sw.id}/apply`);
              Alert.alert('已取消', '申请已撤销');
              loadMine(true);
            } catch (e) {
              if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
              else Alert.alert('取消失败', (e as Error).message || '请稍后再试');
            }
          },
        },
      ]);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
      else Alert.alert('操作失败', (e as Error).message || '请稍后再试');
    } finally {
      setBusyId(null);
    }
  };

  const buildSubmit = async (
    applyType: 'SELECT' | 'REVOKE',
    allApplys: ApplyItem[],
    names: string[],
    lessons: ApplyLesson[],
  ) => {
    setBusyId('check');
    try {
      const check = await checkCanApply({ applyType, semesterId, allApplys });
      if (!check.result) {
        Alert.alert('无法申请', check.message || '申请校验未通过');
        return;
      }
      const conflicts = check.conflictDataList ?? [];
      let exempts: ApplyItem[] = [];
      let conflictText: string | null = null;
      if (conflicts.length) {
        conflictText = `存在 ${conflicts.length} 处时间/学时限冲突，仍将提交，最终以审核结果为准。`;
        if (applyType === 'SELECT') {
          const ids = new Set((check.exemptLessons ?? []).map((l) => l.id));
          const pool = allApplys.filter((a) => ids.has(a.newLessonAssoc ?? a.lessonAssoc));
          if (exemptMode === 'true') {
            exempts = pool;
          } else if (exemptMode === 'false' && pool.length) {
            const choice = await new Promise<boolean>((resolve) => {
              Alert.alert(
                '时间冲突',
                '部分教学班与现有课程冲突，是否一并办理免听申请？',
                [
                  { text: '不办理', style: 'cancel', onPress: () => resolve(false) },
                  { text: '办理免听', onPress: () => resolve(true) },
                ],
              );
            });
            if (choice) exempts = pool;
          }
        }
      }
      setAssignees([]);
      setNextNode(undefined);
      setStage('form');
      setSubmitState({
        applyType,
        items: allApplys,
        allApplys: lessons,
        exemptApplys: exempts,
        selectedNames: names,
        conflictText,
      });
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
      else Alert.alert('校验失败', (e as Error).message || '请稍后再试');
    } finally {
      setBusyId(null);
    }
  };

  const submitSelected = async () => {
    const lessons = Array.from(chosen.values());
    if (!lessons.length) return;
    const items: ApplyItem[] = lessons.map((l) => {
      const sgs = l.scheduleGroups ?? [];
      const group =
        sgs.length > 1 ? sgs.find((g) => g.default) ?? sgs[0] : sgs.length === 1 ? sgs[0] : null;
      return {
        oldLessonAssoc: l.id,
        newLessonAssoc: l.id,
        lessonAssoc: l.id,
        scheduleGroupAssoc: group ? group.id : null,
      };
    });
    const names = lessons.map((l) => `${lessonCourseName(l)} (${l.code})`);
    await buildSubmit('SELECT', items, names, lessons);
  };

  const doRevoke = async (l: ApplyLesson) => {
    setBusyId(`revoke:${l.id}`);
    try {
      const r = await checkCanRevoke(l.id, semesterId);
      if (!r.flag) {
        Alert.alert('不可退课', r.message || '该课已有成绩或存在限制，无法申请退课');
        return;
      }
      const item: ApplyItem = {
        oldLessonAssoc: l.id,
        newLessonAssoc: l.id,
        lessonAssoc: l.id,
        scheduleGroupAssoc: null,
      };
      await buildSubmit('REVOKE', [item], [`${lessonCourseName(l)} (${l.code})`], [l]);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
      else Alert.alert('退课申请失败', (e as Error).message || '请稍后再试');
    } finally {
      setBusyId(null);
    }
  };

  const confirmSubmit = async (payload: {
    reasonAssocs: number[];
    telephone: string;
    email: string;
    remark: string;
    assigneeId?: number | null;
  }) => {
    const st = submitState;
    if (!st) return;
    setSubmitBusy(true);
    const doSubmit = async (assignAccountAssoc: number | null) => {
      const input: SubmitApplyInput = {
        semesterId,
        applyType: st.applyType,
        applyReasonAssocs: payload.reasonAssocs,
        telephone: payload.telephone,
        email: payload.email,
        remark: payload.remark,
        allApplys: st.items,
        exemptApplys: st.exemptApplys,
        assignAccountAssoc,
      };
      const res = await submitApply(input);
      setSubmitState(null);
      setStage('form');
      setChosen(new Map());
      setTab('mine');
      loadMine(true);
      Alert.alert(res.success ? '提交成功' : '提示', res.content || '已提交，等待审核');
    };
    try {
      if (payload.assigneeId == null) {
        const assignRes = await fetchAssignees(
          st.exemptApplys.length ? 'EXEMPT' : st.applyType,
          st.items,
        );
        if (assignRes.need && !assignRes.accounts.length) {
          Alert.alert('提示', '未配置可用的审核人，请联系教务老师');
          return;
        }
        if (assignRes.need) {
          if (assignRes.accounts.length === 1) {
            await doSubmit(assignRes.accounts[0].id);
            return;
          }
          setAssignees(assignRes.accounts);
          setNextNode(assignRes.nextNode);
          setStage('assign');
          return;
        }
        await doSubmit(null);
        return;
      }
      await doSubmit(payload.assigneeId);
    } catch (e) {
      if ((e as Error).name === 'SessionExpiredError') onSessionExpired();
      else Alert.alert('提交失败', (e as Error).message || '请稍后再试');
    } finally {
      setSubmitBusy(false);
    }
  };

  const rangeText = (r: { ok: boolean; message?: string } | null) =>
    r && !r.ok ? r.message || '当前不可申请' : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.headTitle}>{sw.semester.nameZh} 个性化选课</Text>
      </View>

      <View style={styles.tabRow}>
        <TabBtn active={tab === 'mine'} label="我的申请" onPress={() => setTab('mine')} />
        <TabBtn active={tab === 'select'} label="选课申请" onPress={() => setTab('select')} />
        <TabBtn active={tab === 'revoke'} label="退课申请" onPress={() => setTab('revoke')} />
        <TabBtn active={tab === 'history'} label="历史记录" onPress={() => setTab('history')} />
      </View>

      {tab === 'mine' ? (
        <ListContainer
          loading={mineLoading}
          error={null}
          onRetry={() => loadMine()}
          emptyIcon="document-text-outline"
          emptyText="本学期暂无申请，可到“选课申请/退课申请”发起"
        >
          <FlatList
            data={rows}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMine(true)} />}
            renderItem={({ item }) => (
              <MineRow
                row={item}
                busy={busyId === `cancel:${item.cancelId}`}
                onCancel={() => doCancel(item)}
                onOpen={open}
              />
            )}
          />
        </ListContainer>
      ) : null}

      {tab === 'select' ? (
        <View style={styles.tabBody}>
          {rangeText(candRange) ? (
            <Text style={styles.warnLine}>{rangeText(candRange)}</Text>
          ) : null}
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={kw}
              onChangeText={setKw}
              placeholder="搜索课程名 / 课程代码"
              autoCapitalize="none"
            />
            {kw ? (
              <TouchableOpacity onPress={() => setKw('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          {candLoading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
          ) : cands.length ? (
            <FlatList
              data={filtered}
              keyExtractor={(l) => String(l.id)}
              renderItem={({ item }) => {
                const on = chosen.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.lessonCard, on && styles.lessonCardOn]}
                    onPress={() =>
                      setChosen((prev) => {
                        const next = new Map(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.set(item.id, item);
                        return next;
                      })
                    }
                  >
                    <View style={styles.lessonTop}>
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={on ? colors.primary : colors.textSecondary}
                      />
                      <Text style={styles.lessonName} numberOfLines={1}>
                        {lessonCourseName(item)}
                      </Text>
                      <Text style={styles.lessonCode} numberOfLines={1}>{item.code}</Text>
                    </View>
                    <Text style={styles.lessonMeta} numberOfLines={2}>
                      教学班：{item.nameZh}｜教师：{lessonTeachers(item)}
                    </Text>
                    <Text style={styles.lessonMeta} numberOfLines={2}>
                      {lessonTimePlace(item)}
                      {item.limitCount != null ? `｜限选 ${item.limitCount}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                kw ? <Text style={styles.emptyTip}>没有匹配的教学班</Text> : null
              }
            />
          ) : (
            <Text style={styles.emptyTip}>暂无可选教学班</Text>
          )}
          {chosen.size ? (
            <View style={styles.floatBar}>
              <Text style={styles.floatText}>已选 {chosen.size} 个教学班</Text>
              <TouchableOpacity
                style={[styles.floatBtn, busyId === 'check' && styles.btnBusy]}
                disabled={busyId === 'check'}
                onPress={submitSelected}
              >
                {busyId === 'check' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.floatBtnText}>提交选课申请</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {tab === 'revoke' ? (
        <View style={styles.tabBody}>
          {rangeText(revokeRange) ? <Text style={styles.warnLine}>{rangeText(revokeRange)}</Text> : null}
          {revokeLoading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
          ) : revokes.length ? (
            <FlatList
              data={revokes}
              keyExtractor={(l) => String(l.id)}
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              renderItem={({ item }) => (
                <View style={styles.lessonCard}>
                  <View style={styles.lessonTop}>
                    <Text style={styles.lessonName} numberOfLines={1}>
                      {lessonCourseName(item)}
                    </Text>
                    <Text style={styles.lessonCode} numberOfLines={1}>{item.code}</Text>
                  </View>
                  <Text style={styles.lessonMeta} numberOfLines={2}>
                    教学班：{item.nameZh}｜教师：{lessonTeachers(item)}
                  </Text>
                  <Text style={styles.lessonMeta} numberOfLines={2}>{lessonTimePlace(item)}</Text>
                  <TouchableOpacity
                    style={[styles.miniBtn, busyId === `revoke:${item.id}` && styles.btnBusy]}
                    disabled={busyId === `revoke:${item.id}`}
                    onPress={() => doRevoke(item)}
                  >
                    {busyId === `revoke:${item.id}` ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.miniBtnText}>申请退课</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            />
          ) : (
            <Text style={styles.emptyTip}>本学期暂无已修读课程可申请退课</Text>
          )}
        </View>
      ) : null}

      {tab === 'history' ? (
        <ListContainer loading={historyLoading} error={null} onRetry={() => loadHistory()} emptyIcon="time-outline" emptyText="暂无历史申请记录">
          <FlatList
            data={history}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            renderItem={({ item }) => (
              <MineRow
                row={item}
                busy={false}
                onCancel={() => undefined}
                onOpen={open}
              />
            )}
          />
        </ListContainer>
      ) : null}

      <SubmitModal
        visible={submitState != null}
        applyType={submitState?.applyType ?? 'SELECT'}
        selectedNames={submitState?.selectedNames ?? []}
        conflictText={submitState?.conflictText}
        telephone={undefined}
        assignees={assignees}
        stage={stage}
        nextNode={nextNode}
        busy={submitBusy}
        onClose={() => {
          setStage('form');
          setSubmitState(null);
        }}
        onBack={() => setStage('form')}
        onConfirm={confirmSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.background },
  headBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginRight: spacing.sm },
  backText: { color: colors.primary, fontSize: 14, marginLeft: 2 },
  headTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.xs },
  tabBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  tabBtnOn: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.textSecondary },
  tabTextOn: { color: '#fff', fontWeight: '600' },
  tabBody: { flex: 1, paddingTop: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  card: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardRow: { fontSize: 13, color: colors.text, lineHeight: 20 },
  cardKey: { color: colors.textSecondary },
  opRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  opBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  opText: { color: colors.primary, fontSize: 12 },
  opDanger: { borderColor: colors.danger },
  opDangerText: { color: colors.danger, fontSize: 12 },
  lessonCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  lessonCardOn: { borderColor: colors.primary, borderWidth: 1 },
  lessonTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lessonName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  lessonCode: { fontSize: 12, color: colors.textSecondary },
  lessonMeta: { marginTop: 4, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  miniBtn: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.primary,
    minWidth: 80,
    alignItems: 'center',
  },
  miniBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  btnBusy: { opacity: 0.6 },
  floatBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  floatText: { flex: 1, fontSize: 13, color: colors.text },
  floatBtn: {
    paddingHorizontal: spacing.lg,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 130,
  },
  floatBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyTip: { textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 13 },
  warnLine: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  infoLine: { color: colors.text, fontSize: 13, marginBottom: spacing.sm, lineHeight: 19 },
  modalMask: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 10,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    maxHeight: '82%',
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: 4 },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  reasonChipOn: { borderColor: colors.primary, backgroundColor: colors.surface },
  reasonText: { fontSize: 12, color: colors.textSecondary },
  reasonTextOn: { color: colors.primary, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    height: 40,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputArea: { height: 70, paddingTop: spacing.sm, textAlignVertical: 'top' },
  primaryBtn: {
    marginTop: spacing.md,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  assignRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    marginTop: 6,
  },
  assignRowOn: { borderColor: colors.primary, backgroundColor: colors.surface },
  assignText: { fontSize: 13, color: colors.text },
  backLinkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 3 },
  backLinkText: { color: colors.textSecondary, fontSize: 12 },
});
