import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, EmptyState, toneFor } from '../../ui/Kit';
import { confirmLogout } from '../../utils/confirmLogout';

interface DCItem {
  _id: string;
  dcOrderId?: {
    school_name: string;
    dc_code: string;
    location: string;
  };
  customerName: string;
  status: string;
  product: string;
  createdAt: string;
}

export default function DCListScreen({ navigation, route }: any) {
  const { user, logout } = useAuth();
  const [dcs, setDcs] = useState<DCItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const type = route.params?.type || 'sales';
  const isExecutiveMyDC = user?.role === 'Executive' && type === 'sales';

  const handleLogout = () => {
    confirmLogout(logout);
  };

  useEffect(() => {
    loadDCs();
  }, []);

  const loadDCs = async () => {
    try {
      setLoading(true);
      // The endpoint uses req.user._id from auth token, no need to pass employeeId
      const data = await apiService.get('/dc/employee/my');
      setDcs(data || []);
    } catch (error: any) {
      console.error('Error loading DCs:', error);
      setDcs([]); // Set empty array on error so user can see empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDCs();
  };

  const renderDCItem = (item: DCItem) => {
    const code = item.dcOrderId?.dc_code || item._id?.slice(-8) || '—';
    const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    if (isExecutiveMyDC) {
      return (
        <Card key={item._id}>
          <CardTitle title={code} badge={item.status || '—'} tone={toneFor(item.status)} />
          <InfoRow label="Product" value={item.product} />
          <InfoRow label="Date" value={dateStr} />
        </Card>
      );
    }

    const schoolName = item.dcOrderId?.school_name || item.customerName;
    const schoolCode = item.dcOrderId?.dc_code || '';
    const location = item.dcOrderId?.location || '';

    return (
      <Card key={item._id} onPress={() => navigation.navigate('DCCapture', { dcId: item._id, dc: item })}>
        <CardTitle title={schoolName || '—'} subtitle={schoolCode ? `Code: ${schoolCode}` : undefined} badge={item.status} tone={toneFor(item.status)} />
        <InfoRow label="Location" value={location} />
        <InfoRow label="Product" value={item.product} />
        <InfoRow label="Date" value={dateStr} />
      </Card>
    );
  };

  return (
    <ScreenShell
      title={type === 'training' ? 'Training DCs' : 'Sales DCs'}
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      headerRight={
        <View style={styles.headerRight}>
          {!isExecutiveMyDC && (
            <TouchableOpacity onPress={() => navigation.navigate('DCCapture')} hitSlop={8}>
              <Text style={styles.addButton}>+ New</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      }
    >
      {dcs.length === 0 ? <EmptyState title="No DCs found" message="Pull down to refresh." /> : dcs.map(renderDCItem)}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  addButton: { fontSize: 15, fontWeight: '700', color: colors.primaryDark },
});
