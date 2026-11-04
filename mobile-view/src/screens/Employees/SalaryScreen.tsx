import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import MessageBanner from '../../components/MessageBanner';
import { apiService } from '../../services/api';

type Employee = {
  _id: string;
  empCode?: string;
  name?: string;
  email?: string;
  role?: string;
  yearlySalary?: number;
  monthlyTakeHome?: number;
};

type Draft = { yearly: string; monthly: string };

/** Display legacy numeric and current employee codes with the VESPL prefix (web lib/employeeCode.ts). */
function formatEmployeeCode(value?: string | null, fallback = '—') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const withoutPrefix = raw.replace(/^VESPL/i, '');
  const suffix = /^\d+$/.test(withoutPrefix) ? withoutPrefix.padStart(4, '0') : withoutPrefix;
  return `VESPL${suffix}`;
}

const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

/**
 * Web: app/dashboard/employees/salary/page.tsx — GET /employees?isActive=true,
 * PUT /hr/employees/:id/salary { yearlySalary, monthlyTakeHome }.
 */
export default function SalaryScreen() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/employees?isActive=true');
      const list: Employee[] = Array.isArray(data) ? data : [];
      setRows(list);
      const next: Record<string, Draft> = {};
      list.forEach((row) => {
        next[row._id] = { yearly: String(row.yearlySalary || ''), monthly: String(row.monthlyTakeHome || '') };
      });
      setDrafts(next);
      setError('');
    } catch (e: any) {
      setError(errMsg(e, 'Failed to load employees'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { yearly: prev[id]?.yearly || '', monthly: prev[id]?.monthly || '', ...patch } }));

  const save = async (id: string) => {
    const draft = drafts[id];
    setSaving(id);
    setError('');
    setSuccess('');
    try {
      await apiService.put(`/hr/employees/${id}/salary`, {
        yearlySalary: Number(draft?.yearly || 0),
        monthlyTakeHome: Number(draft?.monthly || 0),
      });
      setSuccess('Salary saved. This month’s pay slip was updated.');
    } catch (e: any) {
      setError(errMsg(e, 'Failed to save salary'));
    } finally {
      setSaving('');
    }
  };

  const shown = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((r) => {
      const text = [r.name, r.email, r.role, r.empCode, formatEmployeeCode(r.empCode, '')]
        .map((v) => String(v || '').toLowerCase())
        .join(' ');
      return words.every((w) => text.includes(w));
    });
  }, [rows, search]);

  return (
    <ScreenShell
      title="Salary"
      subtitle="Set yearly salary and monthly take-home"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.help}>
        Set the yearly salary and monthly take-home for each employee. Saving updates the current month pay slip.
      </Text>
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError('')} /> : null}
      {success ? <MessageBanner type="success" message={success} onDismiss={() => setSuccess('')} /> : null}

      <WebInput placeholder="Search name, email, code, role…" value={search} onChangeText={setSearch} autoCapitalize="none" />

      {!loading && shown.length === 0 ? <EmptyState title="No active employees." /> : null}

      {shown.map((row) => (
        <Card key={row._id}>
          <CardTitle title={row.name || '—'} subtitle={formatEmployeeCode(row.empCode)} badge={row.role || '—'} tone="info" />
          <InfoRow label="Email" value={row.email} />
          <View style={styles.inputs}>
            <View style={styles.inputCell}>
              <WebLabel>Yearly salary</WebLabel>
              <WebInput
                keyboardType="number-pad"
                value={drafts[row._id]?.yearly || ''}
                onChangeText={(v) => setDraft(row._id, { yearly: v.replace(/[^0-9.]/g, '') })}
                style={styles.input}
              />
            </View>
            <View style={styles.inputCell}>
              <WebLabel>Monthly take-home</WebLabel>
              <WebInput
                keyboardType="number-pad"
                value={drafts[row._id]?.monthly || ''}
                onChangeText={(v) => setDraft(row._id, { monthly: v.replace(/[^0-9.]/g, '') })}
                style={styles.input}
              />
            </View>
          </View>
          <WebButton
            title={saving === row._id ? 'Saving…' : 'Save'}
            onPress={() => void save(row._id)}
            disabled={saving === row._id}
          />
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  help: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  inputCell: { flexGrow: 1, flexBasis: '45%' },
  input: { marginBottom: 8 },
});
