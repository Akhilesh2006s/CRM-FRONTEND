import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

interface Employee {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  role: string;
  department?: string;
  zone?: string;
}

export default function EmployeesInactiveScreen({ navigation }: any) {
  const [items, setItems] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get<Employee[]>('/employees?isActive=false');
      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load inactive employees');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filtered = items.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.email.toLowerCase().includes(searchQuery.toLowerCase()) || (e.phone || '').includes(searchQuery));

  return (
    <ScreenShell
      title="Inactive Employees"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<View style={styles.searchContainer}>
        <WebInput style={styles.searchInput} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search name/email/phone" />
        <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
                {e.phone && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{e.phone}</Text>
                  </View>
                )}
                {e.department && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Department:</Text>
                    <Text style={styles.infoValue}>{e.department}</Text>
                  </View>
                )}
                {e.zone && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Zone:</Text>
                    <Text style={styles.infoValue}>{e.zone}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('EmployeeEdit', { id: e._id })}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
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
  searchContainer: { flexDirection: 'row', padding: 16, gap: 8, backgroundColor: colors.backgroundLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { flex: 1, ...typography.body.medium, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.textPrimary },
  refreshButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center' },
  refreshButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  employeeName: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  roleBadgeText: { ...typography.label.small, fontWeight: '600' },
  cardBody: { marginBottom: 12 },
  editButton: { paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' },
  editButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary, width: 100 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
});


