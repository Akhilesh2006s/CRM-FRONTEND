import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, EmptyState, toneFor } from '../../ui/Kit';
import StatCard from '../../components/dashboard/StatCard';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

type Level = 'regional-manager' | 'regional-head' | 'national-head';

const ENDPOINT: Record<Level, string> = {
  'regional-manager': 'regional-managers',
  'regional-head': 'regional-heads',
  'national-head': 'national-heads',
};

const TITLE: Record<Level, string> = {
  'regional-manager': 'Regional Manager',
  'regional-head': 'Regional Head',
  'national-head': 'National Head',
};

type Props = {
  navigation?: { navigate: (screen: string, params?: object) => void };
  route?: { params?: { level?: Level; personId?: string } };
  level?: Level;
  personId?: string;
  embedded?: boolean;
};

export default function HierarchyDashboardScreen({ navigation, route, level, personId, embedded }: Props) {
  const { user } = useAuth();
  const resolvedLevel: Level =
    level ||
    route?.params?.level ||
    (user?.role === 'Regional Head'
      ? 'regional-head'
      : user?.role === 'National Head'
        ? 'national-head'
        : 'regional-manager');
  const resolvedId = personId || route?.params?.personId || user?._id || '';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!resolvedId) {
      setLoading(false);
      return;
    }
    try {
      const payload = await apiService.get(`/hierarchy/${ENDPOINT[resolvedLevel]}/${resolvedId}/dashboard`);
      setData(payload);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolvedId, resolvedLevel]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const totals = data?.totals || {};
  const reports = Array.isArray(data?.directReports) ? data.directReports : [];
  const activities = Array.isArray(data?.activities) ? data.activities : [];

  const openReport = (kind: string, id: string) => {
    if (!navigation || !id) return;
    if (kind === 'zonal-manager') {
      navigation.navigate('ExecutiveManagerDashboard', { managerId: id });
      return;
    }
    const nextLevel =
      kind === 'regional-head' ? 'regional-head' : kind === 'national-head' ? 'national-head' : 'regional-manager';
    navigation.navigate('HierarchyDashboard', { level: nextLevel, personId: id });
  };

  const body = (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Card>
        <CardTitle
          title={data?.person?.name || user?.name || ''}
          subtitle={[data?.person?.email, data?.person?.phone, data?.person?.state].filter(Boolean).join(' · ') || undefined}
        />
      </Card>
      <View style={styles.stats}>
        {resolvedLevel === 'national-head' ? (
          <StatCard label="Regional Heads" value={totals.regionalHeads || 0} ion="people-outline" color="#7C3AED" bg="#EDE9FE" />
        ) : null}
        {resolvedLevel !== 'regional-manager' ? (
          <StatCard label="Regional Managers" value={totals.regionalManagers || 0} ion="people-outline" color="#2563EB" bg="#DBEAFE" />
        ) : null}
        <StatCard label="Zonal Managers" value={totals.zonalManagers || 0} ion="shield-outline" color="#0D9488" bg="#CCFBF1" />
        <StatCard label="Employees" value={totals.employees || 0} ion="person-outline" color="#059669" bg="#D1FAE5" />
        <StatCard label="Leads" value={totals.leads || 0} ion="flash-outline" color="#0284C7" bg="#E0F2FE" />
        <StatCard label="DCs" value={totals.dcs || 0} ion="document-text-outline" color="#D97706" bg="#FEF3C7" />
        <StatCard label="Sales" value={totals.sales || 0} ion="cash-outline" color="#E11D48" bg="#FFE4E6" />
        <StatCard label="Leaves" value={totals.leaves || 0} ion="calendar-outline" color="#4F46E5" bg="#E0E7FF" />
      </View>

      <Text style={styles.section}>Assigned people</Text>
      {reports.length === 0 ? (
        <EmptyState icon="👥" title="Nothing assigned yet" message="Super Admin manages these assignments." />
      ) : (
        reports.map((report: any) => (
          <Card key={report._id} onPress={() => openReport(report.kind, report._id)}>
            <CardTitle title={report.name} subtitle={report.email || undefined} />
            <Text style={styles.cardMeta}>
              {report.metrics?.employees || 0} employees · {report.metrics?.leads || 0} leads · {report.metrics?.dcs || 0} DCs ·{' '}
              {report.metrics?.sales || 0} sales
            </Text>
          </Card>
        ))
      )}

      <Text style={styles.section}>Recent activity</Text>
      {activities.length === 0 ? (
        <EmptyState icon="🕒" title="No recent activity" message="No recent leads, delivery challans, or leaves." />
      ) : (
        activities.map((item: any) => (
          <Card key={item.id}>
            <CardTitle title={`${item.type}: ${item.title}`} badge={item.status || undefined} tone={toneFor(item.status)} />
            <Text style={styles.cardMeta}>{[item.actorName, item.contextName].filter(Boolean).join(' · ')}</Text>
          </Card>
        ))
      )}
    </View>
  );

  if (embedded) {
    return (
      <View style={styles.embedded}>
        <Text style={styles.embeddedTitle}>{TITLE[resolvedLevel]} Dashboard</Text>
        {loading ? <Text style={styles.empty}>Loading dashboard…</Text> : body}
      </View>
    );
  }

  return (
    <ScreenShell
      title={`${TITLE[resolvedLevel]} Dashboard`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {body}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  embedded: { flex: 1, backgroundColor: colors.background || '#F8FAFC' },
  embeddedTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12, color: '#1E293B' },
  person: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  meta: { color: '#64748B', fontSize: 13, marginBottom: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  section: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardMeta: { color: '#64748B', fontSize: 13, lineHeight: 18 },
  empty: { color: '#64748B', marginBottom: 8 },
  error: { color: '#B91C1C', fontSize: 13, marginBottom: 8 },
});
