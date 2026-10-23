import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { leaveTypeLabel } from '../../lib/leaveTypes';
import { slotLabel } from '../../lib/leaveApproval';

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
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString('en-IN') : '—';
  const refresh = () => { setRefreshing(true); loadData(); };

  return (
    <ScreenShell title="Leaves Report" loading={loading && !refreshing} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Leaves Report</Text>
        <TouchableOpacity style={styles.pendingButton} onPress={() => navigation.navigate('LeavesPending')}>
          <Text style={styles.pendingButtonText}>Pending approvals</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
          <SummaryCard label="Total" value={counts.total} />
          <SummaryCard label="Pending" value={counts.pending} />
          <SummaryCard label="Approved" value={counts.approved} />
          <SummaryCard label="Rejected" value={counts.rejected} />
          <SummaryCard label="On leave (date)" value={counts.onLeave} />
        </ScrollView>
        <View style={styles.reportCard}>
          <View style={styles.filters}>
            <WebSelect label="Status" value={statusFilter} onValueChange={(value) => setStatusFilter(value as LeaveStatus)} items={[
              { label: 'All statuses', value: 'all' }, { label: 'Pending', value: 'Pending' }, { label: 'Approved', value: 'Approved' }, { label: 'Rejected', value: 'Rejected' },
            ]} />
            <View style={styles.dateField}>
              <Text style={styles.label}>Month (YYYY-MM, blank = all)</Text>
              <WebInput style={styles.dateInput} value={month} onChangeText={setMonth} placeholder="YYYY-MM" keyboardType="numbers-and-punctuation" />
            </View>
            <View style={styles.dateField}>
              <Text style={styles.label}>On Leave Date</Text>
              <WebInput style={styles.dateInput} value={onLeaveDate} onChangeText={setOnLeaveDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            </View>
            <TouchableOpacity style={styles.refreshButton} onPress={loadData} disabled={loading}>
              <Text style={styles.refreshButtonText}>{loading ? 'Refreshing…' : 'Refresh'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <Text style={[styles.headerCell, styles.employeeColumn]}>Employee</Text><Text style={[styles.headerCell, styles.managerColumn]}>Manager</Text><Text style={[styles.headerCell, styles.statusColumn]}>Status</Text><Text style={[styles.headerCell, styles.approvalColumn]}>Approval status</Text><Text style={[styles.headerCell, styles.typeColumn]}>Leave Type</Text><Text style={[styles.headerCell, styles.dateColumn]}>From</Text><Text style={[styles.headerCell, styles.dateColumn]}>To</Text><Text style={[styles.headerCell, styles.approvedByColumn]}>Approved by</Text><Text style={[styles.headerCell, styles.dateColumn]}>Approval date</Text><Text style={[styles.headerCell, styles.reasonColumn]}>Reason</Text>
              </View>
              {filteredLeaves.length === 0 ? <Text style={styles.emptyRow}>No leaves match filters</Text> : filteredLeaves.map((leave) => (
                <View key={leave._id} style={styles.tableRow}>
                  <Text style={[styles.cell, styles.employeeColumn]} numberOfLines={1}>{employeeName(leave)}</Text><Text style={[styles.cell, styles.managerColumn]} numberOfLines={1}>{managerName(leave)}</Text><Text style={[styles.cell, styles.statusColumn]}>{leave.status || 'Pending'}</Text><Text style={[styles.cell, styles.approvalColumn]} numberOfLines={2}>{approvalText(leave)}</Text><Text style={[styles.cell, styles.typeColumn]} numberOfLines={1}>{leaveTypeLabel(leave.leaveType)}</Text><Text style={[styles.cell, styles.dateColumn]}>{formatDate(leave.startDate)}</Text><Text style={[styles.cell, styles.dateColumn]}>{formatDate(leave.endDate)}</Text><Text style={[styles.cell, styles.approvedByColumn]} numberOfLines={1}>{approvedByName(leave)}</Text><Text style={[styles.cell, styles.dateColumn]}>{formatDate(leave.approvedAt)}</Text><Text style={[styles.cell, styles.reasonColumn]} numberOfLines={1}>{leave.reason || '—'}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }, heading: { ...typography.heading.h3, color: colors.textPrimary }, pendingButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.backgroundLight, paddingHorizontal: 12, paddingVertical: 7 }, pendingButtonText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary }, content: { flex: 1, padding: 16 }, summaryScroll: { gap: 10, paddingBottom: 16 }, summaryCard: { width: 145, minHeight: 82, justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundLight, padding: 14 }, summaryLabel: { fontSize: 12, color: colors.textSecondary }, summaryValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary }, reportCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.backgroundLight, overflow: 'hidden', marginBottom: 24 }, filters: { padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }, label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 }, dateField: { marginBottom: 12 }, dateInput: { marginBottom: 0, backgroundColor: colors.background }, refreshButton: { alignSelf: 'flex-end', minWidth: 96, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.backgroundLight, alignItems: 'center' }, refreshButtonText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary }, tableScroll: { paddingBottom: 4 }, table: { minWidth: 1480 }, tableRow: { flexDirection: 'row', minHeight: 42, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.borderLight }, tableHeader: { minHeight: 40, backgroundColor: '#F0F9FF' }, headerCell: { paddingHorizontal: 10, fontSize: 12, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' }, cell: { paddingHorizontal: 10, fontSize: 12, color: colors.textPrimary, textAlign: 'center' }, employeeColumn: { width: 135, textAlign: 'left' }, managerColumn: { width: 170, textAlign: 'left' }, statusColumn: { width: 100 }, approvalColumn: { width: 220, textAlign: 'left' }, typeColumn: { width: 130, textAlign: 'left' }, dateColumn: { width: 110 }, approvedByColumn: { width: 150, textAlign: 'left' }, reasonColumn: { width: 145, textAlign: 'left' }, emptyRow: { minWidth: 1480, padding: 20, textAlign: 'center', color: colors.textSecondary },
});
