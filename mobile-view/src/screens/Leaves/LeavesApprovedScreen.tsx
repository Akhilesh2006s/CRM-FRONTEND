import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { leaveTypeLabel, leaveDayTypeLabel, leaveDayCount, formatLeaveDays } from '../../lib/leaveTypes';
import LeaveApprovalStatus from '../../components/leaves/LeaveApprovalStatus';

export default function LeavesApprovedScreen({ navigation }: any) {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?._id]);

  const loadData = async () => {
    if (!user?._id) return;
    try {
      setLoading(true);
      const data = await apiService.get(`/leaves?employeeId=${user._id}`);
      setLeaves(Array.isArray(data) ? data : []);
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
          </Card>
        ))
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  applyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accent },
  applyText: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  statusWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
});
