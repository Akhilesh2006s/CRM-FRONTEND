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
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import LogoutButton from '../../components/LogoutButton';
import { useAuth } from '../../context/AuthContext';

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

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = !searchTerm || 
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
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
    <View style={styles.container}>
      <LinearGradient colors={gradients.primary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Assign Areas</Text>
            <Text style={styles.headerSubtitle}>Assign areas to executives</Text>
          </View>
          <LogoutButton />
        </View>
      </LinearGradient>

      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search employees..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cityFilter}>
          <TouchableOpacity
            style={[styles.filterChip, !cityFilter && styles.filterChipActive]}
            onPress={() => setCityFilter('')}
          >
            <Text style={[styles.filterChipText, !cityFilter && styles.filterChipTextActive]}>All Cities</Text>
          </TouchableOpacity>
          {cities.map((city) => (
            <TouchableOpacity
              key={city}
              style={[styles.filterChip, cityFilter === city && styles.filterChipActive]}
              onPress={() => setCityFilter(city)}
            >
              <Text style={[styles.filterChipText, cityFilter === city && styles.filterChipTextActive]}>{city}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {filteredEmployees.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No employees found</Text>
          </View>
        ) : (
          filteredEmployees.map((employee) => (
            <TouchableOpacity
              key={employee._id}
              style={styles.employeeCard}
              onPress={() => openAssignModal(employee)}
            >
              <View style={styles.employeeInfo}>
                <Text style={styles.employeeName}>{employee.name}</Text>
                <Text style={styles.employeeEmail}>{employee.email}</Text>
                <View style={styles.employeeLocation}>
                  <Text style={styles.locationLabel}>City: </Text>
                  <Text style={styles.locationValue}>{employee.assignedCity || 'Not assigned'}</Text>
                </View>
                <View style={styles.employeeLocation}>
                  <Text style={styles.locationLabel}>Area: </Text>
                  <Text style={styles.locationValue}>{employee.assignedArea || 'Not assigned'}</Text>
                </View>
              </View>
              <Text style={styles.assignButton}>Assign →</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

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
              <Text style={styles.modalLabel}>Employee: {selectedEmployee?.name}</Text>
              <Text style={styles.modalLabel}>City: {selectedEmployee?.assignedCity}</Text>
              <Text style={styles.modalLabel}>Area *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter area name"
                value={area}
                onChangeText={setArea}
              />
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowAssignModal(false)}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleAssignArea}
                disabled={assigning || !area.trim()}
              >
                {assigning ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={styles.modalButtonTextSubmit}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, marginBottom: 4 },
  headerSubtitle: { ...typography.body.small, color: colors.textLight + 'CC' },
  placeholder: { width: 40 },
  filtersContainer: { padding: 16, backgroundColor: colors.backgroundLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  cityFilter: { flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.background, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.body.small, color: colors.textPrimary },
  filterChipTextActive: { color: colors.textLight },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  emptyContainer: { padding: 20, alignItems: 'center' },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  employeeCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  employeeInfo: { flex: 1 },
  employeeName: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 4 },
  employeeEmail: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  employeeLocation: { flexDirection: 'row', marginBottom: 4 },
  locationLabel: { ...typography.body.small, color: colors.textSecondary },
  locationValue: { ...typography.body.small, color: colors.textPrimary, fontWeight: '500' },
  assignButton: { ...typography.body.medium, color: colors.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalBody: { padding: 20 },
  modalLabel: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  modalFooter: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
  modalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modalButtonSubmit: { backgroundColor: colors.primary },
  modalButtonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  modalButtonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});


