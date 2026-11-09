import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState, Badge, SectionTitle } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { leaveTypeLabel, leaveDayTypeLabel, leaveDayCount, formatLeaveDays } from '../../lib/leaveTypes';
import LeaveApprovalStatus from '../../components/leaves/LeaveApprovalStatus';
import LeaveBalanceCard from '../../components/leaves/LeaveBalanceCard';
import LeavePaymentBreakdown from '../../components/leaves/LeavePaymentBreakdown';
import { type Holiday, type LeaveBalance, allocationOf, longDay, shortDay } from '../../lib/leavePolicy';

export default function LeavesApprovedScreen({ navigation }: any) {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    loadData();
  }, [user?._id]);

  const loadData = async () => {
    if (!user?._id) return;
    try {
      setLoading(true);
      const year = new Date().getFullYear();
      const [data, bal, hol] = await Promise.all([
        apiService.get(`/leaves?employeeId=${user._id}`),
        apiService.get('/leaves/balance').catch(() => null),
        apiService.get(`/holidays?year=${year}`).catch(() => null),
      ]);
      setLeaves(Array.isArray(data) ? data : []);
      setBalance((bal as LeaveBalance) || null);
      setHolidays(Array.isArray((hol as any)?.holidays) ? (hol as any).holidays : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load approved leaves');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="My Leaves"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <TouchableOpacity style={styles.applyBtn} onPress={() => navigation.navigate('LeaveRequest')} hitSlop={8}>
          <Text style={styles.applyText}>+ Apply</Text>
        </TouchableOpacity>
      }
    >
      <LeaveBalanceCard balance={balance} />
      {leaves.length === 0 ? (
        <EmptyState icon="🗓️" title="No leave requests yet" message="Tap Apply to request a leave." />
      ) : (
        leaves.map((leave) => (
          <Card key={leave._id}>
            <CardTitle
              title={leaveTypeLabel(leave.leaveType)}
              subtitle={`${formatLeaveDays(leaveDayCount(leave))} · ${leaveDayTypeLabel(leave)}`}
            />
            <InfoRow label="From" value={formatDate(leave.startDate)} />
            <InfoRow label="To" value={formatDate(leave.endDate)} />
            <InfoRow label="Reason" value={leave.reason} />
            <View style={styles.statusWrap}>
              <LeaveApprovalStatus leave={{ ...leave, status: leave.status || 'Pending' }} showRejectionReason />
            </View>
            <LeavePaymentBreakdown allocation={allocationOf(leave)} />
          </Card>
        ))
      )}

      <SectionTitle>Holidays Worked</SectionTitle>
      <Card>
        {(balance?.holidayWorked || []).length === 0 ? (
          <Text style={styles.muted}>No Sundays or company holidays worked yet.</Text>
        ) : (
          (balance?.holidayWorked || []).map((h) => (
            <View key={h.date} style={styles.listRow}>
              <Text style={styles.listText}>{shortDay(h.date)} · {h.name}</Text>
              <Badge label="Comp-Off Earned" tone="success" />
            </View>
          ))
        )}
      </Card>

      <SectionTitle>{`Company Holidays (${holidays.length} / 12)`}</SectionTitle>
      <Card>
        {holidays.length === 0 ? (
          <Text style={styles.muted}>HR has not added this year's holiday calendar yet.</Text>
        ) : (
          holidays.map((h) => (
            <View key={h._id} style={styles.listRow}>
              <Text style={styles.listText}>{h.name}</Text>
              <Text style={styles.muted}>{longDay(h.date)}</Text>
            </View>
          ))
        )}
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  applyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent },
  applyText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  muted: { color: '#6B7280', fontSize: 13 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, gap: 8 },
  listText: { color: '#111827', fontSize: 14, flexShrink: 1 },
  statusWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
});
