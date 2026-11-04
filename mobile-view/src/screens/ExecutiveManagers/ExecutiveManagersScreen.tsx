import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';

type ExecutiveManager = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  department?: string;
  employeeCount?: number;
};

type Employee = {
  _id: string;
  name: string;
  email: string;
  role: string;
  executiveManagerId?: string;
};

export default function ExecutiveManagersScreen({ navigation }: any) {
  const [managers, setManagers] = useState<ExecutiveManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ExecutiveManager | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/executive-managers');
      setManagers(Array.isArray(data) ? data : data?.data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load Executive Managers');
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

  /** Every typed word must appear in one of the visible fields. */
  const searchWords = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredManagers = managers.filter((manager) => {
    const text = [manager.name, manager.email, manager.phone, manager.mobile, manager.department]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchWords.every((w) => text.includes(w));
  });

  const openAssignDialog = async (manager: ExecutiveManager) => {
    setSelectedManager(manager);
    setSelectedEmployeeIds([]);
    setAssignOpen(true);
    setLoadingEmployees(true);
    try {
      const allEmployees = await apiService.get('/employees?isActive=true');
      const list = Array.isArray(allEmployees) ? allEmployees : allEmployees?.data || [];
      const unassigned = list.filter((emp: Employee) => {
        const isExecutive = emp.role === 'Executive' || emp.role === 'Employee';
        const notAssigned = !emp.executiveManagerId;
        const notManager =
          emp.role !== 'Executive Manager' &&
          emp.role !== 'Admin' &&
          emp.role !== 'Super Admin';
        return isExecutive && notAssigned && notManager;
      });
      setEmployees(unassigned);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAssignEmployees = async () => {
    if (!selectedManager || selectedEmployeeIds.length === 0) {
      Alert.alert('Assign Employees', 'Please select at least one employee');
      return;
    }
    setAssigning(true);
    try {
      await apiService.put(`/executive-managers/${selectedManager._id}/assign-employees`, {
        employeeIds: selectedEmployeeIds,
      });
      Alert.alert(
        'Success',
        `Successfully assigned ${selectedEmployeeIds.length} employee(s) to ${selectedManager.name}`,
      );
      setAssignOpen(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign employees');
    } finally {
      setAssigning(false);
    }
  };

  const createManagerButton = (
    <TouchableOpacity
      style={styles.createBtn}
      onPress={() => navigation.navigate('ExecutiveManagerNew')}
      activeOpacity={0.85}
    >
      <Ionicons name="add-circle-outline" size={18} color="#fff" />
      <Text style={styles.createBtnText}>Create Manager</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenShell
      title="Executive Managers"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={createManagerButton}
    >
      <WebInput
        placeholder="Search name, email, phone, department…"
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {filteredManagers.length === 0 ? (
        <>
          <EmptyState icon="👥" title="No Executive Managers found" />
          <WebButton title="Create one" variant="outline" onPress={() => navigation.navigate('ExecutiveManagerNew')} />
        </>
      ) : (
        filteredManagers.map((manager) => (
          <Card key={manager._id}>
            <CardTitle
              title={manager.name}
              subtitle={manager.department || undefined}
              badge={`${manager.employeeCount || 0} Employees`}
              tone="neutral"
            />
            <InfoRow label="Email" value={manager.email || ''} />
            <InfoRow label="Phone" value={manager.phone || manager.mobile || ''} phone />
            <ActionRow>
              <WebButton
                title="View Dashboard"
                variant="outline"
                onPress={() => navigation.navigate('ExecutiveManagerDashboard', { managerId: manager._id })}
              />
              <WebButton title="Assign Employees" variant="outline" onPress={() => openAssignDialog(manager)} />
            </ActionRow>
          </Card>
        ))
      )}

      <Modal visible={assignOpen} animationType="slide" transparent onRequestClose={() => setAssignOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Employees to {selectedManager?.name}</Text>
            <Text style={styles.modalSubtitle}>Select executives to assign to this Executive Manager</Text>

            {loadingEmployees ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
            ) : employees.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No unassigned executives available</Text>
                <View style={styles.modalEmptyActions}>
                  <WebButton title="View All Employees" variant="outline" onPress={() => {
                    setAssignOpen(false);
                    navigation.navigate('EmployeesActive');
                  }} />
                  <WebButton title="Create New Employee" variant="outline" onPress={() => {
                    setAssignOpen(false);
                    navigation.navigate('EmployeeNew');
                  }} />
                </View>
              </View>
            ) : (
              <ScrollView style={styles.employeeList} nestedScrollEnabled>
                {employees.map((employee) => {
                  const checked = selectedEmployeeIds.includes(employee._id);
                  return (
                    <TouchableOpacity
                      key={employee._id}
                      style={[styles.employeeRow, checked && styles.employeeRowChecked]}
                      onPress={() => toggleEmployee(employee._id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
                      </View>
                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>{employee.name}</Text>
                        <Text style={styles.employeeEmail}>
                          {employee.email} • {employee.role === 'Employee' ? 'Executive' : employee.role}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalActions}>
              <WebButton title="Cancel" variant="outline" onPress={() => setAssignOpen(false)} />
              <WebButton
                title={assigning ? 'Assigning…' : `Assign ${selectedEmployeeIds.length} Employee(s)`}
                onPress={handleAssignEmployees}
                disabled={assigning || selectedEmployeeIds.length === 0}
                loading={assigning}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryDark,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  createBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: colors.backgroundLight, borderRadius: 14, padding: 16, maxHeight: '85%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: colors.textTertiary, marginBottom: 12 },
  employeeList: { maxHeight: 320, marginBottom: 12 },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.backgroundLight,
  },
  employeeRowChecked: { backgroundColor: colors.accent, borderColor: colors.primaryLight },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  employeeEmail: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  modalEmpty: { alignItems: 'center', paddingVertical: 16 },
  modalEmptyText: { fontSize: 14, color: colors.textTertiary, marginBottom: 12, textAlign: 'center' },
  modalEmptyActions: { gap: 8, width: '100%' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
});
