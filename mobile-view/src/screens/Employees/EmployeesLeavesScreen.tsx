import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState, toneFor } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { leaveDayTypeLabel, leaveDayCount, formatLeaveDays } from '../../lib/leaveTypes';

export default function EmployeesLeavesScreen({ navigation, route }: any) {
  const employeeId = route?.params?.employeeId;
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const endpoint = employeeId ? `/leaves?employeeId=${employeeId}` : '/leaves';
      const data = await apiService.get(endpoint);
      setLeaves(Array.isArray(data) ? data : (data?.data || []));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load leaves');
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
      title="Employee Leaves"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {leaves.length === 0 ? (
        <EmptyState icon="📅" title="No leaves found" />
      ) : (
        leaves.map((leave) => {
          const status = leave.status || 'Pending';
          return (
            <Card key={leave._id}>
              <CardTitle title={leave.employeeId?.name || 'Employee'} badge={status} tone={toneFor(status)} />
              <InfoRow label="From" value={formatDate(leave.startDate)} />
              <InfoRow label="To" value={formatDate(leave.endDate)} />
              <InfoRow label="Days" value={`${formatLeaveDays(leaveDayCount(leave))} (${leaveDayTypeLabel(leave)})`} />
              <InfoRow label="Reason" value={leave.reason} />
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}
