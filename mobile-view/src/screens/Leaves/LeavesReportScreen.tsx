import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebSelect, WebLabel, WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, toneFor } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { leaveTypeLabel, isHalfDayLeave } from '../../lib/leaveTypes';
import { slotLabel } from '../../lib/leaveApproval';

import DateField from '../../ui/DateField';
type LeaveStatus = 'all' | 'Pending' | 'Approved' | 'Rejected';

export default function LeavesReportScreen({ navigation }: any) {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus>('all');
  const [onLeaveDate, setOnLeaveDate] = useState('');
  // Month filter (YYYY-MM) on approval date, else start date — same as web leaves report.
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/leaves');
      setLeaves(Array.isArray(data) ? data : (data?.data || []));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load leaves report');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const counts = useMemo(() => {
    const selectedDate = onLeaveDate ? new Date(`${onLeaveDate}T00:00:00`) : null;
    return {
      total: leaves.length,
      pending: leaves.filter((leave) => leave.status === 'Pending').length,
      approved: leaves.filter((leave) => leave.status === 'Approved').length,
      rejected: leaves.filter((leave) => leave.status === 'Rejected').length,
      onLeave: selectedDate ? leaves.filter((leave) => leave.status === 'Approved' && new Date(leave.startDate) <= selectedDate && new Date(leave.endDate) >= selectedDate).length : 0,
    };
  }, [leaves, onLeaveDate]);

  const filteredLeaves = useMemo(() => {
    const selectedDate = onLeaveDate ? new Date(`${onLeaveDate}T00:00:00`) : null;
    const monthKey = /^\d{4}-\d{2}$/.test(month.trim()) ? month.trim() : '';
    return [...leaves]
      .filter((leave) => {
        if (!monthKey) return true;
        const stamp = leave.approvedAt || leave.startDate;
        if (!stamp) return false;
        const d = new Date(stamp);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === monthKey;
      })
      .filter((leave) => statusFilter === 'all' || leave.status === statusFilter)
      .filter((leave) => !selectedDate || statusFilter !== 'Approved' || (new Date(leave.startDate) <= selectedDate && new Date(leave.endDate) >= selectedDate))
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [leaves, onLeaveDate, statusFilter, month]);

  const employeeName = (leave: any) => typeof leave.employeeId === 'string' ? leave.employeeId : leave.employeeId?.name || 'Unknown';
  const managerName = (leave: any) => {
    const manager = typeof leave.employeeId === 'object' ? leave.employeeId?.executiveManagerId : null;
    return !manager ? '— Not assigned' : typeof manager === 'string' ? manager : manager.name || '—';
  };
  const approvedByName = (leave: any) => !leave.approvedBy ? '—' : typeof leave.approvedBy === 'string' ? leave.approvedBy : leave.approvedBy.name || '—';
  const approvalText = (leave: any) => {
    if (leave.status === 'Rejected' && leave.rejectionReason) return `${leave.approvalSummary || 'Rejected'} — ${leave.rejectionReason}`;
    if (leave.approvalSummary) return leave.approvalSummary;
    const parts = (leave.approvals || []).map((a: any) => `${a.label || slotLabel(a.slot)}: ${a.status}`);
    return parts.length ? parts.join(', ') : '—';
  };
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const refresh = () => { setRefreshing(true); loadData(); };

  return (
    <ScreenShell
      title="Leaves Report"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={refresh}
      headerRight={
        <TouchableOpacity style={styles.pendingButton} onPress={() => navigation.navigate('LeavesPending')} hitSlop={8}>
          <Text style={styles.pendingButtonText}>Pending</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
        <SummaryCard label="Total" value={counts.total} />
        <SummaryCard label="Pending" value={counts.pending} />
        <SummaryCard label="Approved" value={counts.approved} />
        <SummaryCard label="Rejected" value={counts.rejected} />
        <SummaryCard label="On leave (date)" value={counts.onLeave} />
      </ScrollView>

      <PageSection title="Filters">
        <WebSelect label="Status" value={statusFilter} onValueChange={(value) => setStatusFilter(value as LeaveStatus)} items={[
          { label: 'All statuses', value: 'all' }, { label: 'Pending', value: 'Pending' }, { label: 'Approved', value: 'Approved' }, { label: 'Rejected', value: 'Rejected' },
        ]} />
        <WebLabel>Month (YYYY-MM, blank = all)</WebLabel>
        <WebInput value={month} onChangeText={setMonth} placeholder="YYYY-MM" keyboardType="numbers-and-punctuation" />
        <WebLabel>On Leave Date</WebLabel>
        <DateField placeholder="On Leave Date" value={onLeaveDate} onChange={setOnLeaveDate} />
        <View style={{ height: 8 }} />
        <WebButton title={loading ? 'Refreshing…' : 'Refresh'} variant="outline" onPress={loadData} disabled={loading} />
      </PageSection>

      {filteredLeaves.length === 0 ? (
        <EmptyState icon="🗓️" title="No leaves match filters" />
      ) : (
        filteredLeaves.map((leave) => (
          <Card key={leave._id}>
            <CardTitle
              title={employeeName(leave)}
              subtitle={`${leaveTypeLabel(leave.leaveType)}${isHalfDayLeave(leave) ? ' (Half Day)' : ''}`}
              badge={leave.status || 'Pending'}
              tone={toneFor(leave.status || 'Pending')}
            />
            <InfoRow label="Manager" value={managerName(leave)} />
            <InfoRow label="From" value={formatDate(leave.startDate)} />
            <InfoRow label="To" value={formatDate(leave.endDate)} />
            <InfoRow label="Approval" value={approvalText(leave)} />
            <InfoRow label="Approved by" value={approvedByName(leave)} />
            <InfoRow label="Approval date" value={formatDate(leave.approvedAt)} />
            <InfoRow label="Reason" value={leave.reason || '—'} />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pendingButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent },
  pendingButtonText: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  summaryScroll: { gap: 8, paddingBottom: 12 },
  summaryCard: {
    width: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    backgroundColor: colors.backgroundLight,
    padding: 12,
  },
  summaryLabel: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  summaryValue: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
});
