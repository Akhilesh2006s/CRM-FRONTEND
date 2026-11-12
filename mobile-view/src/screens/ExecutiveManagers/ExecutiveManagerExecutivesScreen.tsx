import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, SectionTitle } from '../../ui/Kit';

type Executive = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  empCode?: string;
  department?: string;
  assignedCity?: string;
  assignedArea?: string;
  assignedState?: string;
  assignedDistrict?: string;
  isActive: boolean;
  createdAt?: string;
};

function formatJoined(dateString?: string) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ExecutiveManagerExecutivesScreen() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const data = await apiService.get('/executive-managers/my/executives');
      setExecutives(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setExecutives([]);
      Alert.alert('Error', e?.message || 'Failed to load executives');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** Every typed word must appear in one of the visible fields. */
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = words.length
    ? executives.filter((e) => {
        const text = [
          e.name, e.email, e.phone, e.mobile, e.empCode, e.department,
          e.assignedState, e.assignedCity, e.assignedArea, e.assignedDistrict,
          e.isActive ? 'active' : 'inactive',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((w) => text.includes(w));
      })
    : executives;

  return (
    <ScreenShell
      title="BDEs"
      subtitle="BDEs assigned to you"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {executives.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No executives assigned to you"
          message="Contact Super Admin to assign executives to your account."
        />
      ) : (
        <>
          <WebInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, code, mobile, email, city…"
          />
          <SectionTitle>{`Executives (${shown.length})`}</SectionTitle>
          {shown.length === 0 ? (
            <EmptyState icon="🔍" title="No matching executives" message="Try different search words." />
          ) : (
            shown.map((item) => (
              <Card key={item._id}>
                <CardTitle
                  title={item.name || '—'}
                  subtitle={item.empCode || undefined}
                  badge={item.isActive ? 'Active' : 'Inactive'}
                  tone={item.isActive ? 'success' : 'error'}
                />
                <InfoRow label="Email" value={item.email || ''} />
                <InfoRow label="Phone" value={item.phone || ''} phone />
                <InfoRow label="Mobile" value={item.mobile || ''} phone />
                <InfoRow label="Department" value={item.department || ''} />
                <InfoRow label="State" value={item.assignedState || ''} />
                <InfoRow label="City" value={item.assignedCity || ''} />
                <InfoRow label="Area" value={item.assignedArea || ''} />
                <InfoRow label="District" value={item.assignedDistrict || ''} />
                <InfoRow label="Joined" value={formatJoined(item.createdAt)} />
              </Card>
            ))
          )}
        </>
      )}
    </ScreenShell>
  );
}
