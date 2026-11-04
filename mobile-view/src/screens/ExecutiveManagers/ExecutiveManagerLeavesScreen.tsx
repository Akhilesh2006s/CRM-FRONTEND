import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebSelect, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ChipRow, ActionRow, EmptyState } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { leaveTypeLabel, leaveDayTypeLabel, leaveDayCount, formatLeaveDays } from '../../lib/leaveTypes';
import type { LeaveApprovalFields } from '../../lib/leaveApproval';
import LeaveApprovalStatus from '../../components/leaves/LeaveApprovalStatus';
import LeaveDecisionActions from '../../components/leaves/LeaveDecisionActions';

import DateField from '../../ui/DateField';
type LeaveEmployee = { _id: string; name: string; email?: string; assignedCity?: string };

type Leave = LeaveApprovalFields & {
  _id: string;
  employeeId: LeaveEmployee | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  dayType?: string;
  halfDaySession?: string | null;
  reason: string;
  approvedBy?: { name: string; email?: string };
  approvedAt?: string;
  createdAt: string;
};

type Tab = 'team' | 'mine';

const formatDate = (d?: string) => {
  if (!d) return '-';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      <ChipRow
        items={(['team', 'mine'] as Tab[]).map((t) => ({
          key: t,
          label: t === 'mine' ? 'My Leaves' : isOwnPage ? 'My BDEs’ Leaves' : 'Team Leaves',
        }))}
        value={tab}
        onChange={(k) => setTab(k as Tab)}
      />
      <View style={{ height: 12 }} />

      {loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <WebButton title="Retry" variant="outline" onPress={reload} />
        </View>
      ) : null}

      {tab === 'mine' ? (
        <>
          <Text style={styles.hint}>Approved after both Admin and HR Manager approve.</Text>
          {myLeaves.length === 0 ? (
            <EmptyState icon="🗓️" title="No leaves yet" message="You have not applied for any leave yet." />
          ) : (
            myLeaves.map((leave) => (
              <Card key={leave._id}>
                <CardTitle title={leaveTypeLabel(leave.leaveType)} subtitle={leaveDayTypeLabel(leave)} />
                <InfoRow label="Dates" value={`${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}`} />
                <InfoRow label="Days" value={formatLeaveDays(leaveDayCount(leave))} />
                <InfoRow label="Reason" value={leave.reason || ''} />
                <View style={styles.section}>
                  <LeaveApprovalStatus leave={leave} showRejectionReason />
                </View>
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          <PageSection title="Filters">
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
                <WebLabel>From</WebLabel>
                <DateField placeholder="From" value={fromDate} onChange={setFromDate} />
              </View>
              <View style={{ flex: 1 }}>
                <WebLabel>To</WebLabel>
                <DateField placeholder="To" value={toDate} onChange={setToDate} />
              </View>
            </View>
            <WebButton title="Apply" variant="outline" onPress={loadLeaves} />
          </PageSection>

          {leaves.length === 0 ? (
            <EmptyState icon="🗓️" title="No leaves found" />
          ) : (
            leaves.map((leave) => (
              <Card key={leave._id} style={leave.status === 'Pending' && leave.canDecide ? styles.cardActionable : undefined}>
                <CardTitle
                  title={leave.employeeId?.name || 'Unknown employee'}
                  subtitle={leave.employeeId?.email || undefined}
                  badge={leaveTypeLabel(leave.leaveType)}
                  tone="info"
                />
                <InfoRow label="Dates" value={`${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}`} />
                <InfoRow label="Type" value={leaveDayTypeLabel(leave)} />
                <InfoRow label="Days" value={formatLeaveDays(leaveDayCount(leave))} />
                <InfoRow label="Reason" value={leave.reason || ''} />
                <InfoRow label="City" value={leave.employeeId?.assignedCity || ''} />
                <View style={styles.section}>
                  <LeaveApprovalStatus leave={leave} />
                </View>
                {leave.status === 'Pending' && leave.canDecide ? (
                  <ActionRow>
                    <View style={{ flex: 1 }}>
                      <LeaveDecisionActions leave={leave} onDone={loadLeaves} />
                    </View>
                  </ActionRow>
                ) : leave.status === 'Pending' ? null : leave.approvedBy || leave.approvedAt || leave.rejectionReason ? (
                  <ActionRow>
                    <View style={{ flex: 1 }}>
                      {leave.approvedBy ? <InfoRow label="By" value={leave.approvedBy.name} /> : null}
                      {leave.approvedAt ? <InfoRow label="On" value={formatDate(leave.approvedAt)} /> : null}
                      {leave.rejectionReason ? (
                        <Text style={styles.rejectText}>Reason: {leave.rejectionReason}</Text>
                      ) : null}
                    </View>
                  </ActionRow>
                ) : null}
              </Card>
            ))
          )}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headerAction: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 13, color: colors.textTertiary, marginBottom: 12 },
  errorBox: { backgroundColor: colors.errorLight, borderRadius: 10, padding: 12, marginBottom: 12, gap: 8 },
  errorText: { color: colors.error, fontSize: 13 },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cardActionable: { borderColor: colors.primaryLight },
  section: { marginTop: 8 },
  rejectText: { fontSize: 13, color: colors.error, marginTop: 4 },
});
