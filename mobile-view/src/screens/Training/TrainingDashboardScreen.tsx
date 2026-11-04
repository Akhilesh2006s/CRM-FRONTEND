import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { Card } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { StatGrid } from '../Reports/ReportKit';

export default function TrainingDashboardScreen({ navigation }: any) {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scheduled, completed, cancelled] = await Promise.all([
        apiService.get('/training?status=Scheduled').catch(() => []),
        apiService.get('/training?status=Completed').catch(() => []),
        apiService.get('/training?status=Cancelled').catch(() => []),
      ]);
      setStats({
        scheduled: Array.isArray(scheduled) ? scheduled.length : 0,
        completed: Array.isArray(completed) ? completed.length : 0,
        cancelled: Array.isArray(cancelled) ? cancelled.length : 0,
        total: (Array.isArray(scheduled) ? scheduled.length : 0) + (Array.isArray(completed) ? completed.length : 0) + (Array.isArray(cancelled) ? cancelled.length : 0),
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load training dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const links = [
    { title: 'View All Trainings', subtitle: 'See complete training list', route: 'TrainingList', icon: 'list-outline' as const },
    { title: 'Assign New Training', subtitle: 'Schedule a new training', route: 'TrainingAssign', icon: 'add-circle-outline' as const },
  ];

  return (
    <ScreenShell title="Training Dashboard" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      <StatGrid
        items={[
          { label: 'Total Trainings', value: stats.total || 0, tone: 'slate' },
          { label: 'Scheduled', value: stats.scheduled || 0, tone: 'blue' },
          { label: 'Completed', value: stats.completed || 0, tone: 'green' },
          { label: 'Cancelled', value: stats.cancelled || 0, tone: 'red' },
        ]}
      />
      {links.map((l) => (
        <Card key={l.route} onPress={() => navigation.navigate(l.route)}>
          <View style={styles.row}>
            <View style={styles.iconBox}>
              <Ionicons name={l.icon} size={22} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{l.title}</Text>
              <Text style={styles.subtitle}>{l.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </View>
        </Card>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
});
