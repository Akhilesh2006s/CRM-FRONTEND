import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

export default function TrainingTrainerMyScreen({ navigation }: any) {
  const [trainings, setTrainings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'training' | 'service'>('training');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'training') {
        const data = await apiService.get('/training/trainer/my');
        setTrainings(Array.isArray(data) ? data : []);
      } else {
        const data = await apiService.get('/services/trainer/my');
        setServices(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const items = activeTab === 'training' ? trainings : services;
  const dateKey = activeTab === 'training' ? 'trainingDate' : 'serviceDate';

  return (
    <ScreenShell
      title="My Trainings & Services"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'training' && styles.tabActive]}
          onPress={() => setActiveTab('training')}
        >
          <Text style={[styles.tabText, activeTab === 'training' && styles.tabTextActive]}>Trainings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'service' && styles.tabActive]}
          onPress={() => setActiveTab('service')}
        >
          <Text style={[styles.tabText, activeTab === 'service' && styles.tabTextActive]}>Services</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎓</Text>
            <Text style={styles.emptyText}>No {activeTab === 'training' ? 'trainings' : 'services'} found</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item._id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.schoolName || item.school_name || '-'}</Text>
              <Text style={styles.cardSubtitle}>{item.subject || item.subject || '-'}</Text>
              <Text style={styles.cardDate}>
                {item[dateKey] ? new Date(item[dateKey]).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  tabContainer: { flexDirection: 'row', padding: 16, gap: 8 },
  tab: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.backgroundLight, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.body.medium, color: colors.textSecondary },
  tabTextActive: { color: colors.textLight, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { ...typography.body.small, color: colors.textSecondary },
  cardDate: { ...typography.body.small, color: colors.primary, marginTop: 8 },
});
