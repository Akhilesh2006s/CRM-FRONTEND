import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
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

  const [schoolName, setSchoolName] = useState('');
  const [mobile, setMobile] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [zone, setZone] = useState('');
  const [executive, setExecutive] = useState('');
  const [town, setTown] = useState('');
  const [applied, setApplied] = useState({
    schoolName: '',
    mobile: '',
    fromDate: '',
    toDate: '',
    zone: '',
    executive: '',
    town: '',
  });

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

  const onSearch = () => {
    setApplied({
      schoolName: schoolName.trim(),
      mobile: mobile.trim(),
      fromDate: fromDate.trim(),
      toDate: toDate.trim(),
      zone: zone.trim(),
      executive: executive.trim(),
      town: town.trim(),
    });
  };

  const filteredItems = useMemo(() => {
    const from = parseFilterDate(applied.fromDate, false);
    const to = parseFilterDate(applied.toDate, true);

    return items.filter((item) => {
      if (applied.schoolName) {
        const name = (item.school_name || '').toLowerCase();
        if (!name.includes(applied.schoolName.toLowerCase())) return false;
      }
      if (applied.mobile) {
        const m = (item.contact_mobile || '').replace(/\D/g, '');
        if (!m.includes(applied.mobile.replace(/\D/g, ''))) return false;
      }
      if (applied.zone) {
        const z = (item.zone || '').toLowerCase();
        if (!z.includes(applied.zone.toLowerCase())) return false;
      }
      if (applied.executive) {
        const e = executiveName(item).toLowerCase();
        if (!e.includes(applied.executive.toLowerCase())) return false;
      }
      if (applied.town) {
        const t = townOf(item).toLowerCase();
        if (!t.includes(applied.town.toLowerCase())) return false;
      }
      const created = new Date(item.createdAt || item.created_at || 0);
      if (from && !Number.isNaN(created.getTime()) && created < from) return false;
      if (to && !Number.isNaN(created.getTime()) && created > to) return false;
      return true;
    });
  }, [items, applied]);

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
        <PageSection title="Search filters">
          <View style={styles.filterCard}>
            <WebInput
              placeholder="By School Name"
              value={schoolName}
              onChangeText={setSchoolName}
              style={styles.filterInput}
            />
            <WebInput
              placeholder="By Contact Mobile No"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              style={styles.filterInput}
            />
            <WebInput
              placeholder="dd-mm-yyyy (From)"
              value={fromDate}
              onChangeText={setFromDate}
              style={styles.filterInput}
            />
            <WebInput
              placeholder="dd-mm-yyyy (To)"
              value={toDate}
              onChangeText={setToDate}
              style={styles.filterInput}
            />
            <WebInput
              placeholder="Select Zone"
              value={zone}
              onChangeText={setZone}
              style={styles.filterInput}
            />
            <WebInput
              placeholder="Select Executive"
              value={executive}
              onChangeText={setExecutive}
              style={styles.filterInput}
            />
            <WebInput
              placeholder="By Town"
              value={town}
              onChangeText={setTown}
              style={styles.filterInput}
            />
            <WebButton title="Search" onPress={onSearch} />
          </View>
        </PageSection>

        <PageSection title={`Saved DCs (${filteredItems.length})`}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No saved deals found.</Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const linked = dealDCs[item._id];
              const hasPo = !!(linked?.poPhotoUrl || item.pod_proof_url);
              return (
                <View key={item._id} style={styles.card}>
                  <Text style={styles.schoolName}>{item.school_name || 'Unnamed School'}</Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Created On</Text>
                    <Text style={styles.metaValue}>{formatDateTime(item.createdAt || item.created_at)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>School Type</Text>
                    <Text style={styles.metaValue}>{item.school_type || '-'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Zone</Text>
                    <Text style={styles.metaValue}>{item.zone || '-'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Town</Text>
                    <Text style={styles.metaValue}>{townOf(item)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Executive</Text>
                    <Text style={styles.metaValue}>{executiveName(item)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Mobile</Text>
                    <Text style={styles.metaValue}>{item.contact_mobile || '-'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Products</Text>
                    <Text style={[styles.metaValue, styles.productsValue]}>
                      {productsSummary(item, linked)}
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    {hasPo ? (
                      <TouchableOpacity onPress={() => openPo(item)} style={styles.poLinkWrap}>
                        <Text style={styles.poLink}>View PO</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.poMissing}>PO: -</Text>
                    )}
                    <WebButton
                      title={linked ? 'Update DC' : 'Raise DC'}
                      onPress={() => openUpdateDC(item)}
                    />
                    <WebButton
                      title="View Location"
                      variant="outline"
                      onPress={() => setLocationDeal(item)}
                    />
                  </View>
                </View>
              );
            })
          )}
        </PageSection>
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
            <WebLabel>School</WebLabel>
            <Text style={styles.modalBody}>{locationDeal?.school_name || '-'}</Text>
            <WebLabel>Town / Location</WebLabel>
            <Text style={styles.modalBody}>
              {locationDeal ? townOf(locationDeal) : '-'}
            </Text>
            <WebLabel>Address</WebLabel>
            <Text style={styles.modalBody}>{locationDeal?.address || locationDeal?.location || '-'}</Text>
            <WebLabel>Zone</WebLabel>
            <Text style={styles.modalBody}>{locationDeal?.zone || '-'}</Text>
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
  contentContainer: { paddingBottom: 32 },
  filterCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  filterInput: { marginBottom: 0 },
  emptyContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: { ...typography.body.medium, color: colors.textSecondary },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  schoolName: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  metaLabel: {
    ...typography.body.small,
    color: colors.textMuted,
    minWidth: 90,
  },
  metaValue: {
    ...typography.body.medium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  productsValue: {
    ...typography.body.small,
  },
  actions: {
    marginTop: 14,
    gap: 8,
  },
  poLinkWrap: {
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  poLink: {
    ...typography.body.medium,
    color: colors.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  poMissing: {
    ...typography.body.small,
    color: colors.textMuted,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 20,
    gap: 6,
    maxHeight: '90%',
  },
  modalTitle: {
    ...typography.heading.h2,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  modalBody: {
    ...typography.body.medium,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  modalActions: {
    marginTop: 8,
  },
  transportSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 4,
  },
  input: {
    ...typography.body.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
  },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.8 },
});
