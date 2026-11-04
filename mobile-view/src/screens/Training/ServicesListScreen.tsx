import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Linking } from 'react-native';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { rk, matchesWords } from '../Reports/ReportKit';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { apiService, getApiUrl } from '../../services/api';

import DateField from '../../ui/DateField';
type Service = {
  _id: string;
  schoolCode?: string;
  schoolName?: string;
  zone?: string;
  town?: string;
  subject?: string;
  trainerId?: { _id: string; name?: string };
  employeeId?: { _id: string; name?: string };
  serviceDate?: string;
  term?: string;
  remarks?: string;
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

export default function ServicesListScreen({ navigation }: any) {
  const [items, setItems] = useState<Service[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [trainers, setTrainers] = useState<{ _id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
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
      // keep empty meta lists
    }
  }, []);

  const loadServices = useCallback(async (filters: Filters) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
      });
      const qs = params.toString();
      const data = await apiService.get(`/services${qs ? `?${qs}` : ''}`);
      setItems(Array.isArray(data) ? data : (data as any)?.data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load services');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
    loadServices(appliedFilters);
  }, [loadMeta, loadServices, appliedFilters]);

  const onSearch = () => {
    setAppliedFilters({ ...draftFilters });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMeta();
    loadServices(appliedFilters);
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

  const shown = items.filter((s) =>
    matchesWords(search, [
      s.schoolName,
      s.schoolCode,
      s.zone,
      s.town,
      s.subject,
      s.term,
      s.remarks,
      s.trainerId?.name,
      s.employeeId?.name,
      s.status || 'Scheduled',
      formatDate(s.serviceDate),
    ])
  );

  return (
    <ScreenShell
      title="Services List"
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
        <PageSection title="Filters">
          <WebInput placeholder="Search school, code, zone, subject, trainer, remarks…" value={search} onChangeText={setSearch} />
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
          <WebButton title="Search" onPress={onSearch} />
        </PageSection>

        <SectionTitle>{`Services (${shown.length})`}</SectionTitle>

        {shown.length === 0 ? (
          <EmptyState title="No services found" />
        ) : (
          shown.map((s, idx) => {
            const docUrl = s.feedbackPdfUrl || s.poImageUrl;
            return (
              <Card key={s._id}>
                <CardTitle
                  title={`${idx + 1}. ${s.schoolName || 'Unnamed School'}`}
                  subtitle={s.schoolCode || undefined}
                  badge={s.status || 'Scheduled'}
                  tone={toneFor(s.status === 'Scheduled' || !s.status ? 'pending' : s.status)}
                />
                <InfoRow label="Service date" value={formatDate(s.serviceDate)} bold />
                <InfoRow label="Subject" value={s.subject || '-'} />
                <InfoRow label="Term" value={s.term || '-'} />
                <InfoRow label="Trainer" value={s.trainerId?.name || '-'} />
                <InfoRow label="Zone" value={s.zone || '-'} />
                <InfoRow label="Town" value={s.town || '-'} />
                <InfoRow label="Remarks" value={s.remarks || '-'} />
                <InfoRow label="PO Image" value={docUrl ? 'Available' : '-'} />

                <ActionRow>
                  {docUrl ? <WebButton title="View" variant="outline" onPress={() => openPoImage(docUrl)} /> : null}
                  <WebButton title="Edit" variant="outline" onPress={() => navigation.navigate('ServiceEdit', { id: s._id })} />
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
});
