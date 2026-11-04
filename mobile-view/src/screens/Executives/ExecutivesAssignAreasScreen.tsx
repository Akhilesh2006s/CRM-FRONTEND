import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { Card, CardTitle, InfoRow, ChipRow, ActionRow, EmptyState } from '../../ui/Kit';

export default function ExecutivesAssignAreasScreen({ navigation }: any) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [area, setArea] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (user?.role !== 'Executive') {
      Alert.alert('Access Denied', 'Executive role required');
      navigation.goBack();
      return;
    }
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/employees?isActive=true');
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const openAssignModal = (employee: any) => {
    setSelectedEmployee(employee);
    setArea(employee.assignedArea || '');
    setShowAssignModal(true);
  };

  const handleAssignArea = async () => {
    if (!selectedEmployee || !area.trim()) {
      Alert.alert('Error', 'Please enter an area');
      return;
    }

    setAssigning(true);
    try {
      await apiService.put('/executive-managers/assign-area', {
        employeeId: selectedEmployee._id,
        area: area.trim(),
      });
      Alert.alert('Success', `Area assigned successfully to ${selectedEmployee.name}`);
      setShowAssignModal(false);
      loadEmployees();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to assign area');
    } finally {
      setAssigning(false);
    }
  };

  const searchWords = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredEmployees = employees.filter((emp) => {
    const text = [emp.name, emp.email, emp.phone, emp.mobile, emp.role, emp.assignedCity, emp.assignedArea]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = searchWords.every((w) => text.includes(w));
    const matchesCity = !cityFilter || emp.assignedCity === cityFilter;
    return matchesSearch && matchesCity;
  });

  const cities = Array.from(new Set(employees.map((e: any) => e.assignedCity).filter(Boolean)));

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading employees...</Text>
      </View>
    );
  }

  return (
    <ScreenShell
      title="Assign Areas"
      loading={loading}
    >
      <WebInput
        placeholder="Search name, email, phone, city, area…"
        value={searchTerm}
        onChangeText={setSearchTerm}
      />
      {cities.length > 0 ? (
        <ChipRow
          items={[{ key: '', label: 'All Cities' }, ...cities.map((c) => ({ key: String(c), label: String(c) }))]}
          value={cityFilter}
          onChange={setCityFilter}
        />
      ) : null}
      <View style={{ height: 12 }} />

      {filteredEmployees.length === 0 ? (
        <EmptyState icon="👥" title="No employees found" message={searchTerm || cityFilter ? 'Try a different search or city.' : undefined} />
      ) : (
        filteredEmployees.map((employee) => (
          <Card key={employee._id}>
            <CardTitle title={employee.name || '—'} subtitle={employee.email} badge={employee.role} tone="info" />
            <InfoRow label="Phone" value={employee.phone || employee.mobile || ''} phone />
            <InfoRow label="City" value={employee.assignedCity || 'Not assigned'} />
            <InfoRow label="Area" value={employee.assignedArea || 'Not assigned'} />
            <ActionRow>
              <WebButton title={employee.assignedArea ? 'Change area' : 'Assign area'} variant="outline" onPress={() => openAssignModal(employee)} />
            </ActionRow>
          </Card>
        ))
      )}

      <Modal visible={showAssignModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Area</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <InfoRow label="Employee" value={selectedEmployee?.name || ''} />
              <InfoRow label="City" value={selectedEmployee?.assignedCity || ''} />
              <View style={{ height: 12 }} />
              <WebLabel>Area *</WebLabel>
              <WebInput placeholder="Enter area name" value={area} onChangeText={setArea} />
            </View>
            <View style={styles.modalFooter}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setShowAssignModal(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <WebButton title="Assign" onPress={handleAssignArea} disabled={assigning || !area.trim()} loading={assigning} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 14, borderTopRightRadius: 14, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalClose: { fontSize: 20, color: colors.textSecondary },
  modalBody: { padding: 16 },
  modalFooter: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
});
