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
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { rk, matchesWords } from '../Reports/ReportKit';
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
  const [search, setSearch] = useState('');

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

  const shown = items.filter((item) =>
    matchesWords(search, [
      item.subject,
      item.schoolName,
      item.schoolCode,
      item.zone,
      item.town,
      item.trainerId?.name,
      item.employeeId?.name,
      item.status || 'Completed',
      formatDate(activeTab === 'training' ? item.trainingDate : item.serviceDate),
      formatDate(item.completionDate),
    ])
  );

  return (
    <ScreenShell
      title="Completed Training & Services"
      subtitle="Closure and proof: upload the feedback PDF for each completed item."
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

        <PageSection title="Filters">
          <WebInput placeholder="Search subject, school, code, zone, trainer…" value={search} onChangeText={setSearch} />
          <View style={rk.row2}>
            <View style={rk.col}>
              <WebSelect
                label="Zone"
                placeholder="All Zones"
                value={draftFilters.zone}
                onValueChange={(v) => setDraftFilters((f) => ({ ...f, zone: v }))}
                items={zones.map((z) => ({ label: z, value: z }))}
              />
            </View>
            <View style={rk.col}>
              <WebSelect
                label="Trainer"
                placeholder="All Trainers"
                value={draftFilters.trainerId}
                onValueChange={(v) => setDraftFilters((f) => ({ ...f, trainerId: v }))}
                items={trainers.map((t) => ({ label: t.name, value: t._id }))}
                disabled={isTrainer}
              />
            </View>
          </View>
          <WebSelect
            label="Employee"
            placeholder="All Employees"
            value={draftFilters.employeeId}
            onValueChange={(v) => setDraftFilters((f) => ({ ...f, employeeId: v }))}
            items={employees.map((e) => ({ label: e.name, value: e._id }))}
          />
          <DateField placeholder="From date" value={draftFilters.fromDate} onChange={(v) => setDraftFilters((f) => ({ ...f, fromDate: v }))} />
          <DateField placeholder="To date" value={draftFilters.toDate} onChange={(v) => setDraftFilters((f) => ({ ...f, toDate: v }))} />
          <View style={rk.btnRow}>
            <View style={rk.col}>
              <WebButton title="Search" onPress={onSearch} />
            </View>
            <View style={rk.col}>
              <WebButton
                title="Clear"
                variant="outline"
                onPress={() => {
                  setSearch('');
                  onClear();
                }}
              />
            </View>
          </View>
        </PageSection>

        {shown.length === 0 ? (
          <EmptyState title={activeTab === 'training' ? 'No completed trainings' : 'No completed services'} />
        ) : (
          shown.map((item) => {
            const startDate =
              activeTab === 'training' ? item.trainingDate : item.serviceDate;
            const clientLabel = item.schoolCode
              ? `${item.schoolName || '-'} (${item.schoolCode})`
              : item.schoolName || '-';
            return (
              <Card key={item._id}>
                <CardTitle title={item.subject || '-'} badge={item.status || 'Completed'} tone="success" />
                <InfoRow label={activeTab === 'training' ? 'Training' : 'Service'} value={item.subject || '-'} />
                <InfoRow label="Client" value={clientLabel} />
                <InfoRow label="Zone" value={item.zone || '-'} />
                <InfoRow label="Trainer" value={item.trainerId?.name || '-'} />
                <InfoRow label="Starting date" value={formatDate(startDate)} />
                <InfoRow label="Completed on" value={formatDate(item.completionDate)} />

                <ActionRow>
                  {!item.feedbackPdfUrl ? (
                    <WebButton
                      title={uploadingId === item._id ? 'Uploading...' : 'Upload Feedback PDF'}
                      variant="outline"
                      disabled={uploadingId === item._id}
                      onPress={() => uploadFeedback(item._id, activeTab)}
                    />
                  ) : (
                    <WebButton title="View Uploaded File" variant="outline" onPress={() => viewFeedback(item.feedbackPdfUrl)} />
                  )}
                </ActionRow>
              </Card>
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
  tabs: { flexDirection: 'row', backgroundColor: colors.backgroundMuted, borderRadius: 12, padding: 4, gap: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, fontWeight: '500', color: colors.textTertiary, textAlign: 'center' },
  tabTextActive: { color: colors.textPrimary, fontWeight: '700' },
});
