import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Alert,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { navigateRoot } from '../../navigation/navigationRef';

type DcOrderRow = {
  _id: string;
  school_name?: string;
  school_code?: string;
  dc_code?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
  region?: string;
  area?: string;
  location?: string;
  products?: Array<{ product_name?: string; quantity?: number; term?: string }>;
};

type Lead = {
  _id: string;
  school_name?: string;
  school_code?: string;
  contact_mobile?: string;
  zone?: string;
  status?: string;
  priority?: string;
  follow_up_date?: string;
  createdAt?: string;
  remarks?: string;
  products?: any[];
  school_id?: any;
};

/** Create renewal — matches web (product + qty + term). */
type RenewCreateLine = {
  product_name: string;
  quantity: number;
  term: string;
  isFromPreviousDc: boolean;
};

/** Update follow-up — renewal % per product. */
type RenewUpdateLine = {
  product_name: string;
  term: string;
  renewal_pct: number | '';
  isFromPreviousDc: boolean;
};

const PRIORITIES = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Cold', value: 'Cold' },
];

const TERMS = ['Term 1', 'Term 2', 'Term 3'].map((t) => ({ label: t, value: t }));

function dedupeSchoolProducts(products?: DcOrderRow['products']) {
  const seen = new Set<string>();
  const out: Array<{ product_name: string; term: string; quantity?: number }> = [];
  for (const p of products || []) {
    const name = (p.product_name || '').trim();
    if (!name) continue;
    const term = p.term || 'Term 1';
    const key = `${name}::${term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ product_name: name, term, quantity: p.quantity });
  }
  return out;
}

function buildRenewProductsFromSchool(school: DcOrderRow | null): RenewCreateLine[] {
  const deduped = dedupeSchoolProducts(school?.products);
  if (deduped.length > 0) {
    return deduped.map((p) => ({
      product_name: p.product_name,
      term: p.term,
      quantity: Math.max(1, Number((p as { quantity?: number }).quantity) || 1),
      isFromPreviousDc: true,
    }));
  }
  return [{ product_name: '', quantity: 1, term: 'Term 1', isFromPreviousDc: false }];
}

function schoolDisplayCode(row: DcOrderRow | null) {
  if (!row) return '-';
  return (row.school_code || row.dc_code || '').trim() || '-';
}

/** Matches web `dashboard/leads/renewal` */
export default function LeadsRenewalListScreen() {
  const { user } = useAuth();
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [productNames, setProductNames] = useState<string[]>([]);

  const [schoolQuery, setSchoolQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<DcOrderRow[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<DcOrderRow | null>(null);
  const [schoolDetailLoading, setSchoolDetailLoading] = useState(false);
  const [renewContactPerson, setRenewContactPerson] = useState('');
  const [renewContactMobile, setRenewContactMobile] = useState('');
  const [renewRemarks, setRenewRemarks] = useState('');
  const [renewProducts, setRenewProducts] = useState<RenewCreateLine[]>([
    { product_name: '', quantity: 1, term: 'Term 1', isFromPreviousDc: false },
  ]);
  const [creatingRenewal, setCreatingRenewal] = useState(false);

  const [updateOpen, setUpdateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [followUpDate, setFollowUpDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState('Hot');
  const [updateRemarks, setUpdateRemarks] = useState('');
  const [productsInterested, setProductsInterested] = useState<RenewUpdateLine[]>([]);
  const [updating, setUpdating] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadLeads = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await apiService.get(`/leads?employee=${user._id}&lead_type=renewal&limit=500`);
      const all = Array.isArray(res) ? res : res?.data || [];
      const active = all.filter((l: Lead) => l.status !== 'Closed' && l.status !== 'Saved');
      setAllLeads(active);
      const uniqueZones = Array.from(new Set(active.map((l: Lead) => l.zone).filter(Boolean))) as string[];
      setZones(uniqueZones.sort());
    } catch {
      Alert.alert('Error', 'Failed to load renewal leads');
      setAllLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?._id]);

  useEffect(() => {
    loadLeads();
    apiService
      .get('/products/active')
      .catch(() => apiService.get('/products'))
      .then((data) => {
        const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setProductNames(list.map((p: any) => p.productName || p.name).filter(Boolean));
      })
      .catch(() => {});
  }, [loadLeads]);

  useEffect(() => {
    let filtered = [...allLeads];
    if (zoneFilter && zoneFilter !== 'all') {
      filtered = filtered.filter((l) => l.zone?.toLowerCase().includes(zoneFilter.toLowerCase()));
    }
    if (mobileFilter) filtered = filtered.filter((l) => l.contact_mobile?.includes(mobileFilter));
    if (schoolFilter) {
      filtered = filtered.filter((l) => l.school_name?.toLowerCase().includes(schoolFilter.toLowerCase()));
    }
    filtered.sort((a, b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bT - aT;
    });
    setLeads(filtered);
  }, [allLeads, zoneFilter, schoolFilter, mobileFilter]);

  const runSchoolSearch = useCallback(async (q: string) => {
    const t = q.trim();
    if (t.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await apiService.get(`/dc-orders/renewal-search?q=${encodeURIComponent(t)}&limit=25`);
      setSearchResults(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => runSchoolSearch(schoolQuery), 350);
    return () => clearTimeout(timer);
  }, [schoolQuery, runSchoolSearch]);

  const selectSchool = async (row: DcOrderRow) => {
    setSearchResults([]);
    setSchoolQuery(row.school_name || '');
    setSelectedSchool(row);
    setRenewProducts(buildRenewProductsFromSchool(row));
    setRenewContactPerson(row.contact_person || '');
    setRenewContactMobile(row.contact_mobile || '');
    setSchoolDetailLoading(true);
    try {
      const full = await apiService.get(`/dc-orders/${row._id}`);
      if (full?._id) {
        const merged = { ...row, ...full, products: full.products || row.products };
        setSelectedSchool(merged);
        setRenewProducts(buildRenewProductsFromSchool(merged));
        setRenewContactPerson(full.contact_person || row.contact_person || '');
        setRenewContactMobile(full.contact_mobile || row.contact_mobile || '');
      }
    } catch {
      Alert.alert('Note', 'Could not load full school record; using search summary.');
    } finally {
      setSchoolDetailLoading(false);
    }
  };

  const submitRenewalLead = async () => {
    if (!selectedSchool?._id) {
      Alert.alert('Validation', 'Select an existing school from search');
      return;
    }
    if (!renewContactPerson.trim() || !renewContactMobile.trim()) {
      Alert.alert('Validation', 'Contact person and mobile are required');
      return;
    }
    const rows = renewProducts.filter((r) => r.product_name.trim());
    if (rows.length === 0) {
      Alert.alert('Validation', 'Add at least one product');
      return;
    }
    setCreatingRenewal(true);
    try {
      await apiService.post('/leads/create', {
        lead_type: 'renewal',
        school_id: selectedSchool._id,
        contact_person: renewContactPerson.trim(),
        contact_mobile: renewContactMobile.trim(),
        remarks: renewRemarks,
        products: rows.map((r) => ({
          product_name: r.product_name.trim(),
          quantity: Math.max(1, Number(r.quantity) || 1),
          term: r.term || 'Term 1',
          unit_price: 0,
        })),
      });
      Alert.alert('Success', 'Renewal lead created');
      setSelectedSchool(null);
      setSchoolQuery('');
      setRenewRemarks('');
      setRenewProducts([{ product_name: '', quantity: 1, term: 'Term 1', isFromPreviousDc: false }]);
      loadLeads();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create renewal lead');
    } finally {
      setCreatingRenewal(false);
    }
  };

  const openUpdateModal = (lead: Lead) => {
    setSelectedLead(lead);
    setFollowUpDate(lead.follow_up_date ? new Date(lead.follow_up_date) : new Date());
    setPriority(lead.priority || 'Hot');
    setUpdateRemarks('');
    const pi: RenewUpdateLine[] =
      Array.isArray(lead.products) && lead.products.length > 0
        ? lead.products.map((p: any) => ({
            product_name: p.product_name || p.product || '',
            term: p.term || 'Term 1',
            renewal_pct:
              p.renewal_pct != null && Number.isFinite(Number(p.renewal_pct))
                ? Number(p.renewal_pct)
                : p.chance != null && Number.isFinite(Number(p.chance))
                  ? Number(p.chance)
                  : '',
            isFromPreviousDc: Boolean(p.is_from_previous_dc),
          }))
        : [];
    setProductsInterested(
      pi.length ? pi : [{ product_name: '', term: 'Term 1', renewal_pct: 100, isFromPreviousDc: false }],
    );
    setUpdateOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    if (!updateRemarks.trim()) {
      Alert.alert('Validation', 'Remarks is required');
      return;
    }
    const productRows = productsInterested.filter((p) => p.product_name?.trim());
    if (productRows.length === 0) {
      Alert.alert('Validation', 'Add at least one product with Renewal %');
      return;
    }
    setUpdating(true);
    try {
      await apiService.put(`/leads/${selectedLead._id}`, {
        follow_up_date: followUpDate.toISOString(),
        priority,
        remarks: updateRemarks,
        productsInterested: productRows.map((p) => ({
          product_name: p.product_name.trim(),
          term: p.term || 'Term 1',
          renewal_pct: Number(p.renewal_pct),
          chance: Number(p.renewal_pct),
          is_from_previous_dc: p.isFromPreviousDc,
          quantity: 1,
          unit_price: 0,
        })),
      });
      Alert.alert('Success', 'Follow-up saved');
      setUpdateOpen(false);
      loadLeads();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update');
    } finally {
      setUpdating(false);
    }
  };

  const openHistoryModal = async (lead: Lead) => {
    setHistoryLead(lead);
    setHistoryOpen(true);
    setHistory([]);
    try {
      const full = await apiService.get(`/leads/${lead._id}`);
      let historyData: any[] = Array.isArray(full?.updateHistory) ? [...full.updateHistory] : [];
      if (historyData.length === 0 && lead.createdAt) {
        historyData = [
          {
            remarks: lead.remarks || 'Renewal lead created',
            priority: lead.priority || 'Warm',
            updatedAt: lead.createdAt,
            updatedBy: { name: 'System' },
          },
        ];
      }
      historyData.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      setHistory(historyData);
    } catch {
      Alert.alert('Error', 'Could not load history');
    }
  };

  const updateRenewProduct = (
    i: number,
    field: keyof RenewCreateLine,
    value: string | number | boolean,
  ) => {
    setRenewProducts((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };

  const updateInterestedProduct = (
    i: number,
    field: keyof RenewUpdateLine,
    value: string | number | boolean,
  ) => {
    setProductsInterested((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };

  const removeRenewProduct = (i: number) => {
    setRenewProducts((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));
  };

  return (
    <ScreenShell
      title="Renewal Leads"
      subtitle="Existing schools only — search, follow-ups, same pipeline as web"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadLeads();
      }}
    >
      <PageSection title="Create renewal lead">
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Search an existing school (not a new school). Add products with quantity and term, then
            submit. Pricing uses your catalog defaults unless changed later on close.
          </Text>
        </View>
        <WebLabel>Search school (name or code)</WebLabel>
        <WebInput
          placeholder="Type at least 2 characters…"
          value={schoolQuery}
          onChangeText={(v) => {
            setSchoolQuery(v);
            if (!v) setSelectedSchool(null);
          }}
        />
        {searchLoading ? <Text style={styles.hint}>Searching…</Text> : null}
        {!selectedSchool &&
          searchResults.map((r) => (
            <TouchableOpacity key={r._id} style={styles.searchHit} onPress={() => selectSchool(r)}>
              <Text style={styles.searchName}>{r.school_name}</Text>
              <Text style={styles.hint}>
                Code: {schoolDisplayCode(r)} · {r.zone || '—'} · {r.contact_mobile || '—'}
              </Text>
            </TouchableOpacity>
          ))}
        {selectedSchool ? (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedTitle}>Selected: {selectedSchool.school_name}</Text>
            <Text style={styles.hint}>Code: {schoolDisplayCode(selectedSchool)}</Text>
            {schoolDetailLoading ? <Text style={styles.hint}>Loading full record…</Text> : null}
          </View>
        ) : null}
        <WebLabel>Contact person</WebLabel>
        <WebInput
          placeholder="Contact person"
          value={renewContactPerson}
          onChangeText={setRenewContactPerson}
          editable={!!selectedSchool}
        />
        <WebLabel>Mobile</WebLabel>
        <WebInput
          placeholder="Mobile"
          value={renewContactMobile}
          onChangeText={setRenewContactMobile}
          keyboardType="phone-pad"
          editable={!!selectedSchool}
        />
        <WebLabel>Products interested</WebLabel>
        {renewProducts.map((row, i) => (
          <View key={`rp-${i}`} style={styles.productRow}>
            {row.isFromPreviousDc ? (
              <Text style={styles.productLabel}>
                {row.product_name} (on file)
              </Text>
            ) : (
              <WebSelect
                label="Product"
                value={row.product_name}
                onValueChange={(v) => updateRenewProduct(i, 'product_name', v)}
                items={productNames.map((n) => ({ label: n, value: n }))}
                placeholder="Select product"
              />
            )}
            <View style={styles.productRowInline}>
              <View style={styles.qtyField}>
                <WebLabel>Qty</WebLabel>
                <WebInput
                  placeholder="1"
                  value={String(row.quantity ?? 1)}
                  onChangeText={(v) =>
                    updateRenewProduct(i, 'quantity', Math.max(1, Number(v) || 1))
                  }
                  keyboardType="number-pad"
                  editable={!!selectedSchool}
                />
              </View>
              <View style={styles.termField}>
                <WebSelect
                  label="Term"
                  value={row.term}
                  onValueChange={(v) => updateRenewProduct(i, 'term', v)}
                  items={TERMS}
                />
              </View>
              {renewProducts.length > 1 ? (
                <WebButton
                  title="Remove"
                  variant="outline"
                  onPress={() => removeRenewProduct(i)}
                  disabled={!selectedSchool}
                />
              ) : null}
            </View>
          </View>
        ))}
        <WebButton
          title="Add line"
          variant="outline"
          onPress={() =>
            setRenewProducts((p) => [
              ...p,
              { product_name: '', quantity: 1, term: 'Term 1', isFromPreviousDc: false },
            ])
          }
          disabled={!selectedSchool}
        />
        <WebLabel>Notes</WebLabel>
        <WebInput
          placeholder="Optional context for this renewal…"
          value={renewRemarks}
          onChangeText={setRenewRemarks}
          multiline
          style={{ minHeight: 60 }}
          editable={!!selectedSchool}
        />
        <WebButton
          title={creatingRenewal ? 'Saving…' : 'Submit renewal lead'}
          onPress={submitRenewalLead}
          loading={creatingRenewal}
          disabled={!selectedSchool || creatingRenewal}
        />
        <WebButton title="New school? Use Add Lead" variant="outline" onPress={() => navigateRoot('LeadAdd')} />
      </PageSection>

      <PageSection title="Filters">
        <WebSelect
          label="Zone"
          value={zoneFilter}
          onValueChange={setZoneFilter}
          placeholder="All zones"
          items={[{ label: 'All zones', value: 'all' }, ...zones.map((z) => ({ label: z, value: z }))]}
        />
        <WebInput placeholder="School name" value={schoolFilter} onChangeText={setSchoolFilter} />
        <WebInput placeholder="Mobile" value={mobileFilter} onChangeText={setMobileFilter} keyboardType="phone-pad" />
      </PageSection>

      <PageSection title={`Active leads (${leads.length})`}>
        {leads.map((lead) => (
          <View key={lead._id} style={styles.leadCard}>
            <Text style={styles.leadTitle}>{lead.school_name || '—'}</Text>
            <Text style={styles.hint}>
              {lead.contact_mobile || '—'} · {lead.zone || '—'} · {lead.priority || '—'}
            </Text>
            <View style={styles.leadActions}>
              <WebButton title="Create Follow-up" onPress={() => openUpdateModal(lead)} />
              <WebButton title="View History" variant="outline" onPress={() => openHistoryModal(lead)} />
              <WebButton
                title="Edit Details"
                variant="outline"
                onPress={() => navigateRoot('LeadEdit', { id: lead._id })}
              />
              <WebButton title="Close Lead" variant="outline" onPress={() => navigateRoot('LeadClose', { id: lead._id })} />
            </View>
          </View>
        ))}
        {leads.length === 0 ? <Text style={styles.hint}>No active renewal leads</Text> : null}
      </PageSection>

      <Modal visible={updateOpen} animationType="slide" transparent onRequestClose={() => setUpdateOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>Update follow-up</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateBtn}>Next follow-up: {followUpDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showDatePicker ? (
              <DateTimePicker
                value={followUpDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (d) setFollowUpDate(d);
                }}
              />
            ) : null}
            <WebSelect label="Priority" value={priority} onValueChange={setPriority} items={PRIORITIES} />
            <WebLabel>Remarks *</WebLabel>
            <WebInput value={updateRemarks} onChangeText={setUpdateRemarks} multiline style={{ minHeight: 80 }} />
            {productsInterested.map((row, i) => (
              <View key={`up-${i}`} style={styles.productRow}>
                <WebInput
                  placeholder="Product name"
                  value={row.product_name}
                  onChangeText={(v) => updateInterestedProduct(i, 'product_name', v)}
                />
                <WebInput
                  placeholder="Renewal %"
                  value={row.renewal_pct === '' ? '' : String(row.renewal_pct)}
                  onChangeText={(v) => updateInterestedProduct(i, 'renewal_pct', v === '' ? '' : Number(v))}
                  keyboardType="numeric"
                />
              </View>
            ))}
            <WebButton
              title="Add product"
              variant="outline"
              onPress={() =>
                setProductsInterested((p) => [
                  ...p,
                  { product_name: '', term: 'Term 1', renewal_pct: 100, isFromPreviousDc: false },
                ])
              }
            />
            <View style={styles.modalFooter}>
              <WebButton title="Cancel" variant="outline" onPress={() => setUpdateOpen(false)} />
              <WebButton title="Save" onPress={handleUpdateLead} loading={updating} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>History — {historyLead?.school_name}</Text>
            {history.map((h, i) => (
              <View key={i} style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {h.updatedAt ? new Date(h.updatedAt).toLocaleString() : '—'}
                </Text>
                <Text>{h.remarks || '—'}</Text>
                <Text style={styles.hint}>
                  {h.priority || '—'} · {h.updatedBy?.name || '—'}
                </Text>
              </View>
            ))}
            <WebButton title="Close" onPress={() => setHistoryOpen(false)} />
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    backgroundColor: '#FEF9C3',
    borderWidth: 1,
    borderColor: '#FDE047',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoBannerText: { fontSize: 13, color: '#854D0E', lineHeight: 18 },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  productRowInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' },
  qtyField: { width: 72 },
  termField: { flex: 1, minWidth: 120 },
  searchHit: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchName: { fontWeight: '600', color: colors.textPrimary },
  selectedBox: { padding: 12, backgroundColor: colors.successLight, borderRadius: 8, marginVertical: 8 },
  selectedTitle: { fontWeight: '600', color: colors.primaryDark },
  productRow: { marginVertical: 8, gap: 8 },
  productLabel: { fontWeight: '500', marginBottom: 4 },
  leadCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  leadTitle: { fontSize: 16, fontWeight: '600' },
  leadActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 24 },
  dateBtn: { color: colors.primary, marginBottom: 12, fontWeight: '500' },
  historyItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyDate: { fontWeight: '600', marginBottom: 4 },
});
