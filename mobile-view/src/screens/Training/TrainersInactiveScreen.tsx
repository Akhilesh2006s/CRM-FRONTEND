import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState } from '../../ui/Kit';
import { apiService } from '../../services/api';

export default function TrainersInactiveScreen({ navigation }: any) {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiService.get('/trainers?status=inactive');
      setTrainers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load inactive trainers');
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
    <ScreenShell title="Inactive Trainers" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      {trainers.length === 0 ? (
        <EmptyState icon="👨‍🏫" title="No inactive trainers found" />
      ) : (
        trainers.map((trainer) => (
          <Card key={trainer._id}>
            <CardTitle title={trainer.name || 'Trainer'} subtitle={trainer.email || undefined} badge="Inactive" tone="neutral" />
            <InfoRow label="Mobile" value={trainer.mobile} phone />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}
