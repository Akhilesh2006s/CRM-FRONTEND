import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { WebButton, WebInput, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/api';
import { Advance, AdvancePerson, AdvanceHistory, ADVANCE_TYPES, advanceDate, advanceMoney, advanceApprovalLabel, advanceRequestApprovalDescription, advanceCurrentAmount, advanceAmountLabel } from '../../lib/advance';

const message = (error: any) => error?.response?.data?.message || error?.message || 'Unable to load advances.';
const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const types: string[] = [...ADVANCE_TYPES];
const ErrorText = ({ error }: { error: string }) => error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null;

export function AdvanceRequestScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState({ advanceType: types[0], amount: '', date: day(new Date()), reason: '', scheduleDetails: '', remark: '' });
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async () => {
    if (busy) return;
    if (!form.reason.trim() || !form.remark.trim() || !form.date || !form.amount) { setError('Amount, date, reason, and remark are required.'); return; }
    setBusy(true); setError('');
    try { await apiService.post('/advances', form); navigation.replace('AdvanceStatus'); }
    catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  };
  return <ScreenShell title="Request Advance">
    <ErrorText error={error} />
    <PageSection title="Advance">
      <WebSelect label="Advance Type" value={form.advanceType} items={types.map((value, i) => ({ label: `${i + 1}. ${value}`, value }))} onValueChange={(v) => update('advanceType', v)} />
      <Text style={styles.muted}>{advanceRequestApprovalDescription(user?.role, form.advanceType)}</Text>
      <WebLabel>Advance Amount (₹) *</WebLabel><WebInput accessibilityLabel="Advance amount" keyboardType="decimal-pad" value={form.amount} onChangeText={(v) => update('amount', v)} />
    </PageSection>
    <PageSection title="Date">
      <WebLabel>Date *</WebLabel>
      {Platform.OS === 'web' ? React.createElement('input', { type: 'date', 'aria-label': 'Advance date', value: form.date, onChange: (e: any) => update('date', e.target.value), style: { padding: 12, border: '1px solid #ddd', borderRadius: 8 } })
        : <WebButton title={advanceDate(form.date)} variant="outline" onPress={() => setShowDate(true)} />}
      {showDate && <View><DateTimePicker value={new Date(`${form.date}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, date) => { if (Platform.OS !== 'ios') setShowDate(false); if (date) update('date', day(date)); }} />{Platform.OS === 'ios' && <WebButton title="Done" onPress={() => setShowDate(false)} />}</View>}
    </PageSection>
    <PageSection title="Details">
      {([['reason', 'Reason for Advance *'], ['scheduleDetails', 'Schedule Details (optional)'], ['remark', 'Remark *']] as const).map(([key, label]) => <View key={key}><WebLabel>{label}</WebLabel><WebInput accessibilityLabel={label} multiline maxLength={2000} style={styles.textarea} value={form[key]} onChangeText={(v) => update(key, v)} /></View>)}
    </PageSection>
    <WebButton title="Submit Request" loading={busy} onPress={submit} />
  </ScreenShell>;
}

function RequestCard({ advance, onPress }: { advance: Advance; onPress: () => void }) {
  return <Card onPress={onPress}>
    <CardTitle title={`${advance.employeeId?.name || 'Employee'} · ${advanceAmountLabel(advance)}`} subtitle={advance.advanceType} badge={advance.status} tone={toneFor(advance.status)} />
    <InfoRow label="Date" value={advanceDate(advance.date)} />
    <InfoRow label="Reason" value={advance.reason} />
    {advance.status === 'Pending' ? <InfoRow label="Pending with" value={advance.pendingWith.join(', ')} /> : null}
    <Text style={styles.cardLink}>{advance.canDecide ? 'Review request →' : 'View details →'}</Text>
  </Card>;
}

function RequestDetails({ advance, onClose, onUpdated }: { advance: Advance; onClose: () => void; onUpdated: (advance: Advance) => void }) {
  const { user } = useAuth();
  const canReview = user?.isSuperAdmin || user?.role === 'Super Admin' || user?.rbacEnabled === false
    || user?.permissions?.includes('advance.status.page.view') || user?.permissions?.includes('advance.approvals.page.view');
  const [people, setPeople] = useState<AdvancePerson[]>([]);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [ids, setIds] = useState(advance.approvals.filter((a) => a.stage === 'tagged').map((a) => a.approverId?._id || '').filter(Boolean));
  const [remarks, setRemarks] = useState('');
  const [amount, setAmount] = useState(String(advanceCurrentAmount(advance)));
  const amountValue = Number(amount);
  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && amountValue > 0;
  const amountChanged = amountValid && Math.abs(amountValue - advanceCurrentAmount(advance)) > 0.001;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saved = advance.approvals.filter((a) => a.stage === 'tagged').map((a) => a.approverId?._id || '').filter(Boolean);
  const dirty = [...ids].sort().join() !== [...saved].sort().join();
  useEffect(() => {
    if (!advance.canTagApprovers) return;
    let active = true;
    apiService.get('/advances/people?purpose=approvers').then((data) => { if (active) { setPeople(data); setReady(true); } }).catch((err) => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [advance.canTagApprovers]);
  const mutate = async (path: string, payload: object) => {
    setBusy(true); setError('');
    try {
      const updated: Advance = await apiService.put(`/advances/${advance._id}/${path}`, { ...payload, version: advance.__v });
      onUpdated(updated); setRemarks(''); setAmount(String(advanceCurrentAmount(updated)));
    }
    catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  };
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <ScrollView contentContainerStyle={styles.modal}>
      <WebButton title="Close" variant="outline" onPress={onClose} disabled={busy} />
      <Text style={styles.heading}>{advance.employeeId?.name} · {advanceAmountLabel(advance)}</Text>
      <Text>Requested: {advanceMoney(advance.amount)}{advance.approvedAmount != null ? ` · ${advance.status === 'Approved' ? 'Approved' : 'Approved so far'}: ${advanceMoney(advance.approvedAmount)}` : ''}</Text>
      <Text>{advance.advanceType} · {advanceDate(advance.date)}</Text>
      <Text style={styles.heading}>{advance.status}{advance.status === 'Pending' ? ` with ${advance.pendingWith.join(', ')}` : ''}</Text>
      <Text>Reason: {advance.reason}</Text><Text>Schedule: {advance.scheduleDetails || '—'}</Text><Text>Remark: {advance.remark}</Text>
      {advance.advanceType === types[1] && <Text style={styles.muted}>Incentive: excluded from expense deductions and balance adjustments.</Text>}
      <SectionTitle>Approval History</SectionTitle>
      {advance.approvals.map((a, i) => <View key={i} style={styles.card}><Text>{advanceApprovalLabel(a)} · {advance.status === 'Rejected' && a.status === 'Pending' ? 'Not required — request rejected' : a.status}</Text>
        {a.decidedBy && <Text style={styles.muted}>{a.decidedBy.name} {a.decidedAt ? `· ${advanceDate(a.decidedAt)}` : ''}{a.status === 'Approved' && a.amount != null ? ` · Approved ${advanceMoney(a.amount)}` : ''}</Text>}{!!a.remarks && <Text>{a.remarks}</Text>}</View>)}
      <ErrorText error={error} />
      {advance.canTagApprovers && canReview && <View style={styles.card}><Text style={styles.heading}>Tag Employees for Approval</Text><Text style={styles.muted}>Optional. Every tagged employee must approve before Finance. Save before approving.</Text>
        <WebInput placeholder="Search employees…" value={search} onChangeText={setSearch} />
        {!ready && <Text>Loading employees…</Text>}
        <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>{people.filter((p) => p._id !== advance.employeeId?._id && `${p.name} ${p.empCode || ''}`.toLowerCase().includes(search.toLowerCase())).map((p) => <TouchableOpacity key={p._id} accessibilityRole="checkbox" accessibilityState={{ checked: ids.includes(p._id) }} disabled={busy} style={styles.person} onPress={() => setIds((old) => old.includes(p._id) ? old.filter((id) => id !== p._id) : [...old, p._id])}>
          <Text>{ids.includes(p._id) ? '☑' : '☐'} {p.name} · {p.role}</Text></TouchableOpacity>)}</ScrollView>
        <WebButton title={`Save Approvers (${ids.length})`} variant="outline" disabled={busy || !ready || !dirty} onPress={() => mutate('approvers', { approverIds: ids })} />
      </View>}
      {advance.canDecide && canReview && <View style={styles.card}>
        {advance.canEditAmount && <View>
          <WebLabel>Approved Amount (₹)</WebLabel>
          <WebInput keyboardType="decimal-pad" value={amount} onChangeText={setAmount} editable={!busy} />
          <Text style={styles.muted}>Requested {advanceMoney(advance.amount)}{advance.approvedAmount != null && Math.abs(advance.approvedAmount - advance.amount) > 0.001 ? ` · previous approver set ${advanceMoney(advance.approvedAmount)}` : ''}. Change it if needed; a remark is then required.</Text>
          {!amountValid && <Text style={styles.negative}>Enter an amount greater than 0 with at most two decimals.</Text>}
        </View>}
        <WebLabel>{amountChanged ? 'Remark (required: amount changed)' : 'Approval Remarks / Rejection Reason'}</WebLabel>
        <WebInput multiline maxLength={2000} value={remarks} onChangeText={setRemarks} placeholder={amountChanged ? 'Why the amount was changed' : 'Optional when approving; required when rejecting'} />
        <WebButton title={amountChanged ? `Approve ${advanceMoney(amountValue)}` : 'Approve'} disabled={busy || dirty || (!!advance.canEditAmount && (!amountValid || (amountChanged && !remarks.trim())))}
          onPress={() => mutate('decision', { decision: 'Approved', remarks, ...(advance.canEditAmount ? { amount: amount.trim() } : {}) })} />
        <WebButton title="Reject" variant="destructive" disabled={busy || dirty || !remarks.trim()} onPress={() => mutate('decision', { decision: 'Rejected', remarks })} />
      </View>}
    </ScrollView>
  </Modal>;
}

/** The employee's own requests. Requests they approve for others are on Advance Approvals. */
export function AdvanceStatusScreen() {
  const [rows, setRows] = useState<Advance[]>([]);
  const [selected, setSelected] = useState<Advance | null>(null);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await apiService.get('/advances?mine=true')); }
    catch (err) { setError(message(err)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const visible = rows.filter((r) => (status === 'all' || status === r.status) && `${r.reason} ${r.advanceType}`.toLowerCase().includes(search.toLowerCase()));
  return <ScreenShell title="Advance Status" refreshing={loading} onRefresh={load}>
    <ErrorText error={error} />
    <WebInput placeholder="Search type or reason…" value={search} onChangeText={setSearch} />
    <WebSelect label="Status" value={status} onValueChange={setStatus} items={['all', 'Pending', 'Approved', 'Rejected'].map((value) => ({ value, label: value === 'all' ? 'All statuses' : value }))} />
    {loading ? <Text>Loading requests…</Text> : !visible.length ? <EmptyState icon="💰" title="No advance requests found" /> : visible.map((r) => <RequestCard key={r._id} advance={r} onPress={() => setSelected(r)} />)}
    {selected && <RequestDetails key={selected._id} advance={selected} onClose={() => setSelected(null)} onUpdated={(r) => { setSelected(r); setRows((old) => old.map((a) => a._id === r._id ? r : a)); }} />}
  </ScreenShell>;
}

type ApprovalTab = 'all' | 'Pending' | 'Rejected';
const APPROVAL_TABS: [ApprovalTab, string][] = [['all', 'All'], ['Pending', 'Pending'], ['Rejected', 'Rejected']];

/** Other employees' advance requests this user reviews (Admin, Super Admin, Finance, Zonal Manager, Product Head). */
export function AdvanceApprovalsScreen() {
  const [rows, setRows] = useState<Advance[]>([]);
  const [selected, setSelected] = useState<Advance | null>(null);
  const [tab, setTab] = useState<ApprovalTab>('Pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await apiService.get('/advances/approvals')); }
    catch (err) { setError(message(err)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const count = (t: ApprovalTab) => rows.filter((r) => t === 'all' || r.status === t).length;
  const awaitingMe = rows.filter((r) => r.canDecide).length;
  // Requests waiting on this user come first in every tab.
  const visible = rows
    .filter((r) => (tab === 'all' || r.status === tab) && `${r.reason} ${r.employeeId?.name || ''} ${r.employeeId?.empCode || ''} ${r.advanceType}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.canDecide) - Number(a.canDecide));
  return <ScreenShell title="Advance Approvals" refreshing={loading} onRefresh={load}>
    <ErrorText error={error} />
    <Text style={styles.muted}>Advance requests from other employees that you review. Your own requests are under Advance Status.{awaitingMe ? ` ${awaitingMe} waiting for your approval.` : ''}</Text>
    <View style={styles.tabRow}>
      {APPROVAL_TABS.map(([key, label]) => <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
        <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label} ({count(key)})</Text>
      </TouchableOpacity>)}
    </View>
    <WebInput placeholder="Search employee, type, or reason…" value={search} onChangeText={setSearch} />
    {loading ? <Text>Loading requests…</Text> : !visible.length ? <EmptyState icon="💰" title="No advance requests here" /> : visible.map((r) => <RequestCard key={r._id} advance={r} onPress={() => setSelected(r)} />)}
    {selected && <RequestDetails key={selected._id} advance={selected} onClose={() => setSelected(null)} onUpdated={(r) => { setSelected(r); setRows((old) => old.map((a) => a._id === r._id ? r : a)); }} />}
  </ScreenShell>;
}

export function AdvanceHistoryScreen() {
  const { user } = useAuth();
  const [people, setPeople] = useState<AdvancePerson[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [history, setHistory] = useState<AdvanceHistory | null>(null);
  const [selected, setSelected] = useState<Advance | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const canViewAll = user?.isSuperAdmin || ['Super Admin', 'Admin', 'Finance Manager'].includes(user?.role || '');
  const chosenId = employeeId || user?._id;
  useEffect(() => { if (canViewAll) apiService.get('/advances/people').then(setPeople).catch((err) => setError(message(err))); }, [canViewAll]);
  useFocusEffect(useCallback(() => {
    if (!chosenId) return;
    let active = true;
    let loading = false;
    setHistory(null);
    const load = async () => {
      if (loading) return;
      loading = true;
      try { const data = await apiService.get(`/advances/history?employeeId=${encodeURIComponent(chosenId)}`); if (active) { setHistory(data); setError(''); } }
      catch (err) { if (active) setError(message(err)); }
      finally { loading = false; }
    };
    void load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [chosenId, refresh]));
  return <ScreenShell title="Advance History" onRefresh={() => setRefresh((n) => n + 1)} refreshing={false}>
    <Text style={styles.muted}>All-time approved advances − final approved expenses. Incentives are excluded. Refreshes automatically after approval.</Text>
    {canViewAll && <WebSelect label="Employee" value={chosenId || ''} onValueChange={(id) => { setEmployeeId(id); setSelected(null); }} items={people.length ? people.map((p) => ({ value: p._id, label: `${p.name}${p.empCode ? ` (${p.empCode})` : ''}` })) : [{ value: user?._id || '', label: 'My history' }]} />}
    <ErrorText error={error} />
    {!history ? <Text>{error ? 'History unavailable. Pull to refresh.' : 'Loading history…'}</Text> : <>
      <View style={styles.card}>
        <Text>Approved Advances: {advanceMoney(history.totalAdvance)}</Text><Text>Total Approved Expenses: {advanceMoney(history.totalApprovedExpenses)}</Text>
        <Text style={[styles.heading, history.remainingBalance < 0 ? styles.negative : styles.positive]}>Remaining Balance: {advanceMoney(history.remainingBalance)}</Text>
        <Text>{history.remainingBalance > 0 ? 'Positive balance · advance available' : history.remainingBalance < 0 ? 'Negative balance · expenses exceed advances' : 'Zero balance'}</Text>
        <Text style={styles.muted}>Incentives (Excluded): {advanceMoney(history.totalIncentives)}</Text>
      </View>
      <SectionTitle>Balance History</SectionTitle>
      {!history.ledger.length && <Text>No approved advances or expenses yet.</Text>}
      {history.ledger.map((entry) => <View key={entry.id} style={styles.card}><Text>{advanceDate(entry.date)} · {entry.kind === 'incentive' ? 'Incentive (excluded)' : entry.kind === 'advance' ? 'Advance' : 'Approved expense'}</Text><Text>{entry.description}</Text>
        <Text>{entry.kind === 'expense' ? '−' : entry.kind === 'advance' ? '+' : ''}{advanceMoney(entry.amount)}</Text><Text style={entry.balance < 0 ? styles.negative : styles.positive}>Running Balance: {advanceMoney(entry.balance)}</Text></View>)}
      <SectionTitle>All Advance Requests</SectionTitle>
      {!history.requests.length && <Text>No advance requests yet.</Text>}
      {history.requests.map((r) => <RequestCard key={r._id} advance={r} onPress={() => setSelected(r)} />)}
    </>}
    {selected && <RequestDetails key={selected._id} advance={selected} onClose={() => setSelected(null)} onUpdated={(r) => { setSelected(r); setRefresh((n) => n + 1); }} />}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#EEF2F7', borderWidth: 1, borderRadius: 14, padding: 16, gap: 8, marginBottom: 12 },
  heading: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginVertical: 4 },
  muted: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
  cardLink: { fontSize: 14, fontWeight: '600', color: '#2563EB', marginTop: 8 },
  positive: { color: '#15803D' }, negative: { color: '#B91C1C' }, pending: { color: '#B45309' },
  error: { color: '#B91C1C', fontSize: 13, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 12, overflow: 'hidden' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  modal: { padding: 16, paddingTop: 52, paddingBottom: 40, gap: 12, backgroundColor: '#F8FAFC' },
  person: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: '#DCE3EC', backgroundColor: '#FFFFFF', alignItems: 'center' },
  tabOn: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  tabText: { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  tabTextOn: { color: '#FFFFFF' },
});
