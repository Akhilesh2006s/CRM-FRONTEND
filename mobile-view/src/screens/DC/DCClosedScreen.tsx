import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiService, getApiUrl } from '../../services/api';
import { colors, radii, spacing } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput, WebSelect } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import { SentToSeniorList } from '../../components/dc/SentToSeniorList';
import { uniqueProductNames } from '../../lib/crm/productNames';
import { resolveClosedSalesProductLines } from '../../components/dc/closedSalesLines';

type Product = { product_name?: string; product?: string; quantity?: number; strength?: number };
type DcOrder = {
  _id: string; school_name?: string; school_code?: string; school_type?: string; contact_mobile?: string;
  zone?: string; location?: string; city?: string; address?: string; products?: Product[];
  assigned_to?: { _id?: string; name?: string } | string; createdAt?: string; created_at?: string;
  status?: string; pod_proof_url?: string; dcRequestData?: any; pendingEdit?: any;
};
type Filters = { school: string; mobile: string; from: string; to: string; zone: string; executive: string; town: string };
const EMPTY_FILTERS: Filters = { school: '', mobile: '', from: '', to: '', zone: '', executive: '', town: '' };

const listFromResponse = (response: any): DcOrder[] => Array.isArray(response) ? response : response?.data || [];
const assignedId = (item: DcOrder) => typeof item.assigned_to === 'string' ? item.assigned_to : item.assigned_to?._id || '';
const executiveName = (item: DcOrder) => typeof item.assigned_to === 'object' ? item.assigned_to?.name || '-' : '-';
const townOf = (item: DcOrder) => item.city || item.location || item.address?.split(',')[0]?.trim() || '-';
/** Product names only, each once (web getProductsDisplay). */
const productsOf = (item: DcOrder) => uniqueProductNames(resolveClosedSalesProductLines(item)).join(', ') || '-';

/** Term-Wise / Term 2 split entries belong on Clients -> Term Wise DC, not Closed Sales (web load). */
const isTerm2SplitEntry = (item: DcOrder) => {
  const req = item.dcRequestData || {};
  if (!(req.isSplit || req.term2DCId)) return false;
  const lines: any[] = Array.isArray(req.productDetails) && req.productDetails.length ? req.productDetails : item.products || [];
  if (!lines.length) return false;
  const term = (p: any) => p.term || 'Term 1';
  return lines.every((p) => term(p) === 'Term 2') && !lines.some((p) => term(p) === 'Term 1' || p.term === 'Both');
};
const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
};
const poUrl = (raw?: string) => {
  if (!raw?.trim()) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  return `${getApiUrl().replace(/\/api\/?$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`;
};

export default function DCClosedScreen({ navigation }: any) {
  const { user } = useAuth();
  // Coordinator (or Super Admin) accepts DCs and follows their status (web canApproveDC).
  const canApproveDC = user?.role === 'Super Admin' || user?.role === 'Coordinator';
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const [items, setItems] = useState<DcOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const loadData = useCallback(async () => {
    try {
      const [requested, accepted] = await Promise.all([
        apiService.get('/dc-orders?status=dc_requested&limit=1000'),
        apiService.get('/dc-orders?status=dc_accepted&limit=1000'),
      ]);
      const byId = new Map<string, DcOrder>();
      [...listFromResponse(requested), ...listFromResponse(accepted)]
        .filter((item) => (item.status === 'dc_requested' || item.status === 'dc_accepted') && !isTerm2SplitEntry(item))
        .forEach((item) => byId.set(item._id, item));
      setItems(Array.from(byId.values()).sort((a, b) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()));
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to load closed sales');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const zoneOptions = useMemo(() => {
    const zones = Array.from(new Set(items.map((item) => item.zone?.trim()).filter(Boolean) as string[])).sort();
    return [{ label: 'All Zones', value: '' }, ...zones.map((zone) => ({ label: zone, value: zone }))];
  }, [items]);
  const executiveOptions = useMemo(() => {
    const executives = new Map<string, string>();
    items.forEach((item) => { const id = assignedId(item); if (id) executives.set(id, executiveName(item)); });
    return [{ label: 'All Executives', value: '' }, ...Array.from(executives).map(([value, label]) => ({ value, label }))];
  }, [items]);
  const filteredItems = useMemo(() => items.filter((item) => {
    const created = new Date(item.createdAt || item.created_at || 0);
    if (filters.school && !(item.school_name || '').toLowerCase().includes(filters.school.toLowerCase())) return false;
    if (filters.mobile && !String(item.contact_mobile || '').includes(filters.mobile)) return false;
    if (filters.zone && item.zone !== filters.zone) return false;
    if (filters.executive && assignedId(item) !== filters.executive) return false;
    if (filters.town && !townOf(item).toLowerCase().includes(filters.town.toLowerCase())) return false;
    if (filters.from && created < new Date(`${filters.from}T00:00:00`)) return false;
    if (filters.to && created > new Date(`${filters.to}T23:59:59`)) return false;
    return true;
  }), [filters, items]);

  const openPO = async (item: DcOrder) => {
    const url = poUrl(item.pod_proof_url);
    if (!url) return Alert.alert('PO not available', 'No PO document has been uploaded for this sale.');
    try { await Linking.openURL(url); } catch { Alert.alert('Unable to open PO', 'The PO document could not be opened.'); }
  };
  const refresh = () => { setRefreshing(true); setStatusRefreshKey((k) => k + 1); loadData(); };

  return (
    <ScreenShell title="Closed Sales" loading={loading && !refreshing} refreshing={refreshing} onRefresh={refresh}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Closed Leads List</Text>
        <View style={styles.filterCard}>
          <WebInput placeholder="By School Name" value={filters.school} onChangeText={(school) => setFilters((f) => ({ ...f, school }))} />
          <WebInput placeholder="By Contact Mobile No" value={filters.mobile} keyboardType="phone-pad" onChangeText={(mobile) => setFilters((f) => ({ ...f, mobile }))} />
          <WebInput placeholder="From date (YYYY-MM-DD)" value={filters.from} onChangeText={(from) => setFilters((f) => ({ ...f, from }))} />
          <WebInput placeholder="To date (YYYY-MM-DD)" value={filters.to} onChangeText={(to) => setFilters((f) => ({ ...f, to }))} />
          <WebSelect value={filters.zone} onValueChange={(zone) => setFilters((f) => ({ ...f, zone }))} items={zoneOptions} />
          <WebSelect value={filters.executive} onValueChange={(executive) => setFilters((f) => ({ ...f, executive }))} items={executiveOptions} />
          <WebInput placeholder="By Town" value={filters.town} onChangeText={(town) => setFilters((f) => ({ ...f, town }))} />
          <WebButton title="Clear Filters" onPress={() => setFilters(EMPTY_FILTERS)} />
        </View>
        {filteredItems.length === 0 ? <Text style={styles.empty}>No closed sales found.</Text> : filteredItems.map((item) => (
          <View key={item._id} style={styles.saleCard}>
            <View style={styles.cardHeader}>
              <View style={styles.schoolHeader}>
                <Text style={styles.schoolName}>{item.school_name || '-'}</Text>
                <Text style={styles.schoolCode}>Code: {item.school_code || '-'}</Text>
              </View>
              <View style={styles.statusBadge}><Text style={styles.statusText}>{item.status === 'dc_accepted' ? 'DC Accepted' : 'DC Requested'}</Text></View>
            </View>
            <View style={styles.detailsGrid}>
              <View style={styles.detail}><Text style={styles.detailLabel}>Created On</Text><Text style={styles.detailValue}>{formatDate(item.createdAt || item.created_at)}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>School Type</Text><Text style={styles.detailValue}>{item.school_type || '-'}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Zone</Text><Text style={styles.detailValue}>{item.zone || '-'}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Town</Text><Text style={styles.detailValue}>{townOf(item)}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Executive</Text><Text style={styles.detailValue}>{executiveName(item)}</Text></View>
              <View style={styles.detail}><Text style={styles.detailLabel}>Mobile</Text><Text style={styles.detailValue}>{item.contact_mobile || '-'}</Text></View>
            </View>
            <View style={styles.productsBlock}><Text style={styles.detailLabel}>Products</Text><Text style={styles.productsValue}>{productsOf(item)}</Text></View>
            <View style={styles.cardActions}>
              {item.pod_proof_url ? <TouchableOpacity style={styles.outlineButton} onPress={() => openPO(item)}><Text style={styles.outlineButtonText}>View PO</Text></TouchableOpacity> : null}
              <TouchableOpacity style={styles.outlineButton} onPress={() => Alert.alert('Location', item.location || item.address || 'No location available')}><Text style={styles.outlineButtonText}>View Location</Text></TouchableOpacity>
              <TouchableOpacity style={styles.raiseButton} onPress={() => navigation.navigate('DCCreate', { dealId: item._id })}><Text style={styles.raiseButtonText}>Raise DC</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        {canApproveDC ? <SentToSeniorList refreshKey={statusRefreshKey} /> : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  pageTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: spacing.md },
  filterCard: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  saleCard: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  schoolHeader: { flex: 1 },
  schoolName: { ...typography.heading.h4, color: colors.textPrimary },
  schoolCode: { ...typography.label.small, color: colors.textSecondary, marginTop: 3 },
  statusBadge: { borderRadius: radii.sm, backgroundColor: colors.primary + '18', paddingHorizontal: 8, paddingVertical: 5 },
  statusText: { ...typography.label.small, color: colors.primary, fontWeight: '700' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  detail: { width: '50%', paddingHorizontal: 4, marginBottom: spacing.sm },
  detailLabel: { ...typography.label.small, color: colors.textSecondary, marginBottom: 2 },
  detailValue: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
  productsBlock: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.sm, marginTop: 2 },
  productsValue: { ...typography.label.small, color: colors.textPrimary, lineHeight: 19 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md, marginTop: spacing.md },
  empty: { padding: spacing.lg, color: colors.textSecondary, textAlign: 'center' },
  raiseButton: { backgroundColor: colors.error, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 7, minWidth: 86, alignItems: 'center' },
  raiseButtonText: { ...typography.label.small, color: colors.textLight, fontWeight: '700' },
  outlineButton: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.backgroundLight, minWidth: 86, alignItems: 'center' },
  outlineButtonText: { ...typography.label.small, color: colors.textPrimary, fontWeight: '600' },
});
