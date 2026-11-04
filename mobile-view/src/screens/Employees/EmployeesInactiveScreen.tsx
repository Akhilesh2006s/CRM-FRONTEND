import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { apiService } from '../../services/api';
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
  inactiveReason?: string | null;
}

function reasonLabel(reason?: string | null) {
  if (reason === 'manual') return 'Manually deactivated';
  if (reason === 'on_leave') return 'On leave';
  return reason || '-';
}

export default function EmployeesInactiveScreen({ navigation }: any) {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/employees?isActive=false');
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      showAlert('Error', error.message || 'Failed to load inactive employees');
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

  const reactivate = (id: string, name: string) => {
    showConfirm(
      'Reactivate employee',
      `Reactivate ${name}? They will move back to Active Employees.`,
      async () => {
        try {
          setBusyId(id);
          await apiService.put(`/employees/${id}`, { isActive: true, inactiveReason: null });
          setItems((prev) => prev.filter((e) => e._id !== id));
          showAlert('Success', `${name} has been reactivated.`);
          loadData();
        } catch (e: any) {
          showAlert('Error', e?.message || 'Failed to reactivate employee');
        } finally {
          setBusyId(null);
        }
      },
      'Reactivate',
    );
  };

  const words = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = items.filter((e) => {
    if (!words.length) return true;
    const text = [e.name, e.email, e.phone, e.mobile, e.role, e.department, e.zone, reasonLabel(e.inactiveReason)]
      .map((v) => String(v || '').toLowerCase())
      .join(' ');
    return words.every((w) => text.includes(w));
  });

  return (
    <ScreenShell
      title="Inactive Employees"
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
          <EmptyState icon="👥" title="No inactive employees found" message={searchQuery ? 'Try a different search.' : undefined} />
        ) : (
          filtered.map((e) => (
            <Card key={e._id}>
              <CardTitle title={e.name} badge={e.role} tone="neutral" />
              <InfoRow label="Email" value={e.email} />
              <InfoRow label="Mobile" value={e.mobile || e.phone} phone />
              <InfoRow label="Department" value={e.department} />
              <InfoRow label="Zone" value={e.zone} />
              <InfoRow label="Reason" value={reasonLabel(e.inactiveReason)} />
              <ActionRow>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => navigation.navigate('EmployeeEdit', { id: e._id })}
                  disabled={busyId === e._id}
                >
                  <Text style={styles.btnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary, busyId === e._id && styles.buttonDisabled]}
                  onPress={() => reactivate(e._id, e.name)}
                  disabled={busyId === e._id}
                >
                  <Text style={styles.btnPrimaryText}>{busyId === e._id ? 'Working…' : 'Reactivate'}</Text>
                </TouchableOpacity>
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
  buttonDisabled: { opacity: 0.6 },
});
