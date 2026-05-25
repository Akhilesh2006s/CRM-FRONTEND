import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

export default function DCManagerScreen({ navigation }: any) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/dc/stats/employee');
      setStats(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading stats...</Text>
      </View>
    );
  }

  return (
    <ScreenShell
      title="Manager DC Dashboard"
      loading={loading}
    >
<ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {stats && (
          <>
            <View style={styles.statsGrid}>
              <TouchableOpacity
                style={[styles.statCard, styles.statCardPending]}
                onPress={() => navigation.navigate('DCPending')}
              >
                <Text style={styles.statLabel}>Pending DC</Text>
                <Text style={[styles.statValue, styles.statValuePending]}>
                  {stats.byStatus?.Pending || 0}
                </Text>
                <Text style={styles.statSubtext}>Awaiting Review</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, styles.statCardEmployee]}
                onPress={() => navigation.navigate('DCList', { type: 'employee' })}
              >
                <Text style={styles.statLabel}>Delivery Pending</Text>
                <Text style={[styles.statValue, styles.statValueEmployee]}>
                  {stats.byStatus?.Employee || 0}
                </Text>
                <Text style={styles.statSubtext}>Awaiting Approval</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, styles.statCardCompleted]}
                onPress={() => navigation.navigate('DCList', { type: 'completed' })}
              >
                <Text style={styles.statLabel}>Completed</Text>
                <Text style={[styles.statValue, styles.statValueCompleted]}>
                  {stats.byStatus?.Completed || 0}
                </Text>
                <Text style={styles.statSubtext}>Successfully Delivered</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statCard, styles.statCardHold]}
                onPress={() => navigation.navigate('DCList', { type: 'hold' })}
              >
                <Text style={styles.statLabel}>On Hold</Text>
                <Text style={[styles.statValue, styles.statValueHold]}>
                  {stats.byStatus?.Hold || 0}
                </Text>
                <Text style={styles.statSubtext}>Requires Attention</Text>
              </TouchableOpacity>

              <View style={[styles.statCard, styles.statCardTotal]}>
                <Text style={styles.statLabel}>Total DC</Text>
                <Text style={[styles.statValue, styles.statValueTotal]}>
                  {stats.total || 0}
                </Text>
                <Text style={styles.statSubtext}>All DCs</Text>
              </View>
            </View>

            <View style={styles.actionsCard}>
              <Text style={styles.actionsTitle}>Quick Actions</Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('DCClosed')}
              >
                <Text style={styles.actionButtonText}>View Closed Sales</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => navigation.navigate('DCPending')}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                  Review Pending DCs
                </Text>
              </TouchableOpacity>
            </View>
          </>
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
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, marginBottom: 4 },
  headerSubtitle: { ...typography.body.small, color: colors.textLight + 'CC' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  statCardPending: { borderLeftWidth: 4, borderLeftColor: '#3B82F6' },
  statCardEmployee: { borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  statCardCompleted: { borderLeftWidth: 4, borderLeftColor: '#10B981' },
  statCardHold: { borderLeftWidth: 4, borderLeftColor: '#EF4444' },
  statCardTotal: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  statLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  statValue: { ...typography.heading.h1, marginBottom: 4 },
  statValuePending: { color: '#3B82F6' },
  statValueEmployee: { color: '#F59E0B' },
  statValueCompleted: { color: '#10B981' },
  statValueHold: { color: '#EF4444' },
  statValueTotal: { color: colors.primary },
  statSubtext: { ...typography.body.small, color: colors.textSecondary },
  actionsCard: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  actionsTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 16 },
  actionButton: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' },
  actionButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionButtonText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  actionButtonTextPrimary: { color: colors.textLight },
});


