import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory, downloadAsync } from 'expo-file-system/legacy';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { apiService, getApiUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showAlert, showConfirm } from '../../utils/showAlert';

type PayrollRow = {
  employeeId: string;
  empCode?: string;
  name: string;
  designation?: string;
  department?: string;
  zone?: string;
  uanNumber?: string;
  esiNumber?: string;
  monthlyCtc: number;
  daysInMonth: number;
  paidDays: number;
  presentDays?: number;
  approvedLeaveDays?: number;
  autoPaidDays?: number;
  lopDays?: number;
  attendanceTracked?: boolean;
  paidDaysEdited?: boolean;
  gross: number;
  basic: number;
  hra: number;
  conveyance: number;
  earnedGross: number;
  pt: number;
  ptOverride?: number | null;
  tds: number;
  employeeEsi: number;
  employeePf: number;
  advances: number;
  totalDeductions: number;
  netPay: number;
  employerPf: number;
  employerEsi: number;
  ctcComputed: number;
  remarks?: string;
};

type PayrollData = {
  month: string;
  status: 'draft' | 'finalized';
  finalizedAt?: string;
  rows: PayrollRow[];
  missingCtc: { _id: string; name: string; empCode?: string; role?: string }[];
  totals: Record<string, number>;
};

type Inputs = { paidDays: string; tds: string; advances: string; ptOverride: string; remarks: string };

const inr = (n: number | undefined) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const previousMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return monthKeyOf(d);
};
const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
};
const validMonth = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const monthLabel = (m: string) => {
  if (!validMonth(m)) return m;
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

function KV({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, strong && styles.kvStrong]}>{value}</Text>
    </View>
  );
}

/**
 * Web: app/dashboard/employees/payroll/page.tsx — monthly salary sheet worked out from CTC.
 * GET/PUT /hr/payroll/:month, POST /hr/payroll/:month/finalize, POST /hr/payroll/:month/reopen,
 * GET /hr/payroll/:month/export (.xlsx).
 */
export default function PayrollScreen() {
  const { user } = useAuth();
  const superAdmin = user?.role === 'Super Admin' || Boolean((user as any)?.isSuperAdmin);
  const [month, setMonth] = useState(previousMonth());
  const [monthDraft, setMonthDraft] = useState(previousMonth());
  const [data, setData] = useState<PayrollData | null>(null);
  const [inputs, setInputs] = useState<Record<string, Inputs>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const applyData = (next: PayrollData) => {
    setData(next);
    const map: Record<string, Inputs> = {};
    (next?.rows || []).forEach((r) => {
      map[r.employeeId] = {
        paidDays: String(r.paidDays ?? r.daysInMonth),
        tds: String(r.tds || 0),
        advances: String(r.advances || 0),
        ptOverride: r.ptOverride === null || r.ptOverride === undefined ? '' : String(r.ptOverride),
        remarks: r.remarks || '',
      };
    });
    setInputs(map);
  };

  const load = useCallback(async () => {
    try {
      applyData((await apiService.get(`/hr/payroll/${month}`)) as PayrollData);
      setError('');
    } catch (e: any) {
      setError(errMsg(e, 'Failed to load payroll'));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const changeMonth = (next: string) => {
    setMonthDraft(next);
    if (validMonth(next) && next !== month) setMonth(next);
  };

  const editable = data?.status === 'draft';

  const rowsPayload = () =>
    (data?.rows || []).map((r) => {
      const i = inputs[r.employeeId];
      // Paid days are sent only when HR changed them; otherwise they stay automatic.
      const entered = i?.paidDays === '' || i?.paidDays === undefined ? null : Number(i.paidDays);
      const auto = r.autoPaidDays ?? r.daysInMonth;
      return {
        employeeId: r.employeeId,
        paidDays: entered === null || (entered === auto && !r.paidDaysEdited) ? null : entered,
        tds: Number(i?.tds) || 0,
        advances: Number(i?.advances) || 0,
        ptOverride: i?.ptOverride === '' || i?.ptOverride === undefined ? null : Number(i.ptOverride),
        remarks: i?.remarks || '',
      };
    });

  const call = async (label: string, path: string, body: unknown, method: 'PUT' | 'POST', ok: string) => {
    setBusy(label);
    setError('');
    setSuccess('');
    try {
      const res = method === 'PUT' ? await apiService.put(path, body) : await apiService.post(path, body);
      applyData(res as PayrollData);
      setSuccess(ok);
    } catch (e: any) {
      setError(errMsg(e, 'Request failed'));
    } finally {
      setBusy('');
    }
  };

  const save = () => call('save', `/hr/payroll/${month}`, { rows: rowsPayload() }, 'PUT', 'Payroll recalculated and saved');
  const finalize = () =>
    showConfirm(
      'Finalize payroll',
      `Finalize payroll for ${month}? Pay slips will be issued to every employee in this list.`,
      () => call('finalize', `/hr/payroll/${month}/finalize`, { rows: rowsPayload() }, 'POST', 'Payroll finalized and pay slips issued'),
      'Finalize',
    );
  const reopen = () => call('reopen', `/hr/payroll/${month}/reopen`, {}, 'POST', 'Payroll reopened for changes');

  const exportExcel = async () => {
    setBusy('export');
    try {
      const url = `${getApiUrl()}/hr/payroll/${month}/export`;
      const filename = `Salaries-${month}.xlsx`;
      const token = await AsyncStorage.getItem('authToken');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Export failed');
        const blob = await res.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(objectUrl);
        document.body.removeChild(a);
        return;
      }
      if (!documentDirectory) throw new Error('File storage is not available on this device');
      const result = await downloadAsync(url, `${documentDirectory}${filename}`, { headers });
      if (result.status !== 200) throw new Error(`Export failed (${result.status})`);
      try {
        const Sharing = require('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: filename,
          });
          return;
        }
      } catch (_) {
        /* fall through to the saved-file message */
      }
      Alert.alert('Export complete', `Excel file saved to:\n${result.uri}`);
    } catch (e: any) {
      showAlert('Export failed', e?.message || 'Export failed');
    } finally {
      setBusy('');
    }
  };

  const setInput = (id: string, patch: Partial<Inputs>) =>
    setInputs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.rows || []).filter(
      (r) => !q || [r.name, r.empCode, r.designation, r.department, r.zone].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [data, search]);

  const t = data?.totals || {};

  const numInput = (id: string, key: keyof Inputs, placeholder?: string) => (
    <WebInput
      keyboardType={key === 'paidDays' ? 'decimal-pad' : 'number-pad'}
      value={inputs[id]?.[key] ?? ''}
      placeholder={placeholder}
      editable={editable}
      onChangeText={(v) => setInput(id, { [key]: v.replace(key === 'paidDays' ? /[^0-9.]/g : /[^0-9]/g, '') } as Partial<Inputs>)}
      style={[styles.numInput, !editable && styles.inputDisabled]}
    />
  );

  return (
    <ScreenShell
      title="Payroll"
      subtitle="Salary worked out from each employee's CTC"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.help}>
        Basic 60% of gross, Conveyance ₹900, HRA the rest; PF 12% of basic, ESI (gross up to ₹21,000), PT slab; pro-rated by paid days.
      </Text>

      <View style={styles.monthRow}>
        <TouchableOpacity style={styles.monthBtn} onPress={() => changeMonth(shiftMonth(month, -1))} disabled={!!busy}>
          <Text style={styles.monthBtnText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <WebInput
            value={monthDraft}
            onChangeText={changeMonth}
            placeholder="YYYY-MM"
            autoCapitalize="none"
            maxLength={7}
            style={styles.monthInput}
          />
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
        </View>
        <TouchableOpacity style={styles.monthBtn} onPress={() => changeMonth(shiftMonth(month, 1))} disabled={!!busy}>
          <Text style={styles.monthBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <WebButton title="Export Excel" variant="outline" onPress={exportExcel} disabled={!!busy || loading} loading={busy === 'export'} />
        </View>
        {editable ? (
          <>
            <View style={styles.actionItem}>
              <WebButton title={busy === 'save' ? 'Saving…' : 'Save & recalculate'} variant="outline" onPress={save} disabled={!!busy} />
            </View>
            <View style={styles.actionFull}>
              <TouchableOpacity
                style={[styles.finalizeBtn, (!!busy || !data?.rows.length) && styles.disabled]}
                onPress={finalize}
                disabled={!!busy || !data?.rows.length}
              >
                <Text style={styles.finalizeText}>{busy === 'finalize' ? 'Finalizing…' : 'Finalize & issue pay slips'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
        {data?.status === 'finalized' && superAdmin ? (
          <View style={styles.actionItem}>
            <WebButton title={busy === 'reopen' ? 'Reopening…' : 'Reopen'} variant="outline" onPress={reopen} disabled={!!busy} />
          </View>
        ) : null}
      </View>

      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {success ? <MessageBanner type="success" message={success} onDismiss={() => setSuccess('')} /> : null}

      {data ? (
        <View style={styles.statsGrid}>
          {[
            ['Employees', String(data.rows.length)],
            ['Gross earned', inr(t.earnedGross)],
            ['Deductions', inr(t.totalDeductions)],
            ['Net pay', inr(t.netPay)],
            ['Total CTC (with employer PF/ESI)', inr(t.ctcComputed)],
          ].map(([label, value]) => (
            <View key={label} style={styles.statCard}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {data?.status === 'finalized' ? (
        <View style={[styles.notice, styles.noticeGreen]}>
          <Text style={styles.noticeGreenText}>
            Finalized{data.finalizedAt ? ` on ${new Date(data.finalizedAt).toLocaleDateString('en-IN')}` : ''}. Pay slips were issued;
            employees see them under Pay Slips.
          </Text>
        </View>
      ) : null}
      {data && data.missingCtc?.length > 0 ? (
        <View style={[styles.notice, styles.noticeAmber]}>
          <Text style={styles.noticeAmberText}>
            {data.missingCtc.length} active employee{data.missingCtc.length === 1 ? '' : 's'} have no CTC and are left out:{' '}
            {data.missingCtc.slice(0, 8).map((e) => e.name).join(', ')}
            {data.missingCtc.length > 8 ? '…' : ''}. Set CTC on the employee (Edit Employee) or in Salary.
          </Text>
        </View>
      ) : null}

      <WebInput placeholder="Search name, code, department, zone" value={search} onChangeText={setSearch} />
      <Text style={styles.help}>
        Paid days are automatic: days in month minus loss-of-pay days (Mon–Sat with no check-in and no approved leave; Sundays paid; no
        check-ins all month = full month). Edit paid days, TDS, advances or PT, then Save & recalculate. Clear a paid-days box to go back
        to automatic.
      </Text>

      {!loading && !shown.length ? <Text style={styles.empty}>No employees with a CTC for this month.</Text> : null}

      {shown.map((r) => (
        <View key={r.employeeId} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.name}</Text>
              <Text style={styles.sub}>
                {r.empCode || '-'}
                {r.designation ? ` · ${r.designation}` : ''}
              </Text>
              <Text style={styles.subMuted}>
                {r.department || '-'}
                {r.zone ? ` · ${r.zone}` : ''}
              </Text>
              <Text style={styles.subMuted}>
                {r.uanNumber ? `UAN ${r.uanNumber}` : 'No PF'} · {r.esiNumber ? `ESI ${r.esiNumber}` : 'No ESI'}
              </Text>
            </View>
            <View style={styles.netBox}>
              <Text style={styles.netLabel}>Net pay</Text>
              <Text style={styles.netValue}>{inr(r.netPay)}</Text>
            </View>
          </View>

          <KV label="Monthly CTC" value={inr(r.monthlyCtc)} />
          <KV label="Gross" value={inr(r.gross)} />
          <Text style={styles.breakdown}>
            B {inr(r.basic)} · H {inr(r.hra)} · C {inr(r.conveyance)}
          </Text>
          {editable ? (
            <KV
              label="Present / Leave"
              value={`${r.presentDays ?? 0} / ${r.approvedLeaveDays ?? 0}  (${r.attendanceTracked ? `LOP ${r.lopDays ?? 0}` : 'no check-ins'})`}
            />
          ) : null}

          <View style={styles.inputsGrid}>
            <View style={styles.inputCell}>
              <Text style={styles.inputLabel}>Paid days (of {r.daysInMonth})</Text>
              {numInput(r.employeeId, 'paidDays')}
              {editable ? (
                r.paidDaysEdited ? (
                  <Text style={styles.edited}>edited (auto {r.autoPaidDays})</Text>
                ) : (
                  <Text style={styles.auto}>auto</Text>
                )
              ) : null}
            </View>
            <View style={styles.inputCell}>
              <Text style={styles.inputLabel}>PT</Text>
              {numInput(r.employeeId, 'ptOverride', String(r.pt))}
            </View>
            <View style={styles.inputCell}>
              <Text style={styles.inputLabel}>TDS</Text>
              {numInput(r.employeeId, 'tds')}
            </View>
            <View style={styles.inputCell}>
              <Text style={styles.inputLabel}>Advances</Text>
              {numInput(r.employeeId, 'advances')}
            </View>
          </View>

          <KV label="Earned gross" value={inr(r.earnedGross)} />
          <KV label="ESI" value={inr(r.employeeEsi)} />
          <KV label="PF" value={inr(r.employeePf)} />
          <KV label="Deductions" value={inr(r.totalDeductions)} />
          <KV label="Net pay" value={inr(r.netPay)} strong />
          <KV label="Employer PF / ESI" value={`${inr(r.employerPf)} / ${inr(r.employerEsi)}`} />
        </View>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: 17 },
  monthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  monthBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnText: { fontSize: 22, color: colors.textPrimary, fontWeight: '600' },
  monthInput: { marginBottom: 2, textAlign: 'center' },
  monthLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  actionItem: { flexGrow: 1, flexBasis: '45%' },
  actionFull: { flexBasis: '100%' },
  finalizeBtn: {
    backgroundColor: colors.success,
    borderRadius: radii.md,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  finalizeText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.5 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
  },
  statLabel: { fontSize: 11, color: colors.textMuted },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  notice: { borderWidth: 1, borderRadius: radii.md, padding: 10, marginBottom: spacing.sm },
  noticeGreen: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  noticeGreenText: { fontSize: 13, color: '#166534' },
  noticeAmber: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  noticeAmberText: { fontSize: 13, color: '#92400E' },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 32 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 10,
  },
  cardHead: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  subMuted: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  netBox: { alignItems: 'flex-end' },
  netLabel: { fontSize: 11, color: colors.textMuted },
  netValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, gap: 12 },
  kvLabel: { fontSize: 13, color: colors.textMuted },
  kvValue: { fontSize: 13, color: colors.textPrimary, textAlign: 'right', flexShrink: 1 },
  kvStrong: { fontWeight: '700' },
  breakdown: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginBottom: 2 },
  inputsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  inputCell: { flexGrow: 1, flexBasis: '45%' },
  inputLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  numInput: { marginBottom: 2, paddingVertical: 8, textAlign: 'right' },
  inputDisabled: { backgroundColor: colors.backgroundMuted, color: colors.textSecondary },
  edited: { fontSize: 11, color: '#B45309' },
  auto: { fontSize: 11, color: colors.textMuted },
});
