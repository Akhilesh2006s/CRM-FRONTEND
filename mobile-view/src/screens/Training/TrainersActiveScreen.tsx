import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

export default function TrainersActiveScreen({ navigation }: any) {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/trainers?status=active');
      setTrainers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load active trainers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <ScreenShell
      title="Active Trainers"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {trainers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👨‍🏫</Text>
            <Text style={styles.emptyText}>No active trainers found</Text>
          </View>
        ) : (
          trainers.map((trainer) => (
            <View key={trainer._id} style={styles.card}>
              <Text style={styles.trainerName}>{trainer.name || 'Trainer'}</Text>
              <Text style={styles.trainerEmail}>{trainer.email || '-'}</Text>
              {trainer.mobile && <Text style={styles.trainerMobile}>Mobile: {trainer.mobile}</Text>}
              {trainer.zone && <Text style={styles.trainerMeta}>Zone: {trainer.zone}</Text>}
              {trainer.trainerType && <Text style={styles.trainerMeta}>Type: {trainer.trainerType}</Text>}
              {(trainer.trainerProducts || []).length > 0 && (
                <Text style={styles.trainerMeta}>Products: {(trainer.trainerProducts || []).join(', ')}</Text>
              )}
              {(trainer.trainerAbacusLevels || trainer.trainerVedicLevels || trainer.trainerLevels) && (
                <Text style={styles.trainerMeta}>
                  Levels:{' '}
                  {[
                    trainer.trainerAbacusLevels ? `Abacus: ${trainer.trainerAbacusLevels}` : '',
                    trainer.trainerVedicLevels ? `Vedic: ${trainer.trainerVedicLevels}` : '',
                    trainer.trainerLevels || '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => navigation.navigate('TrainersEdit', { id: trainer._id })}
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
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  addIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { ...typography.heading.h3, color: colors.textSecondary },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  trainerName: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 8 },
  trainerEmail: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 4 },
  trainerMobile: { ...typography.body.medium, color: colors.textSecondary },
  trainerMeta: { ...typography.body.small, color: colors.textSecondary, marginTop: 4 },
  editButton: { marginTop: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center' },
  editButtonText: { ...typography.label.medium, color: colors.textLight, fontWeight: '600' },
});


