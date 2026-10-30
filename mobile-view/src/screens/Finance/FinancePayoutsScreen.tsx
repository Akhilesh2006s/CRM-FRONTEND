import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory, downloadAsync, writeAsStringAsync } from 'expo-file-system/legacy';
import ScreenShell from '../../ui/ScreenShell';
import DateField from '../../ui/DateField';
import { WebButton, WebInput, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';
import { colors, radii, spacing } from '../../theme/colors';
import { formatDate } from '../../utils/dateFormat';
import { showAlert } from '../../utils/showAlert';

/**
 * Finance Executive: Finance-approved expenses and advances, the bank sheet, bank credit status and
 * the salary sheet. One screen, four menu entries (FinancePayouts / FinanceBankSheet /
 * FinanceCreditStatus / FinanceSalarySheet).
 */
type Mode = 'list' | 'bank-sheet' | 'credit-status' | 'salary-sheet';
type SalaryMonth = { month: string; label: string; employees: number; total: number };

type PayoutEmployee = { _id: string; name: string; empCode: string; role: string; zone: string; hasBankDetails: boolean; bankName: string; ifsc: string; accountLast4: string };
type PayoutItem = {
  kind: 'expense' | 'advance' | 'salary';
  id: string;
  employee: PayoutEmployee | null;
  label: string;
  date: string | null;
  approvedAmount: number;
  kilometres?: number | null;
  approvedAt: string | null;
  payout: { status: string; remark: string; bankSheetAt: string | null };
};
type PayoutGroup = { employee: PayoutEmployee | null; items: PayoutItem[]; total: number };
type PayoutsResponse = { items: PayoutItem[]; groups?: PayoutGroup[]; summary: { count: number; total: number }; settings: { debitAccountNo: string } };

const CREDITED = 'Amount Credited to Bank';
const NOT_CREDITED = 'Not Credited';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MODE_BY_SCREEN: Record<string, Mode> = {
  FinancePayouts: 'list',
  FinanceBankSheet: 'bank-sheet',
  FinanceCreditStatus: 'credit-status',
  FinanceSalarySheet: 'salary-sheet',
};
const TITLES: Record<Mode, { title: string; subtitle: string; status: string }> = {
  list: { title: 'Approved Expenses & Advances', subtitle: 'Approved by the Finance Manager', status: 'all' },
  'bank-sheet': { title: 'Generate Bank Sheet', subtitle: 'One row per employee, bank payment format', status: 'open' },
  'credit-status': { title: 'Bank Credit Status', subtitle: 'Tick credited employees; remark required for the rest', status: 'Pending' },
  'salary-sheet': { title: 'Salary Sheet', subtitle: 'Net salaries of a finalized payroll month, bank payment format', status: 'open' },
};
const KIND_LABELS: Record<PayoutItem['kind'], string> = { expense: 'Expense', advance: 'Advance', salary: 'Salary' };

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const keyOf = (g: PayoutGroup) => g.employee?._id || g.items[0]?.id || '';
const errorText = (e: any) => e?.response?.data?.message || e?.message || 'Something went wrong';
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const narrationFor = (type: string, salaryMonthLabel = '') => {
  const month = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  if (type === 'salary') return `${salaryMonthLabel || month} Sal`;
  return type === 'advance' ? `${month} Advance` : type === 'expense' ? `${month} Expenses` : `${month} Exp & Adv`;
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

async function shareFile(uri: string, filename: string) {
  try {
    const Sharing = require('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: XLSX, dialogTitle: filename });
      return;
    }
  } catch (_) {
    /* fall through to the saved-file message */
  }
  Alert.alert('Saved', `Excel file saved to:\n${uri}`);
}

/** GET or POST an Excel file from the API and save / share it. */
async function downloadExcel(path: string, filename: string, body?: unknown) {
  const url = `${getApiUrl()}${path}`;
  const token = await AsyncStorage.getItem('authToken');
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (body === undefined && Platform.OS !== 'web') {
    if (!documentDirectory) throw new Error('File storage is not available on this device');
    const result = await downloadAsync(url, `${documentDirectory}${filename}`, { headers });
    if (result.status !== 200) throw new Error(`Download failed (${result.status})`);
    await shareFile(result.uri, filename);
    return;
  }
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Download failed');
  const match = /filename="?([^"]+)"?/i.exec(res.headers.get('Content-Disposition') || '');
  const name = match?.[1] || filename;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const objectUrl = window.URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(objectUrl);
    document.body.removeChild(a);
    return;
  }
  if (!documentDirectory) throw new Error('File storage is not available on this device');
  const uri = `${documentDirectory}${name.replace(/[^\w.\- ]/g, '_')}`;
  await writeAsStringAsync(uri, toBase64(await res.arrayBuffer()), { encoding: 'base64' });
  await shareFile(uri, name);
}

function StatusPill({ status }: { status: string }) {
  const tone = status === CREDITED ? styles.pillOk : status === NOT_CREDITED ? styles.pillBad : styles.pillPending;
  return <Text style={[styles.pill, tone]}>{status === CREDITED || status === NOT_CREDITED ? status : 'Pending'}</Text>;
}

export default function FinancePayoutsScreen({ route }: any) {
  const mode: Mode = MODE_BY_SCREEN[route?.name] || 'list';
  const copy = TITLES[mode];
  const isSheet = mode === 'bank-sheet' || mode === 'salary-sheet';
  const [type, setType] = useState(mode === 'salary-sheet' ? 'salary' : 'all');
  const [salaryMonths, setSalaryMonths] = useState<SalaryMonth[]>([]);
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState(copy.status);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [paymentDate, setPaymentDate] = useState(todayYmd());
  const [narration, setNarration] = useState(narrationFor('all'));
  const [debitAccountNo, setDebitAccountNo] = useState('');

  const query = useMemo(() => {
    const p: string[] = [];
    if (type !== 'all') p.push(`type=${type}`);
    if (type === 'salary' && month) p.push(`month=${month}`);
    if (status !== 'all') p.push(`status=${encodeURIComponent(status)}`);
    if (from) p.push(`from=${from}`);
    if (to) p.push(`to=${to}`);
    if (q.trim()) p.push(`q=${encodeURIComponent(q.trim())}`);
    if (mode !== 'list') p.push('group=employee');
    if (mode === 'credit-status') p.push('inSheet=1');
    return p.join('&');
  }, [type, month, status, from, to, q, mode]);

  const load = useCallback(async () => {
    // The salary sheet waits for its month.
    if (mode === 'salary-sheet' && !month) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res: PayoutsResponse = await apiService.get(`/finance/payouts?${query}`);
      setData(res);
      setSelected(new Set());
      setRemarks({});
      setDebitAccountNo((prev) => prev || res?.settings?.debitAccountNo || '');
    } catch (e) {
      showAlert('Could not load', errorText(e));
    } finally {
      setLoading(false);
    }
  }, [query, mode, month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'salary-sheet') return;
    apiService
      .get('/finance/salary-months')
      .then((list: SalaryMonth[]) => {
        setSalaryMonths(list || []);
        setMonth((prev) => prev || list?.[0]?.month || '');
      })
      .catch(() => setSalaryMonths([]));
  }, [mode]);

  useEffect(() => {
    if (isSheet) setNarration(narrationFor(type, salaryMonths.find((m) => m.month === month)?.label));
  }, [type, isSheet, month, salaryMonths]);

  const groups = data?.groups || [];
  const chosen = groups.filter((g) => selected.has(keyOf(g)));
  const chosenTotal = chosen.reduce((s, g) => s + g.total, 0);
  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const downloadReport = async () => {
    setBusy(true);
    try {
      const p = query.split('&').filter((x) => x && x !== 'group=employee').join('&');
      await downloadExcel(`/finance/payouts/export?${p}`, `${type === 'salary' ? 'Salary_Payouts' : 'Approved_Expenses_Advances'}_${todayYmd()}.xlsx`);
    } catch (e) {
      showAlert('Download failed', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!chosen.length) return showAlert('Select employees', 'Select at least one employee to pay.');
    if (!paymentDate) return showAlert('Payment date', 'Pick the payment date.');
    if (!narration.trim()) return showAlert('Narration', 'Enter the narration.');
    if (!/^\d{6,20}$/.test(debitAccountNo.trim())) return showAlert('Debit account', 'Enter the company debit account number (6 to 20 digits).');
    setBusy(true);
    try {
      await downloadExcel('/finance/bank-sheet', `Bank payment File ${paymentDate}.xlsx`, {
        items: chosen.flatMap((g) => g.items.map((i) => ({ kind: i.kind, id: i.id }))),
        paymentDate,
        narration: narration.trim(),
        debitAccountNo: debitAccountNo.trim(),
      });
      showAlert('Bank sheet generated', `${chosen.length} employee(s). Update the credit status once the bank confirms.`);
      await load();
    } catch (e) {
      showAlert('Could not generate', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const saveCredit = async () => {
    const missing = groups.filter((g) => !selected.has(keyOf(g)) && !(remarks[keyOf(g)] || '').trim());
    if (missing.length) {
      return showAlert('Remark required', `Enter a remark for employees whose amount was not credited: ${missing.map((g) => g.employee?.name || 'Unknown').join(', ')}`);
    }
    setBusy(true);
    try {
      const res: any = await apiService.put('/finance/credit-status', {
        credited: chosen.flatMap((g) => g.items.map((i) => ({ kind: i.kind, id: i.id }))),
        notCredited: groups
          .filter((g) => !selected.has(keyOf(g)))
          .flatMap((g) => g.items.map((i) => ({ kind: i.kind, id: i.id, remark: remarks[keyOf(g)].trim() }))),
      });
      showAlert('Updated', res?.message || 'Credit status updated');
      await load();
    } catch (e) {
      showAlert('Could not update', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const statusItems = [
    ...(mode === 'list' ? [{ label: 'All', value: 'all' }] : []),
    { label: 'To pay (not yet sent + Not Credited)', value: 'open' },
    { label: 'Pending', value: 'Pending' },
    { label: NOT_CREDITED, value: NOT_CREDITED },
    ...(mode === 'list' ? [{ label: CREDITED, value: CREDITED }] : []),
  ];

  return (
    <ScreenShell title={copy.title} subtitle={copy.subtitle} refreshing={loading} onRefresh={load}>
      <View style={styles.card}>
        {mode === 'salary-sheet' ? (
          <WebSelect
            label="Payroll month"
            value={month}
            onValueChange={setMonth}
            items={salaryMonths.map((m) => ({ label: `${m.label} · ${m.employees} employees`, value: m.month }))}
          />
        ) : (
          <WebSelect label="Type" value={type} onValueChange={setType} items={[
            { label: 'Expenses & Advances', value: 'all' },
            { label: 'Expenses', value: 'expense' },
            { label: 'Advances', value: 'advance' },
            ...(mode !== 'bank-sheet' ? [{ label: 'Salary', value: 'salary' }] : []),
          ]} />
        )}
        {mode !== 'credit-status' ? <WebSelect label="Bank status" value={status} onValueChange={setStatus} items={statusItems} /> : null}
        {mode !== 'salary-sheet' ? <DateField placeholder="Approved from" value={from} onChange={setFrom} /> : null}
        {mode !== 'salary-sheet' ? <DateField placeholder="Approved to" value={to} onChange={setTo} /> : null}
        <WebLabel>Employee</WebLabel>
        <WebInput value={q} onChangeText={setQ} placeholder="Name or Emp ID" />
        <View style={styles.row}>
          <View style={styles.flex}><WebButton title="Refresh" variant="outline" onPress={load} disabled={loading} /></View>
          <View style={styles.flex}><WebButton title="Download Report" variant="outline" onPress={downloadReport} disabled={busy || !data?.items.length} /></View>
        </View>
        {data ? <Text style={styles.muted}>{data.summary.count} item(s) · {money(data.summary.total)}</Text> : null}
      </View>

      {isSheet ? (
        <View style={styles.card}>
          <DateField placeholder="Payment date *" value={paymentDate} onChange={setPaymentDate} />
          <WebLabel>Narration (Consultancy column) *</WebLabel>
          <WebInput value={narration} onChangeText={setNarration} maxLength={60} />
          <WebLabel>Company debit account no. *</WebLabel>
          <WebInput value={debitAccountNo} onChangeText={(t) => setDebitAccountNo(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={20} />
          <WebButton
            title={`Generate Bank Sheet${chosen.length ? ` (${chosen.length} · ${money(chosenTotal)})` : ''}`}
            onPress={generate}
            loading={busy}
            disabled={!chosen.length}
          />
        </View>
      ) : null}

      {!loading && !data?.items.length ? (
        <Text style={styles.empty}>
          {mode === 'credit-status'
            ? 'No employees are waiting for a credit update. Generate a bank sheet first.'
            : mode === 'salary-sheet'
              ? salaryMonths.length
                ? 'No salaries to pay for this month with these filters.'
                : 'No finalized payroll yet. HR finalizes the month in Payroll first.'
              : 'No Finance-approved expenses or advances match these filters.'}
        </Text>
      ) : null}

      {mode === 'list'
        ? (data?.items || []).map((i) => (
            <View key={`${i.kind}:${i.id}`} style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.name}>{i.employee?.name || '-'}</Text>
                <Text style={styles.amount}>{money(i.approvedAmount)}</Text>
              </View>
              <Text style={styles.muted}>{[i.employee?.empCode, i.employee?.role, i.employee?.zone].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.line}>{KIND_LABELS[i.kind]} · {i.label}{i.kind === 'salary' ? '' : ` · ${formatDate(i.date) || '-'}`}</Text>
              {i.kilometres ? <Text style={styles.muted}>Kilometer: {i.kilometres}</Text> : null}
              <Text style={styles.muted}>Finance Approved Date: {formatDate(i.approvedAt) || '-'}</Text>
              <StatusPill status={i.payout.status} />
              {i.payout.remark ? <Text style={styles.remark}>{i.payout.remark}</Text> : null}
            </View>
          ))
        : groups.map((g) => {
            const key = keyOf(g);
            const noBank = !g.employee?.hasBankDetails;
            const disabled = isSheet && noBank;
            const on = selected.has(key);
            return (
              <View key={key} style={[styles.card, on && styles.cardOn, disabled && styles.cardOff]}>
                <TouchableOpacity disabled={disabled} onPress={() => toggle(key)} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }}>
                  <View style={styles.rowBetween}>
                    <View style={styles.nameRow}>
                      <View style={[styles.checkbox, on && styles.checkboxOn, disabled && styles.checkboxOff]}>
                        {on ? <Text style={styles.checkMark}>✓</Text> : null}
                      </View>
                      <Text style={styles.name}>{g.employee?.name || '-'}</Text>
                    </View>
                    <Text style={styles.amount}>{money(g.total)}</Text>
                  </View>
                  <Text style={styles.muted}>{[g.employee?.empCode, g.employee?.role, g.employee?.zone].filter(Boolean).join(' · ')}</Text>
                  {noBank ? (
                    <Text style={styles.remark}>No bank details. Add them in the employee profile.</Text>
                  ) : (
                    <Text style={styles.muted}>{g.employee?.bankName || g.employee?.ifsc} · A/c ••••{g.employee?.accountLast4} · {g.employee?.ifsc}</Text>
                  )}
                  {g.items.map((i) => (
                    <Text key={`${i.kind}:${i.id}`} style={styles.line}>• {i.label}{i.kind === 'salary' ? '' : ` · ${formatDate(i.date) || '-'}`} · {money(i.approvedAmount)}</Text>
                  ))}
                  {isSheet ? (
                    <View style={styles.pills}>{[...new Set(g.items.map((i) => i.payout.status))].map((s) => <StatusPill key={s} status={s} />)}</View>
                  ) : (
                    <Text style={styles.muted}>Sent to bank {formatDate(g.items.map((i) => i.payout.bankSheetAt).filter(Boolean).sort().pop() || null) || '-'}</Text>
                  )}
                </TouchableOpacity>
                {mode === 'credit-status' ? (
                  on ? (
                    <Text style={styles.ok}>Will be marked Amount Credited to Bank</Text>
                  ) : (
                    <WebInput
                      value={remarks[key] || ''}
                      onChangeText={(t) => setRemarks((prev) => ({ ...prev, [key]: t }))}
                      placeholder="Remark: reason for failure or delay (required)"
                      multiline
                    />
                  )
                ) : null}
              </View>
            );
          })}

      {mode === 'credit-status' && groups.length ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{chosen.length} credited · {groups.length - chosen.length} not credited</Text>
          <WebButton title="Update Credit Status" onPress={saveCredit} loading={busy} />
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.backgroundLight, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md, gap: 6 },
  cardOn: { borderColor: colors.primary, borderWidth: 2 },
  cardOff: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 5, borderWidth: 2, borderColor: '#4B5563', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#059669', borderColor: '#059669' },
  checkboxOff: { borderColor: '#D1D5DB', backgroundColor: '#F3F4F6' },
  checkMark: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', lineHeight: 18 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  line: { fontSize: 13, color: colors.textPrimary },
  muted: { fontSize: 12, color: colors.textSecondary },
  remark: { fontSize: 12, color: '#B91C1C' },
  ok: { fontSize: 12, color: '#047857', fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textSecondary, marginVertical: spacing.lg },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  pillOk: { backgroundColor: '#D1FAE5', color: '#065F46' },
  pillBad: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  pillPending: { backgroundColor: '#E5E7EB', color: '#374151' },
});
