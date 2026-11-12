import React, { useCallback, useMemo, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, ChipRow } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import { colors } from '../../theme/colors';
import { dmy, personName, pjpStatusLabel, pjpTone, type Pjp } from '../../lib/pjp';

const TEAM_FILTERS = [
  { key: 'Waiting', label: 'Waiting for approval' },
  { key: 'All', label: 'All' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
];

/** My PJP (scope mine) or Team PJP (scope team): plans with planned vs actual counts. */
export default function PjpListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const team = route.params?.scope === 'team';
  const [rows, setRows] = useState<Pjp[]>([]);
  const [status, setStatus] = useState('Waiting');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = team ? `scope=team${status !== 'All' ? `&status=${encodeURIComponent(status)}` : ''}` : 'scope=mine';
      const data = await apiService.get(`/pjp?${qs}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not load the plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [team, status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((p) => `${personName(p.employeeId)} ${p.employeeId?.empCode || ''}`.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <ScreenShell
      title={team ? 'Team PJP' : 'My PJP'}
      subtitle={
        team
          ? "Approve your team's plans and track completed, pending and missed visits."
          : 'Plan your school visits for the week or month. Your reporting manager approves the plan.'
      }
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {team ? (
        <>
          <ChipRow items={TEAM_FILTERS} value={status} onChange={(k) => { setLoading(true); setStatus(k); }} />
          <WebInput placeholder="Search employee" value={q} onChangeText={setQ} />
        </>
      ) : (
        <View style={{ marginBottom: 12 }}>
          <WebButton title="New plan" onPress={() => navigation.navigate('PjpEdit', {})} />
        </View>
      )}
      {shown.length === 0 ? <EmptyState icon="🗓️" title="No plans yet" /> : null}
      {shown.map((p) => (
        <Card key={p._id} onPress={() => navigation.navigate('PjpDetail', { id: p._id })} style={p.canDecide ? styles.actionable : undefined}>
          <CardTitle
            title={team ? personName(p.employeeId) || '—' : `${p.period} plan`}
            subtitle={team ? `${p.employeeId?.role || ''} · ${p.period}` : undefined}
            badge={pjpStatusLabel(p)}
            tone={pjpTone(p)}
          />
          <InfoRow label="Period" value={`${dmy(p.fromDate)} – ${dmy(p.toDate)}`} />
          <InfoRow label="Planned" value={String(p.summary?.planned ?? p.items.length)} />
          <Text style={styles.counts}>
            <Text style={{ color: colors.success }}>Completed {p.summary?.completed ?? 0}</Text>
            {'  ·  '}
            <Text style={{ color: '#A16207' }}>Pending {p.summary?.pending ?? 0}</Text>
            {'  ·  '}
            <Text style={{ color: colors.error }}>Missed {p.summary?.missed ?? 0}</Text>
          </Text>
          {p.canDecide ? <Text style={styles.action}>Your action</Text> : null}
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actionable: { borderColor: colors.primaryLight },
  counts: { fontSize: 13, marginTop: 4 },
  action: { fontSize: 12, fontWeight: '700', color: '#A16207', marginTop: 4 },
});
