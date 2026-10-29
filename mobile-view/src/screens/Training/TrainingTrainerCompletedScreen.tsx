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
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

import DateField from '../../ui/DateField';
type CompletedItem = {
  _id: string;
  schoolName?: string;
  schoolCode?: string;
  subject?: string;
  zone?: string;
  town?: string;
  trainingDate?: string;
  serviceDate?: string;
  completionDate?: string;
  status?: string;
  feedbackPdfUrl?: string;
  trainerId?: { _id: string; name?: string };
  employeeId?: { _id: string; name?: string };
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

const EMPTY_FILTERS: Filters = {
  zone: '',
  employeeId: '',
  trainerId: '',
  schoolCode: '',
  schoolName: '',
  fromDate: '',
  toDate: '',
};

function getUploadsBaseUrl(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

function buildPdfUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  const base = getUploadsBaseUrl();
  let path: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const match = trimmed.match(/^https?:\/\/[^/]+(\/.*)?$/);
    path = match && match[1] ? match[1] : `/${trimmed.split('/').pop() || 'file'}`;
    if (!path.startsWith('/')) path = `/${path}`;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/ /g, '-');
  } catch {
    return '-';
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function TrainingTrainerCompletedScreen({ navigation }: any) {
  const { user } = useAuth();
  const isTrainer = user?.role === 'Trainer';

  const [activeTab, setActiveTab] = useState<'training' | 'service'>('training');
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [trainers, setTrainers] = useState<{ _id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

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
      // optional filters
    }
  }, []);

  const loadData = useCallback(async (filters: Filters, tab: 'training' | 'service') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: 'Completed' });
      if (isTrainer && user?._id) {
        params.append('trainerId', user._id);
      }
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;
        if (isTrainer && key === 'trainerId') return;
        params.append(key, value);
      });

      const endpoint = tab === 'training' ? '/training' : '/services';
      const data = await apiService.get(`${endpoint}?${params.toString()}`);
      const list = Array.isArray(data) ? data : (data as any)?.data || [];
      setItems(list.filter((row: CompletedItem) => row.status === 'Completed'));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load data');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isTrainer, user?._id]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadData(appliedFilters, activeTab);
  }, [loadData, appliedFilters, activeTab]);

  const onSearch = () => setAppliedFilters({ ...draftFilters });

  const onClear = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMeta();
    loadData(appliedFilters, activeTab);
  };

  const viewFeedback = (url?: string) => {
    const resolved = buildPdfUrl(url);
    if (!resolved) {
      Alert.alert('Error', 'Feedback file URL is invalid');
      return;
    }
    Linking.openURL(resolved).catch(() => Alert.alert('Error', 'Could not open feedback file'));
  };

  const uploadFeedback = async (id: string, type: 'training' | 'service') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const name = (file.name || '').toLowerCase();
      const mime = (file.mimeType || '').toLowerCase();
      const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
      const isImage =
        mime.startsWith('image/') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.png');
      if (!isPdf && !isImage) {
        Alert.alert('Error', 'Please upload a PDF or image (JPG/PNG)');
        return;
      }

      setUploadingId(id);
      const formData = new FormData();
      const uploadName =
        file.name ||
        (isPdf ? 'feedback.pdf' : name.endsWith('.png') ? 'feedback.png' : 'feedback.jpg');
      const uploadType =
        mime ||
        (isPdf
          ? 'application/pdf'
          : uploadName.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg');
      formData.append('feedback', {
        uri: file.uri,
        type: uploadType,
        name: uploadName,
      } as any);

      const endpoint =
        type === 'training'
          ? `/training/${id}/upload-feedback`
          : `/services/${id}/upload-feedback`;
      const res = await apiService.upload(endpoint, formData);
      Alert.alert(
        'Success',
        (res as any)?.convertedFromImage
          ? 'Image converted to PDF and uploaded'
          : 'Feedback uploaded successfully',
      );
      loadData(appliedFilters, activeTab);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to upload feedback');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <ScreenShell
      title="Completed Training & Services (Closure + proof)"
      subtitle="Audit and documentation after delivery. Upload feedback PDF for completed trainings and services."
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
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'training' && styles.tabActive]}
            onPress={() => setActiveTab('training')}
          >
            <Text style={[styles.tabText, activeTab === 'training' && styles.tabTextActive]}>
              Completed Trainings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'service' && styles.tabActive]}
            onPress={() => setActiveTab('service')}
          >
            <Text style={[styles.tabText, activeTab === 'service' && styles.tabTextActive]}>
              Completed Services
            </Text>
          </TouchableOpacity>
        </View>

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
            disabled={isTrainer}
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
          <View style={styles.filterActions}>
            <View style={styles.searchWrap}>
              <WebButton title="Search" onPress={onSearch} />
            </View>
            <View style={styles.clearWrap}>
              <WebButton title="Clear" variant="outline" onPress={onClear} />
            </View>
          </View>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {activeTab === 'training' ? 'No completed trainings' : 'No completed services'}
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const startDate =
              activeTab === 'training' ? item.trainingDate : item.serviceDate;
            const clientLabel = item.schoolCode
              ? `${item.schoolName || '-'} (${item.schoolCode})`
              : item.schoolName || '-';
            return (
              <View key={item._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.subject}>{item.subject || '-'}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{item.status || 'Completed'}</Text>
                  </View>
                </View>
                <InfoRow
                  label={activeTab === 'training' ? 'Training' : 'Service'}
                  value={item.subject || '-'}
                />
                <InfoRow label="Client" value={clientLabel} />
                <InfoRow label="Zone" value={item.zone || '-'} />
                <InfoRow label="Trainer" value={item.trainerId?.name || '-'} />
                <InfoRow label="Starting Date" value={formatDate(startDate)} />
                <InfoRow label="Completion Date" value={formatDate(item.completionDate)} />

                <View style={styles.actions}>
                  {!item.feedbackPdfUrl ? (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      disabled={uploadingId === item._id}
                      onPress={() => uploadFeedback(item._id, activeTab)}
                    >
                      <Ionicons name="cloud-upload-outline" size={16} color="#0F172A" />
                      <Text style={styles.actionBtnText}>
                        {uploadingId === item._id ? 'Uploading...' : 'Upload Feedback PDF'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => viewFeedback(item.feedbackPdfUrl)}
                    >
                      <Ionicons name="eye-outline" size={16} color="#0F172A" />
                      <Text style={styles.actionBtnText}>View Uploaded File</Text>
                    </TouchableOpacity>
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563EB',
  },
  tabText: {
    ...typography.body.medium,
    color: '#64748B',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  searchWrap: { flex: 1 },
  clearWrap: { width: 100 },
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
  subject: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  infoLabel: {
    width: 120,
    ...typography.body.small,
    color: colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    ...typography.body.medium,
    color: colors.textPrimary,
  },
  actions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  actionBtnText: {
    color: '#0F172A',
    fontWeight: '600',
    fontSize: 13,
  },
});
