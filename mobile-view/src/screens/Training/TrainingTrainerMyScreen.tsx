import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ChipRow, EmptyState, toneFor } from '../../ui/Kit';
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
    <ScreenShell title="My Trainings & Services" loading={loading && !refreshing} refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ marginTop: -12, marginBottom: 12 }}>
        <ChipRow
          items={[
            { key: 'training', label: 'Trainings' },
            { key: 'service', label: 'Services' },
          ]}
          value={activeTab}
          onChange={(k) => setActiveTab(k as 'training' | 'service')}
        />
      </View>
      {items.length === 0 ? (
        <EmptyState icon="🎓" title={`No ${activeTab === 'training' ? 'trainings' : 'services'} found`} />
      ) : (
        items.map((item) => (
          <Card key={item._id}>
            <CardTitle title={item.schoolName || item.school_name || '-'} badge={item.status} tone={toneFor(item.status)} />
            <InfoRow label="Subject" value={item.subject} />
            <InfoRow
              label="Date"
              value={
                item[dateKey]
                  ? new Date(item[dateKey]).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '-'
              }
            />
          </Card>
        ))
      )}
    </ScreenShell>
  );
}
