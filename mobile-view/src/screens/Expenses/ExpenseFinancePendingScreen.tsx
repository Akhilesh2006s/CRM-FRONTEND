import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import LogoutButton from '../../components/LogoutButton';

interface Expense {
  _id: string;
  title: string;
  amount: number;
  approvedAmount?: number;
  category: string;
  createdAt: string;
  employeeId?: { _id: string; name: string };
  trainerId?: { _id: string; name: string };
  pendingMonth?: string;
}

interface OptionItem {
  _id: string;
  name: string;
}

export default function ExpenseFinancePendingScreen({ navigation }: any) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<OptionItem[]>([]);
  const [trainers, setTrainers] = useState<OptionItem[]>([]);
  const [filters, setFilters] = useState({ employeeId: 'all', trainerId: 'all' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFilters();
    loadData();
  }, []);

  const loadFilters = async () => {
    try {
      const [employeeData, trainerData] = await Promise.all([
        apiService.get<OptionItem[]>('/employees?isActive=true').catch(() => []),
        apiService.get<OptionItem[]>('/trainers?status=active').catch(() => []),
      ]);
      setEmployees(employeeData || []);
      setTrainers(trainerData || []);
    } catch {
      setEmployees([]);
      setTrainers([]);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.employeeId !== 'all') params.append('employeeId', filters.employeeId);
      if (filters.trainerId !== 'all') params.append('trainerId', filters.trainerId);
      const data = await apiService.get<Expense[]>(`/expenses/finance-pending${params.toString() ? `?${params.toString()}` : ''}`);
      setExpenses(Array.isArray(data) ? data : []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSearch = () => {
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

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading finance pending expenses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finance Approved Exp List</Text>
          <LogoutButton />
        </View>
      </LinearGradient>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Employee</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
            <TouchableOpacity
              style={[styles.filterChip, filters.employeeId === 'all' && styles.filterChipSelected]}
              onPress={() => setFilters((f) => ({ ...f, employeeId: 'all' }))}
            >
              <Text style={[styles.filterChipText, filters.employeeId === 'all' && styles.filterChipTextSelected]}>All</Text>
            </TouchableOpacity>
            {employees.map((emp) => (
              <TouchableOpacity
                key={emp._id}
                style={[styles.filterChip, filters.employeeId === emp._id && styles.filterChipSelected]}
                onPress={() => setFilters((f) => ({ ...f, employeeId: emp._id }))}
              >
                <Text style={[styles.filterChipText, filters.employeeId === emp._id && styles.filterChipTextSelected]}>{emp.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[styles.filterLabel, { marginTop: 12 }]}>Trainer</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
            <TouchableOpacity
              style={[styles.filterChip, filters.trainerId === 'all' && styles.filterChipSelected]}
              onPress={() => setFilters((f) => ({ ...f, trainerId: 'all' }))}
            >
              <Text style={[styles.filterChipText, filters.trainerId === 'all' && styles.filterChipTextSelected]}>All</Text>
            </TouchableOpacity>
            {trainers.map((trainer) => (
              <TouchableOpacity
                key={trainer._id}
                style={[styles.filterChip, filters.trainerId === trainer._id && styles.filterChipSelected]}
                onPress={() => setFilters((f) => ({ ...f, trainerId: trainer._id }))}
              >
                <Text style={[styles.filterChipText, filters.trainerId === trainer._id && styles.filterChipTextSelected]}>{trainer.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No finance pending expenses found</Text>
          </View>
        ) : (
          expenses.map((expense) => (
            <TouchableOpacity key={expense._id} style={styles.card} onPress={() => navigation.navigate('ExpenseEdit', { id: expense._id })} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <Text style={styles.expenseTitle}>{expense.title || 'Expense'}</Text>
                <Text style={styles.amountText}>₹{expense.amount?.toFixed(2) || '0.00'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Employee:</Text>
                <Text style={styles.infoValue}>{expense.employeeId?.name || expense.trainerId?.name || 'Unknown'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Category:</Text>
                <Text style={styles.infoValue}>{expense.category || 'General'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Raised:</Text>
                <Text style={styles.infoValue}>{formatDate(expense.createdAt)}</Text>
              </View>
              {expense.approvedAmount ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Manager Approved:</Text>
                  <Text style={styles.infoValue}>₹{expense.approvedAmount.toFixed(2)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 16 },
  filterCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  filterLabel: { ...typography.label.medium, color: colors.textPrimary },
  filterOptions: { marginTop: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, marginRight: 8, marginBottom: 8 },
  filterChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '20' },
  filterChipText: { ...typography.body.medium, color: colors.textPrimary },
  filterChipTextSelected: { color: colors.primary, fontWeight: '600' },
  searchButton: { marginTop: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  searchButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadowDark, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  expenseTitle: { ...typography.heading.h3, color: colors.textPrimary, flex: 1 },
  amountText: { ...typography.heading.h3, color: colors.primary, marginLeft: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { ...typography.body.medium, color: colors.textSecondary },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, flex: 1, marginLeft: 8, textAlign: 'right' },
});


