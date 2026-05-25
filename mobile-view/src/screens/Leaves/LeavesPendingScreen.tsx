import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

export default function LeavesPendingScreen({ navigation }: any) {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/leaves?status=Pending');
      setLeaves(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load pending leaves');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await apiService.put(`/leaves/${id}/approve`, { status });
      Alert.alert('Success', `Leave ${status.toLowerCase()} successfully!`);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update leave');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN');
    } catch {
      return '-';
    }
  };

  return (
    <ScreenShell
      title="Pending Leaves"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {leaves.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>No pending leaves found</Text>
          </View>
        ) : (
          leaves.map((leave) => (
            <View key={leave._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.employeeName}>{typeof leave.employeeId === 'string' ? leave.employeeId : leave.employeeId?.name || 'Unknown'}</Text>
                <Text style={styles.leaveType}>{leave.leaveType || '-'}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>From:</Text>
                  <Text style={styles.infoValue}>{formatDate(leave.startDate)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>To:</Text>
                  <Text style={styles.infoValue}>{formatDate(leave.endDate)}</Text>
                </View>
                {leave.reason && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Reason:</Text>
                    <Text style={styles.infoValue}>{leave.reason}</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.approveButton} onPress={() => handleAction(leave._id, 'Approved')}>
                  <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton} onPress={() => handleAction(leave._id, 'Rejected')}>
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  employeeName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  leaveType: { ...typography.body.medium, color: colors.textSecondary },
  cardBody: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 80 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  cardFooter: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  approveButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.success, alignItems: 'center' },
  approveButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  rejectButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.error || '#ef4444', alignItems: 'center' },
  rejectButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
});


