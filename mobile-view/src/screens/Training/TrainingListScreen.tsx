import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';

import DateField from '../../ui/DateField';
type Training = {
  _id: string;
  schoolCode?: string;
  schoolName?: string;
  zone?: string;
  town?: string;
  subject?: string;
  trainerId?: { _id: string; name?: string };
  employeeId?: { _id: string; name?: string };
  trainingDate?: string;
  status?: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  poImageUrl?: string;
  feedbackPdfUrl?: string;
};

type Filters = {
  zone: string;
  employeeId: string;
  trainerId: string;
  schoolCode: string;
  schoolName: string;
  fromDate: string;
  toDate: string;
};

const emptyFilters: Filters = {
  zone: '',
  employeeId: '',
  trainerId: '',
  schoolCode: '',
  schoolName: '',
  fromDate: '',
  toDate: '',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function statusStyle(status?: string) {
  switch (status) {
    case 'Completed':
      return { bg: '#DCFCE7', fg: '#15803D' };
    case 'Cancelled':
      return { bg: '#FEE2E2', fg: '#B91C1C' };
    case 'Scheduled':
      return { bg: '#FEF9C3', fg: '#A16207' };
    default:
      return { bg: '#F1F5F9', fg: '#64748B' };
  }
}

export default function TrainingListScreen({ navigation }: any) {
  const [items, setItems] = useState<Training[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [trainers, setTrainers] = useState<{ _id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);

  const loadMeta = useCallback(async () => {
    try {
      const [zData, tData, eData] = await Promise.all([
        apiService.get('/dc-orders').catch(() => []),
        apiService.get('/trainers?status=active').catch(() =>
          apiService.get('/trainers?isActive=true').catch(() => []),
        ),
        apiService.get('/employees?isActive=true').catch(() => []),
      ]);
      const orderList = Array.isArray(zData) ? zData : (zData as any)?.data || [];
      const uniqueZones = [
        ...new Set(orderList.map((d: any) => d.zone).filter(Boolean)),
      ] as string[];
      setZones(uniqueZones);
      setTrainers(Array.isArray(tData) ? tData : (tData as any)?.data || []);
      setEmployees(Array.isArray(eData) ? eData : (eData as any)?.data || []);
    } catch {
      // keep empty meta lists
    }
  }, []);

  const loadTrainings = useCallback(async (filters: Filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
      const qs = params.toString();
      const data = await apiService.get(`/training${qs ? `?${qs}` : ''}`);
      setItems(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load trainings');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
    loadTrainings(appliedFilters);
  }, [loadMeta, loadTrainings, appliedFilters]);

  const onSearch = () => {
    setAppliedFilters({ ...draftFilters });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMeta();
    loadTrainings(appliedFilters);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const resolveDocUrl = (raw?: string) => {
    if (!raw || !String(raw).trim()) return null;
    const trimmed = String(raw).trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      try {
        const u = new URL(trimmed);
        if (u.pathname.startsWith('/uploads/')) {
          return `${getApiUrl().replace(/\/api\/?$/, '')}${u.pathname}${u.search}`;
        }
      } catch (_) {
        /* use as-is */
      }
      return trimmed;
    }
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${getApiUrl().replace(/\/api\/?$/, '')}${path}`;
  };

  const openPoImage = (url?: string) => {
    const resolved = resolveDocUrl(url);
    if (!resolved) return;
    Linking.openURL(resolved).catch(() => Alert.alert('Error', 'Could not open document'));
  };

  const cancelTraining = (id: string) => {
    Alert.alert('Cancel training', 'Cancel this training?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.put(`/training/${id}/cancel`, {});
            loadTrainings(appliedFilters);
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to cancel');
          }
        },
      },
    ]);
  };

  return (
    <ScreenShell
      title="Trainings List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.filterCard}>
          <WebSelect
            placeholder="All Zones"
            value={draftFilters.zone}
            onValueChange={(v) => setDraftFilters((f) => ({ ...f, zone: v }))}
            items={zones.map((z) => ({ label: z, value: z }))}
          />
          <WebSelect
            placeholder="All Employees"
            value={draftFilters.employeeId}
            onValueChange={(v) => setDraftFilters((f) => ({ ...f, employeeId: v }))}
            items={employees.map((e) => ({ label: e.name, value: e._id }))}
          />
          <WebSelect
            placeholder="All Trainers"
            value={draftFilters.trainerId}
            onValueChange={(v) => setDraftFilters((f) => ({ ...f, trainerId: v }))}
            items={trainers.map((t) => ({ label: t.name, value: t._id }))}
          />
          <WebInput
            placeholder="By School Code"
            value={draftFilters.schoolCode}
            onChangeText={(v) => setDraftFilters((f) => ({ ...f, schoolCode: v }))}
          />
          <WebInput
            placeholder="By School Name"
            value={draftFilters.schoolName}
            onChangeText={(v) => setDraftFilters((f) => ({ ...f, schoolName: v }))}
          />
          <DateField placeholder="From date" value={draftFilters.fromDate} onChange={(v) => setDraftFilters((f) => ({ ...f, fromDate: v }))} />
          <DateField placeholder="To date" value={draftFilters.toDate} onChange={(v) => setDraftFilters((f) => ({ ...f, toDate: v }))} />
          <WebButton title="Search" onPress={onSearch} />
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No trainings found</Text>
          </View>
        ) : (
          items.map((t, idx) => {
            const badge = statusStyle(t.status);
            const docUrl = t.feedbackPdfUrl || t.poImageUrl;
            return (
              <View key={t._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.schoolName}>{t.schoolName || 'Unnamed School'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                      {t.status || 'Scheduled'}
                    </Text>
                  </View>
                </View>
                <InfoRow label="S.No" value={String(idx + 1)} />
                <InfoRow label="School Code" value={t.schoolCode || '-'} />
                <InfoRow label="Zone" value={t.zone || '-'} />
                <InfoRow label="Town" value={t.town || '-'} />
                <InfoRow label="Subject" value={t.subject || '-'} />
                <InfoRow label="Trainer" value={t.trainerId?.name || '-'} />
                <InfoRow label="Training Date" value={formatDate(t.trainingDate)} />
                <InfoRow label="PO Image" value={docUrl ? 'Available' : '-'} />

                <View style={styles.actions}>
                  {docUrl ? (
                    <TouchableOpacity style={styles.viewBtn} onPress={() => openPoImage(docUrl)}>
                      <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => navigation.navigate('TrainingEdit', { id: t._id })}
                  >
                    <Ionicons name="pencil" size={16} color="#0F172A" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  {t.status === 'Scheduled' ? (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelTraining(t._id)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.dashAction}>-</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  emptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  schoolName: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    width: 110,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
  },
  viewBtnText: { color: '#1D4ED8', fontWeight: '600', fontSize: 13 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  editBtnText: { color: '#0F172A', fontWeight: '600', fontSize: 13 },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#DC2626',
  },
  cancelBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  dashAction: { color: '#94A3B8', fontSize: 16, paddingHorizontal: 8 },
});
