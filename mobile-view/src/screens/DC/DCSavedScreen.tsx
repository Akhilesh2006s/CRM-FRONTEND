import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, Linking, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import DateField from '../../ui/DateField';
import { SearchBar, Act, FilterRow, FilterCell, matchesWords, ui } from '../../components/dc/DcUi';
import { apiService, getApiUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  TransportDetailsSection,
  canEditTransportDetails,
  transportDetailsFromOrder,
} from '../../components/dc/TransportDetailsSection';

type DcOrder = {
  _id: string;
  school_name?: string;
  school_type?: string;
  contact_person?: string;
  contact_mobile?: string;
  address?: string;
  location?: string;
  zone?: string;
  status?: string;
  workflowStage?: string;
  products?: Array<{ product_name?: string; quantity?: number; strength?: number }>;
  assigned_to?: { _id?: string; name?: string; email?: string } | string;
  created_at?: string;
  createdAt?: string;
  pod_proof_url?: string;
  dcRequestData?: { productDetails?: any[] };
};

type LinkedDC = {
  _id: string;
  poPhotoUrl?: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
  productDetails?: any[];
};

function unwrapList(response: any): any[] {
  return Array.isArray(response) ? response : response?.data || [];
}

function getUploadsBaseUrl(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

function buildFileUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  const base = getUploadsBaseUrl();
  let path: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const match = trimmed.match(/^https?:\/\/[^/]+(\/.*)?$/);
    path = match?.[1] ? match[1] : `/${trimmed.split('/').pop() || 'file'}`;
    if (!path.startsWith('/')) path = `/${path}`;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

function pickSavedPipelineDc(dcs: LinkedDC[]): LinkedDC | null {
  if (!Array.isArray(dcs) || dcs.length === 0) return null;
  const active = dcs.filter((d) => d.status !== 'scheduled_for_later');
  const pool = active.length > 0 ? active : dcs;
  const preferred = pool.filter((d) =>
    ['created', 'po_submitted', 'pending_dc'].includes(String(d.status || ''))
  );
  const ranked = (preferred.length > 0 ? preferred : pool).slice().sort((a, b) => {
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  });
  return ranked[0] || null;
}

function executiveName(item: DcOrder): string {
  if (!item.assigned_to) return '-';
  if (typeof item.assigned_to === 'string') return item.assigned_to;
  return item.assigned_to.name || '-';
}

function townOf(item: DcOrder): string {
  if (item.location?.trim()) return item.location.trim();
  if (item.address?.trim()) return item.address.split(',')[0].trim() || '-';
  return '-';
}

function productsSummary(item: DcOrder, linked?: LinkedDC | null): string {
  const fromDc = linked?.productDetails;
  if (Array.isArray(fromDc) && fromDc.length > 0) {
    return fromDc
      .map((p: any) => {
        const name = p.product || p.productName || p.product_name || 'Product';
        const qty = Number(p.quantity) || Number(p.strength) || 0;
        return qty ? `${name} - ${qty}` : name;
      })
      .join(', ');
  }
  const fromOrder = item.dcRequestData?.productDetails;
  if (Array.isArray(fromOrder) && fromOrder.length > 0) {
    return fromOrder
      .map((p: any) => {
        const name = p.product || p.productName || p.product_name || 'Product';
        const qty = Number(p.quantity) || Number(p.strength) || 0;
        return qty ? `${name} - ${qty}` : name;
      })
      .join(', ');
  }
  if (Array.isArray(item.products) && item.products.length > 0) {
    return item.products
      .map((p) => {
        const name = p.product_name || 'Product';
        const qty = Number(p.quantity) || Number(p.strength) || 0;
        return qty ? `${name} - ${qty}` : name;
      })
      .join(', ');
  }
  return '-';
}

function formatDateTime(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '-';
  }
}

function parseFilterDate(value: string, endOfDay = false): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD or DD-MM-YYYY
  let d: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    d = new Date(`${trimmed}T00:00:00`);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split('-');
    d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  } else {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export default function DCSavedScreen({ navigation }: any) {
  const [items, setItems] = useState<DcOrder[]>([]);
  const [dealDCs, setDealDCs] = useState<Record<string, LinkedDC>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [locationDeal, setLocationDeal] = useState<DcOrder | null>(null);
  const { user } = useAuth();

  /** Web: onSaved merges the saved transport keys into selectedDeal; keep the list row in sync too. */
  const onTransportSaved = (saved: Record<string, any>) => {
    const id = locationDeal?._id;
    if (!id) return;
    const merge = (d: any) => ({
      ...d,
      ...saved,
      pendingEdit: d.pendingEdit ? { ...d.pendingEdit, ...saved } : d.pendingEdit,
    });
    setLocationDeal((prev) => (prev ? merge(prev) : prev));
    setItems((prev) => prev.map((d) => (d._id === id ? merge(d) : d)));
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [approvedRes, savedRes] = await Promise.all([
        apiService.get('/dc-orders?status=dc_approved&limit=500').catch(() => []),
        apiService.get('/dc-orders?status=saved&limit=500').catch(() => []),
      ]);
      const approved = unwrapList(approvedRes);
      const legacyAccepted = unwrapList(savedRes).filter((d: any) => d.workflowStage === 'ClosedSales');
      const byId = new Map<string, DcOrder>();
      ;[...approved, ...legacyAccepted].forEach((d: any) => {
        if (d?._id) byId.set(String(d._id), d);
      });
      const dataArray = Array.from(byId.values()).sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      const dcMap: Record<string, LinkedDC> = {};
      await Promise.all(
        dataArray.map(async (deal) => {
          try {
            const dcs = unwrapList(await apiService.get(`/dc?dcOrderId=${deal._id}`));
            if (dcs.length > 0) {
              dcMap[deal._id] = pickSavedPipelineDc(dcs) || dcs[0];
            }
          } catch {
            /* ignore per-row DC fetch failures */
          }
        })
      );

      setDealDCs(dcMap);
      setItems(dataArray);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load saved DCs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const filteredItems = useMemo(() => {
    const from = parseFilterDate(fromDate, false);
    const to = parseFilterDate(toDate, true);

    return items.filter((item) => {
      if (
        !matchesWords(searchQuery, [
          item.school_name,
          item.contact_mobile,
          item.school_type,
          item.zone,
          executiveName(item),
          townOf(item),
          item.address,
          productsSummary(item, dealDCs[item._id]),
        ])
      )
        return false;
      const created = new Date(item.createdAt || item.created_at || 0);
      if (from && !Number.isNaN(created.getTime()) && created < from) return false;
      if (to && !Number.isNaN(created.getTime()) && created > to) return false;
      return true;
    });
  }, [items, dealDCs, searchQuery, fromDate, toDate]);

  const openPo = async (item: DcOrder) => {
    const linked = dealDCs[item._id];
    const raw =
      linked?.poPhotoUrl ||
      item.pod_proof_url ||
      null;
    const url = buildFileUrl(raw);
    if (!url) {
      Alert.alert('PO', 'No PO document available for this DC.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Could not open PO document.');
    }
  };

  const openUpdateDC = (item: DcOrder) => {
    navigation.navigate('DCCreate', { dealId: item._id, mode: 'update' });
  };

  return (
    <ScreenShell
      title="Saved DC List"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
      noScroll
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <SearchBar placeholder="Search school, mobile, zone, town, executive, product…" value={searchQuery} onChangeText={setSearchQuery} />
        <FilterRow>
          <FilterCell><DateField placeholder="From date" value={fromDate} onChange={setFromDate} /></FilterCell>
          <FilterCell><DateField placeholder="To date" value={toDate} onChange={setToDate} /></FilterCell>
        </FilterRow>
        {fromDate || toDate ? (
          <WebButton title="Clear dates" variant="outline" onPress={() => { setFromDate(''); setToDate(''); }} />
        ) : null}

        <Text style={ui.count}>{filteredItems.length} saved DC{filteredItems.length === 1 ? '' : 's'}</Text>
        {filteredItems.length === 0 ? (
          <EmptyState title="No saved deals found" message="Try a different search or date range." />
        ) : (
          filteredItems.map((item) => {
            const linked = dealDCs[item._id];
            const hasPo = !!(linked?.poPhotoUrl || item.pod_proof_url);
            return (
              <Card key={item._id}>
                <CardTitle title={item.school_name || 'Unnamed School'} badge={linked ? 'DC raised' : 'Saved'} tone={linked ? 'info' : 'neutral'} />
                <InfoRow label="Created on" value={formatDateTime(item.createdAt || item.created_at)} />
                <InfoRow label="School type" value={item.school_type} />
                <InfoRow label="Zone" value={item.zone} />
                <InfoRow label="Town" value={townOf(item)} />
                <InfoRow label="Executive" value={executiveName(item)} />
                <InfoRow label="Mobile" value={item.contact_mobile} phone />
                <InfoRow label="Products" value={productsSummary(item, linked)} />
                {!hasPo ? <InfoRow label="PO" value="Not uploaded" /> : null}
                <ActionRow>
                  {hasPo ? <Act title="View PO" variant="outline" onPress={() => openPo(item)} /> : null}
                  <Act title="Location" variant="outline" onPress={() => setLocationDeal(item)} />
                  <Act title={linked ? 'Update DC' : 'Raise DC'} onPress={() => openUpdateDC(item)} />
                </ActionRow>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!locationDeal}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationDeal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>View Location</Text>
            <InfoRow label="School" value={locationDeal?.school_name || '-'} bold />
            <InfoRow label="Town" value={locationDeal ? townOf(locationDeal) : '-'} />
            <InfoRow label="Address" value={locationDeal?.address || locationDeal?.location || '-'} />
            <InfoRow label="Zone" value={locationDeal?.zone || '-'} />
            {locationDeal ? (
              <View style={styles.transportSection}>
                <TransportDetailsSection
                  title="Transport details"
                  dcOrderId={locationDeal._id}
                  details={transportDetailsFromOrder(locationDeal)}
                  school={{ name: locationDeal.school_name, mobile: locationDeal.contact_mobile }}
                  canEdit={canEditTransportDetails(user?.role)}
                  inputStyle={styles.input}
                  disabledInputStyle={styles.inputDisabled}
                  onSaved={onTransportSaved}
                />
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <WebButton title="Close" variant="outline" onPress={() => setLocationDeal(null)} />
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: colors.backgroundLight, borderRadius: 14, padding: 16, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  modalActions: { marginTop: 8 },
  transportSection: { borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 12, marginTop: 8 },
  input: {
    fontSize: 15,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
    color: colors.textPrimary,
  },
  inputDisabled: { backgroundColor: colors.backgroundMuted, opacity: 0.8 },
});
