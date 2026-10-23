import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
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

  const filtered = items.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.phone || '').includes(searchQuery) ||
      (e.mobile || '').includes(searchQuery),
  );

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
          placeholder="Search name/email/phone"
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
            <Text style={styles.emptyText}>No inactive employees found</Text>
          </View>
        ) : (
          filtered.map((e) => (
            <View key={e._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.employeeName}>{e.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: colors.textSecondary + '20' }]}>
                  <Text style={[styles.roleBadgeText, { color: colors.textSecondary }]}>{e.role}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email:</Text>
                  <Text style={styles.infoValue}>{e.email}</Text>
                </View>
                {(e.mobile || e.phone) ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mobile:</Text>
                    <Text style={styles.infoValue}>{e.mobile || e.phone}</Text>
                  </View>
                ) : null}
                {e.department ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Department:</Text>
                    <Text style={styles.infoValue}>{e.department}</Text>
                  </View>
                ) : null}
                {e.zone ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Zone:</Text>
                    <Text style={styles.infoValue}>{e.zone}</Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Reason:</Text>
                  <Text style={styles.infoValue}>{reasonLabel(e.inactiveReason)}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate('EmployeeEdit', { id: e._id })}
                  disabled={busyId === e._id}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.reactivateButton, busyId === e._id && styles.buttonDisabled]}
                  onPress={() => reactivate(e._id, e.name)}
                  disabled={busyId === e._id}
                >
                  <Text style={styles.reactivateButtonText}>
                    {busyId === e._id ? 'Working…' : 'Reactivate'}
                  </Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  employeeName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  roleBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { ...typography.label.small },
  cardBody: { gap: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { ...typography.body.small, color: colors.textSecondary },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1, textAlign: 'right' },
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
  reactivateButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary,
  },
  reactivateButtonText: {
    ...typography.label.medium,
    color: colors.textLight,
  },
  buttonDisabled: { opacity: 0.6 },
});
