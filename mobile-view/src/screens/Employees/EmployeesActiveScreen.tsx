import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { showAlert, showConfirm } from '../../utils/showAlert';

interface Employee {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  role: string;
  department?: string;
  zone?: string;
  cluster?: string;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function EmployeesActiveScreen({ navigation }: any) {
  const { user } = useAuth();
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/employees?isActive=true') as Employee[];
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to load employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const resetPassword = (id: string, name: string) => {
    showConfirm(
      'Reset Password',
      `Reset password for ${name} to "Password123"?`,
      async () => {
        try {
          setBusyId(id);
          await apiService.put(`/employees/${id}/reset-password`, {});
          showAlert('Success', `Password reset to Password123 for ${name}`);
          loadData();
        } catch (e: any) {
          showAlert('Error', e?.message || 'Failed to reset password');
        } finally {
          setBusyId(null);
        }
      },
      'Reset',
    );
  };

  const deactivate = (id: string, name: string) => {
    showConfirm(
      'Deactivate employee',
      `Deactivate ${name}? They will move to Inactive Employees.`,
      async () => {
        try {
          setBusyId(id);
          await apiService.put(`/employees/${id}`, { isActive: false, inactiveReason: 'manual' });
          setItems((prev) => prev.filter((e) => e._id !== id));
          showAlert('Success', `${name} has been deactivated and moved to Inactive Employees.`);
          loadData();
        } catch (e: any) {
          showAlert('Error', e?.message || 'Failed to deactivate employee');
        } finally {
          setBusyId(null);
        }
      },
      'Deactivate',
    );
  };

  const isCoordinator = user?.role === 'Coordinator' || user?.role === 'Senior Coordinator';
  const filtered = items.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phone || '').includes(searchQuery) ||
      (e.zone || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <ScreenShell
      title="Employees List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
    >
      <View style={styles.searchContainer}>
        <WebInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search name/email/company number"
        />
        <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No active employees found</Text>
          </View>
        ) : (
          filtered.map((e) => (
            <View key={e._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.employeeName} numberOfLines={2}>
                  {e.name}
                </Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{e.role}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <InfoRow label="Email" value={e.email || '-'} />
                <InfoRow label="Company Contact No" value={(e.phone && e.phone !== '0') ? e.phone : '-'} />
                <InfoRow label="Role" value={e.role || '-'} />
                <InfoRow label="Department" value={e.department || '-'} />
                <InfoRow label="Cluster" value={e.cluster || '-'} />
              </View>

              {!isCoordinator && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => navigation.navigate('EmployeeEdit', { id: e._id })}
                    disabled={busyId === e._id}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resetButton}
                    onPress={() => resetPassword(e._id, e.name)}
                    disabled={busyId === e._id}
                  >
                    <Text style={styles.resetButtonText}>Reset Password</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deactivateButton, busyId === e._id && styles.buttonDisabled]}
                    onPress={() => deactivate(e._id, e.name)}
                    disabled={busyId === e._id}
                  >
                    <Text style={styles.deactivateButtonText}>
                      {busyId === e._id ? 'Working…' : 'Deactivate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    ...typography.body.medium,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
  },
  refreshButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  refreshButtonText: {
    ...typography.label.medium,
    color: colors.textLight,
    fontWeight: '600',
  },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  employeeName: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  roleBadge: {
    backgroundColor: colors.infoLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: 140,
  },
  roleBadgeText: {
    ...typography.label.small,
    color: colors.info,
  },
  cardBody: { gap: 8 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoLabel: {
    ...typography.body.small,
    color: colors.textMuted,
    minWidth: 90,
  },
  infoValue: {
    ...typography.body.medium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundLight,
  },
  editButtonText: {
    ...typography.label.medium,
    color: colors.textPrimary,
  },
  resetButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundMuted,
  },
  resetButtonText: {
    ...typography.label.medium,
    color: colors.textPrimary,
  },
  deactivateButton: {
    borderWidth: 1,
    borderColor: '#F2C46D',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundLight,
  },
  deactivateButtonText: {
    ...typography.label.medium,
    color: '#B45309',
  },
  buttonDisabled: { opacity: 0.6 },
});
