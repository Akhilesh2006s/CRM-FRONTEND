import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
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
    <ScreenShell title="Active Trainers" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      {trainers.length === 0 ? (
        <EmptyState icon="👨‍🏫" title="No active trainers found" />
      ) : (
        trainers.map((trainer) => {
          const levels = [
            trainer.trainerAbacusLevels ? `Abacus: ${trainer.trainerAbacusLevels}` : '',
            trainer.trainerVedicLevels ? `Vedic: ${trainer.trainerVedicLevels}` : '',
            trainer.trainerLevels || '',
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Card key={trainer._id}>
              <CardTitle title={trainer.name || 'Trainer'} subtitle={trainer.email || undefined} badge="Active" tone="success" />
              <InfoRow label="Mobile" value={trainer.mobile} phone />
              <InfoRow label="Zone" value={trainer.zone} />
              <InfoRow label="Type" value={trainer.trainerType} />
              <InfoRow label="Products" value={(trainer.trainerProducts || []).join(', ')} />
              <InfoRow label="Levels" value={levels} />
              <ActionRow>
                <WebButton title="Edit" variant="outline" onPress={() => navigation.navigate('TrainersEdit', { id: trainer._id })} />
              </ActionRow>
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}
