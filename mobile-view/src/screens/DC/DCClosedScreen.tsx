import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Text } from 'react-native';
import { apiService, getApiUrl } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebButton, WebSelect } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import { SearchBar, Act, FilterRow, FilterCell, matchesWords, ui } from '../../components/dc/DcUi';
import { useAuth } from '../../context/AuthContext';
import { SentToSeniorList } from '../../components/dc/SentToSeniorList';
import { uniqueProductNames } from '../../lib/crm/productNames';
import { resolveClosedSalesProductLines } from '../../components/dc/closedSalesLines';

import DateField from '../../ui/DateField';
type Product = { product_name?: string; product?: string; quantity?: number; strength?: number };
type DcOrder = {
  _id: string; school_name?: string; school_code?: string; school_type?: string; contact_mobile?: string;
  zone?: string; location?: string; city?: string; address?: string; products?: Product[];
  assigned_to?: { _id?: string; name?: string } | string; createdAt?: string; created_at?: string;
  status?: string; pod_proof_url?: string; dcRequestData?: any; pendingEdit?: any;
};
type Filters = { q: string; from: string; to: string; zone: string; executive: string };
const EMPTY_FILTERS: Filters = { q: '', from: '', to: '', zone: '', executive: '' };

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
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
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
    if (!matchesWords(filters.q, [item.school_name, item.school_code, item.contact_mobile, item.school_type, item.zone, townOf(item), executiveName(item), productsOf(item), item.status === 'dc_accepted' ? 'DC Accepted' : 'DC Requested'])) return false;
    if (filters.zone && item.zone !== filters.zone) return false;
    if (filters.executive && assignedId(item) !== filters.executive) return false;
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
      <SearchBar placeholder="Search school, code, mobile, town, executive, product…" value={filters.q} onChangeText={(q) => setFilters((f) => ({ ...f, q }))} />
      <PageSection title="Filters">
        <FilterRow>
          <FilterCell><DateField placeholder="From date" value={filters.from} onChange={(from) => setFilters((f) => ({ ...f, from }))} /></FilterCell>
          <FilterCell><DateField placeholder="To date" value={filters.to} onChange={(to) => setFilters((f) => ({ ...f, to }))} /></FilterCell>
          <FilterCell><WebSelect value={filters.zone} onValueChange={(zone) => setFilters((f) => ({ ...f, zone }))} items={zoneOptions} /></FilterCell>
          <FilterCell><WebSelect value={filters.executive} onValueChange={(executive) => setFilters((f) => ({ ...f, executive }))} items={executiveOptions} /></FilterCell>
        </FilterRow>
        <WebButton title="Clear Filters" variant="outline" onPress={() => setFilters(EMPTY_FILTERS)} />
      </PageSection>
      <Text style={ui.count}>{filteredItems.length} closed sale{filteredItems.length === 1 ? '' : 's'}</Text>
      {filteredItems.length === 0 ? <EmptyState title="No closed sales found" message="Try a different search or clear the filters." /> : filteredItems.map((item) => {
        const status = item.status === 'dc_accepted' ? 'DC Accepted' : 'DC Requested';
        return (
          <Card key={item._id}>
            <CardTitle title={item.school_name || '-'} subtitle={item.school_code ? `Code: ${item.school_code}` : undefined} badge={status} tone={item.status === 'dc_accepted' ? 'success' : 'warning'} />
            <InfoRow label="Created on" value={formatDate(item.createdAt || item.created_at)} />
            <InfoRow label="School type" value={item.school_type} />
            <InfoRow label="Zone" value={item.zone} />
            <InfoRow label="Town" value={townOf(item)} />
            <InfoRow label="Executive" value={executiveName(item)} />
            <InfoRow label="Mobile" value={item.contact_mobile} phone />
            <InfoRow label="Products" value={productsOf(item)} />
            <ActionRow>
              {item.pod_proof_url ? <Act title="View PO" variant="outline" onPress={() => openPO(item)} /> : null}
              <Act title="Location" variant="outline" onPress={() => Alert.alert('Location', item.location || item.address || 'No location available')} />
              <Act title="Raise DC" onPress={() => navigation.navigate('DCCreate', { dealId: item._id })} />
            </ActionRow>
          </Card>
        );
      })}
      {canApproveDC ? <SentToSeniorList refreshKey={statusRefreshKey} /> : null}
    </ScreenShell>
  );
}

