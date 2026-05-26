import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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
      return new Date(dateString).toLocaleDateString('en-IN');
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
        <TouchableOpacity onPress={() => navigation.navigate('LeaveRequest')}>
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Apply</Text>
        </TouchableOpacity>
      }
    >
<ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {leaves.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No leave requests yet</Text>
          </View>
        ) : (
          leaves.map((leave) => (
            <View key={leave._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.employeeName}>{leave.leaveType || 'Leave'}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        leave.status === 'Approved'
                          ? colors.success + '20'
                          : leave.status === 'Rejected'
                            ? colors.error + '20'
                            : colors.warning + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      {
                        color:
                          leave.status === 'Approved'
                            ? colors.success
                            : leave.status === 'Rejected'
                              ? colors.error
                              : colors.warning,
                      },
                    ]}
                  >
                    {leave.status || 'Pending'}
                  </Text>
                </View>
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
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Days:</Text>
                  <Text style={styles.infoValue}>{leave.days || '-'}</Text>
                </View>
                {leave.reason && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Reason:</Text>
                    <Text style={styles.infoValue}>{leave.reason}</Text>
                  </View>
                )}
                {leave.status === 'Rejected' && leave.rejectionReason ? (
                  <View style={[styles.infoRow, styles.rejectionRow]}>
                    <Text style={styles.infoLabel}>Rejection:</Text>
                    <Text style={styles.rejectionValue}>{leave.rejectionReason}</Text>
                  </View>
                ) : null}
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
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { ...typography.label.small, fontWeight: '600' },
  cardBody: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 80 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  rejectionRow: { marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  rejectionValue: { ...typography.body.medium, color: colors.error, flex: 1 },
});


