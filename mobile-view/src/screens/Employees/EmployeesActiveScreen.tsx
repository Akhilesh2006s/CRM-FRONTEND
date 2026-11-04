import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
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

  const resetDevice = (id: string, name: string) => {
    showConfirm(
      'Reset Device',
      `Reset the app device for ${name}? Their next app login binds the phone they use.`,
      async () => {
        try {
          setBusyId(id);
          await apiService.put(`/employees/${id}/reset-device`, {});
          showAlert('Success', `Device reset for ${name}. They can log in on their new phone now.`);
        } catch (e: any) {
          showAlert('Error', e?.message || 'Failed to reset device');
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
  // HR Executives have view-only access to employee details (backend PUT rule).
  const isHrExecutive = user?.role === 'HR Executive';
  // Only Admin / Super Admin may clear a mobile device binding (backend route rule).
  const canResetDevice = user?.role === 'Admin' || user?.role === 'Super Admin';
  const words = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = items.filter((e) => {
    if (!words.length) return true;
    const text = [e.name, e.email, e.phone, e.mobile, e.role, e.department, e.zone, e.cluster]
      .map((v) => String(v || '').toLowerCase())
      .join(' ');
    return words.every((w) => text.includes(w));
  });

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
          placeholder="Search name, email, phone, role, zone…"
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
        <Text style={styles.count}>{filtered.length} employee{filtered.length === 1 ? '' : 's'}</Text>
        {filtered.length === 0 ? (
          <EmptyState icon="👥" title="No active employees found" message={searchQuery ? 'Try a different search.' : undefined} />
        ) : (
          filtered.map((e) => (
            <Card key={e._id}>
              <CardTitle title={e.name} badge={e.role} tone="info" />
              <InfoRow label="Email" value={e.email} />
              <InfoRow label="Contact No" value={e.phone && e.phone !== '0' ? e.phone : ''} phone />
              <InfoRow label="Department" value={e.department} />
              <InfoRow label="Zone" value={e.zone} />
              <InfoRow label="Cluster" value={e.cluster} />

              <ActionRow>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => navigation.navigate('EmployeeDetails', { id: e._id })}
                >
                  <Text style={styles.btnPrimaryText}>View Details</Text>
                </TouchableOpacity>
                {!isCoordinator && !isHrExecutive ? (
                  <TouchableOpacity
                    style={styles.btn}
                    onPress={() => navigation.navigate('EmployeeEdit', { id: e._id })}
                    disabled={busyId === e._id}
                  >
                    <Text style={styles.btnText}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
                {!isCoordinator ? (
                  <TouchableOpacity
                    style={styles.btn}
                    onPress={() => resetPassword(e._id, e.name)}
                    disabled={busyId === e._id}
                  >
                    <Text style={styles.btnText}>Reset Password</Text>
                  </TouchableOpacity>
                ) : null}
                {!isCoordinator && canResetDevice ? (
                  <TouchableOpacity
                    style={styles.btn}
                    onPress={() => resetDevice(e._id, e.name)}
                    disabled={busyId === e._id}
                  >
                    <Text style={styles.btnText}>Reset Device</Text>
                  </TouchableOpacity>
                ) : null}
                {!isCoordinator ? (
                  <TouchableOpacity
                    style={[styles.btn, styles.btnWarn, busyId === e._id && styles.buttonDisabled]}
                    onPress={() => deactivate(e._id, e.name)}
                    disabled={busyId === e._id}
                  >
                    <Text style={styles.btnWarnText}>{busyId === e._id ? 'Working…' : 'Deactivate'}</Text>
                  </TouchableOpacity>
                ) : null}
              </ActionRow>
            </Card>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  searchInput: { flex: 1, marginBottom: 0 },
  refreshButton: {
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
    justifyContent: 'center',
  },
  refreshButtonText: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  count: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    backgroundColor: colors.backgroundLight,
  },
  btnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  btnPrimary: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  btnPrimaryText: { fontSize: 13, fontWeight: '700', color: colors.primaryForeground },
  btnWarn: { borderColor: '#F2C46D' },
  btnWarnText: { fontSize: 13, fontWeight: '600', color: '#B45309' },
  buttonDisabled: { opacity: 0.6 },
});
