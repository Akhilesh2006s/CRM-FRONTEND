import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';

export default function ExecutiveManagersScreen({ navigation }: any) {
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/executive-managers');
      setManagers(Array.isArray(data) ? data : (data?.data || []));
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load managers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading managers...</Text>
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
          <Text style={styles.headerTitle}>Executive Managers</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {managers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👔</Text>
            <Text style={styles.emptyText}>No managers found</Text>
          </View>
        ) : (
          managers.map((manager) => (
            <TouchableOpacity key={manager._id} style={styles.card} onPress={() => navigation.navigate('ExecutiveManagerDashboard', { managerId: manager._id })} activeOpacity={0.7}>
              <Text style={styles.managerName}>{manager.name || 'Manager'}</Text>
              <Text style={styles.managerEmail}>{manager.email || '-'}</Text>
              <Text style={styles.managerRole}>Role: {manager.role || '-'}</Text>
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
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  addIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  managerName: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 8 },
  managerEmail: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 4 },
  managerRole: { ...typography.body.medium, color: colors.textSecondary },
});


