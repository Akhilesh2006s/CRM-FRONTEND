import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radii } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { leaveTypeLabel } from '../../lib/leaveTypes';
import type { LeaveApprovalFields } from '../../lib/leaveApproval';
import LeaveApprovalStatus from '../../components/leaves/LeaveApprovalStatus';
import LeaveDecisionActions from '../../components/leaves/LeaveDecisionActions';

type LeaveEmployee = { _id: string; name: string; email?: string; assignedCity?: string };

type Leave = LeaveApprovalFields & {
  _id: string;
  employeeId: LeaveEmployee | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  approvedBy?: { name: string; email?: string };
  approvedAt?: string;
  createdAt: string;
};

type Tab = 'team' | 'mine';

const formatDate = (d?: string) => {
  if (!d) return '-';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN');
};

const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

/** Web: app/dashboard/executive-managers/[managerId]/leaves/page.tsx */
export default function ExecutiveManagerLeavesScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const managerId: string | undefined = route?.params?.managerId || user?._id;
  const isOwnPage = !!user?._id && user._id === managerId;

  const [tab, setTab] = useState<Tab>('team');
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [myLeaves, setMyLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [knownEmployees, setKnownEmployees] = useState<LeaveEmployee[]>([]);

  const loadLeaves = useCallback(async () => {
    if (!managerId) {
      setLoading(false);
      setLoadError('Zonal Manager not found.');
      return;
    }
    setLoadError(null);
    try {
      const params: string[] = [];
      if (statusFilter !== 'all') params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (employeeFilter !== 'all') params.push(`employeeId=${encodeURIComponent(employeeFilter)}`);
      if (isIsoDate(fromDate)) params.push(`fromDate=${fromDate.trim()}`);
      if (isIsoDate(toDate)) params.push(`toDate=${toDate.trim()}`);
      const data = await apiService.get(`/executive-managers/${managerId}/leaves${params.length ? `?${params.join('&')}` : ''}`);
      const rows: Leave[] = Array.isArray(data) ? data : [];
      setLeaves(rows);
      // Keep every employee seen so far so the filter does not collapse to the selected one.
      setKnownEmployees((prev) => {
        const map = new Map(prev.map((e) => [e._id, e]));
        rows.forEach((l) => l.employeeId && map.set(l.employeeId._id, l.employeeId));
        return [...map.values()];
      });
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load leaves');
      setLeaves([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [managerId, statusFilter, employeeFilter, fromDate, toDate]);

  const loadMyLeaves = useCallback(async () => {
    if (!user?._id) return;
    setLoadError(null);
    try {
      const data = await apiService.get(`/leaves?employeeId=${user._id}`);
      setMyLeaves(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to load your leaves');
      setMyLeaves([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  useEffect(() => {
    if (tab === 'team') loadLeaves();
    else loadMyLeaves();
    // Date inputs apply via the Apply button; status / employee filters reload immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter, employeeFilter, managerId]);

  const reload = () => (tab === 'team' ? loadLeaves() : loadMyLeaves());

  return (
    <ScreenShell
      title="Leave Management"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        reload();
      }}
      headerRight={
        <TouchableOpacity onPress={() => navigation.navigate('LeaveRequest')}>
          <Text style={styles.headerAction}>Apply</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.tabRow}>
        {(['team', 'mine'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'mine' ? 'My Leaves' : isOwnPage ? 'My BDEs’ Leaves' : 'Team Leaves'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <WebButton title="Retry" variant="outline" onPress={reload} />
        </View>
      ) : null}

      {tab === 'mine' ? (
        <>
          <Text style={styles.hint}>Your leave is approved after both Admin and HR Manager approve it.</Text>
          {myLeaves.length === 0 ? (
            <Text style={styles.empty}>You have not applied for any leave yet.</Text>
          ) : (
            myLeaves.map((leave) => (
              <View key={leave._id} style={styles.card}>
                <Text style={styles.cardTitle}>{leaveTypeLabel(leave.leaveType)}</Text>
                <Text style={styles.meta}>
                  {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.days ?? '-'} day(s)
                </Text>
                {leave.reason ? <Text style={styles.meta}>Reason: {leave.reason}</Text> : null}
                <View style={styles.section}>
                  <LeaveApprovalStatus leave={leave} showRejectionReason />
                </View>
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <View style={styles.filterCard}>
            <WebSelect
              label="Status"
              value={statusFilter === 'all' ? '' : statusFilter}
              placeholder="All Status"
              onValueChange={(v) => setStatusFilter(v || 'all')}
              items={['Pending', 'Approved', 'Rejected'].map((s) => ({ label: s, value: s }))}
            />
            <WebSelect
              label="Employee"
              value={employeeFilter === 'all' ? '' : employeeFilter}
              placeholder="All Employees"
              onValueChange={(v) => setEmployeeFilter(v || 'all')}
              items={knownEmployees.map((e) => ({ label: e.name, value: e._id }))}
            />
            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>From (YYYY-MM-DD)</Text>
                <WebInput value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>To (YYYY-MM-DD)</Text>
                <WebInput value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>
            <WebButton title="Apply" variant="outline" onPress={loadLeaves} />
          </View>

          {leaves.length === 0 ? (
            <Text style={styles.empty}>No leaves found</Text>
          ) : (
            leaves.map((leave) => (
              <View key={leave._id} style={[styles.card, leave.status === 'Pending' && leave.canDecide && styles.cardActionable]}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{leave.employeeId?.name || 'Unknown employee'}</Text>
                    {leave.employeeId?.email ? <Text style={styles.meta}>{leave.employeeId.email}</Text> : null}
                  </View>
                  <Text style={styles.meta}>{leaveTypeLabel(leave.leaveType)}</Text>
                </View>
                <Text style={styles.meta}>
                  {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.days ?? '-'} day(s)
                </Text>
                {leave.reason ? <Text style={styles.meta}>Reason: {leave.reason}</Text> : null}
                <Text style={styles.meta}>City: {leave.employeeId?.assignedCity || '-'}</Text>
                <View style={styles.section}>
                  <LeaveApprovalStatus leave={leave} />
                </View>
                <View style={styles.footer}>
                  {leave.status === 'Pending' && leave.canDecide ? (
                    <LeaveDecisionActions leave={leave} onDone={loadLeaves} />
                  ) : leave.status === 'Pending' ? (
                    <Text style={styles.meta}>Your decision is recorded or not required</Text>
                  ) : (
                    <View>
                      {leave.approvedBy ? <Text style={styles.meta}>By: {leave.approvedBy.name}</Text> : null}
                      {leave.approvedAt ? <Text style={styles.meta}>{formatDate(leave.approvedAt)}</Text> : null}
                      {leave.rejectionReason ? (
                        <Text style={[styles.meta, { color: colors.error }]}>Reason: {leave.rejectionReason}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headerAction: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  tabTextActive: { color: colors.primaryForeground },
  hint: { fontSize: 12, color: colors.textSecondary, marginBottom: 10 },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: radii.md, padding: 12, marginBottom: 12, gap: 8 },
  errorText: { color: colors.error, fontSize: 13 },
  filterCard: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 12,
  },
  dateRow: { flexDirection: 'row', gap: 8 },
  label: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, marginBottom: 4 },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 40 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  cardActionable: { borderColor: colors.primaryLight },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardTitle: { ...typography.heading.h4, color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary },
  section: { marginTop: 6 },
  footer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
