import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
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
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  status?: string;
  priority?: string;
  follow_up_date?: string;
  location?: string;
  createdAt?: string;
  remarks?: string;
  recommendations?: string;
  products?: any[];
  school_id?: any;
};

/** Matches web renewal create / update product lines. */
type RenewProductLine = {
  product_name: string;
  term: string;
  strength: number | '';
  renewal_pct: number | '';
  isFromPreviousDc: boolean;
};

const PRIORITIES = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Cold', value: 'Cold' },
];

const TERMS = ['Term 1', 'Term 2', 'Both'].map((t) => ({ label: t, value: t }));

function dedupeSchoolProducts(products?: DcOrderRow['products']) {
  const seen = new Set<string>();
  const out: Array<{ product_name: string; term: string }> = [];
  for (const p of products || []) {
    const name = (p.product_name || '').trim();
    if (!name) continue;
    const term = p.term || 'Term 1';
    const key = `${name}::${term}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ product_name: name, term });
  }
  return out;
}

function buildRenewProductsFromSchool(school: DcOrderRow | null): RenewProductLine[] {
  const deduped = dedupeSchoolProducts(school?.products);
  if (deduped.length > 0) {
    return deduped.map((p) => ({
      product_name: p.product_name,
      term: p.term,
      strength: '' as const,
      renewal_pct: '' as const,
      isFromPreviousDc: true,
    }));
  }
  return [
    { product_name: '', term: 'Term 1', strength: '', renewal_pct: 100, isFromPreviousDc: false },
  ];
}

function schoolDisplayCode(row: DcOrderRow | null) {
  if (!row) return '-';
  return (row.school_code || row.dc_code || '').trim() || '-';
}

function displayField(v?: string | number | null) {
  if (v === undefined || v === null) return '—';
  const s = String(v).trim();
  return s || '—';
}

function leadSchoolCode(lead: Lead) {
  if (lead.school_code) return lead.school_code;
  const sid = lead.school_id;
  if (sid && typeof sid === 'object') {
    return (sid.school_code || sid.dc_code || '').trim() || '-';
  }
  return '-';
}

function formatRenewalProductMeta(p: {
  strength?: number;
  quantity?: number;
  renewal_pct?: number;
  chance?: number;
}): string {
  const parts: string[] = [];
  const strength = Number(p.strength ?? p.quantity);
  if (Number.isFinite(strength) && strength > 0) parts.push(`Strength: ${strength}`);
  const raw = p.renewal_pct ?? p.chance;
  if (raw != null && raw !== '' && Number.isFinite(Number(raw))) {
    parts.push(`Chance: ${Number(raw)}%`);
  }
  return parts.join(' · ');
}

function priorityColor(priority?: string) {
  switch (priority?.toLowerCase()) {
    case 'hot':
      return { bg: '#FEE2E2', text: '#991B1B' };
    case 'warm':
      return { bg: '#FFEDD5', text: '#9A3412' };
    case 'cold':
      return { bg: '#DBEAFE', text: '#1E40AF' };
    default:
      return { bg: '#F1F5F9', text: '#475569' };
  }
}

function emptyAdditionalLine(): RenewProductLine {
  return { product_name: '', term: 'Term 1', strength: '', renewal_pct: 100, isFromPreviousDc: false };
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
  const [renewRecommendations, setRenewRecommendations] = useState('');
  const [renewProducts, setRenewProducts] = useState<RenewProductLine[]>([emptyAdditionalLine()]);
  const [creatingRenewal, setCreatingRenewal] = useState(false);

  const [updateOpen, setUpdateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [followUpDate, setFollowUpDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [priority, setPriority] = useState('Hot');
  const [updateRemarks, setUpdateRemarks] = useState('');
  const [updateRecommendations, setUpdateRecommendations] = useState('');
  const [productsInterested, setProductsInterested] = useState<RenewProductLine[]>([]);
  const [updating, setUpdating] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const priorDcProducts = useMemo(
    () => renewProducts.filter((r) => r.isFromPreviousDc),
    [renewProducts],
  );
  const additionalProducts = useMemo(
    () => renewProducts.filter((r) => !r.isFromPreviousDc),
    [renewProducts],
  );

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

  const updateRenewProduct = (
    i: number,
    field: keyof RenewProductLine,
    value: string | number | boolean,
  ) => {
    setRenewProducts((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };

  const removeRenewProduct = (i: number) => {
    setRenewProducts((p) => p.filter((_, idx) => idx !== i));
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
    const mobileError = phoneDigitsError(renewContactMobile, true);
    if (mobileError) {
      Alert.alert('Validation', mobileError);
      return;
    }
    const rows = renewProducts.filter((r) => r.product_name.trim());
    if (rows.length === 0) {
      Alert.alert('Validation', 'Add at least one product');
      return;
    }
    const invalidRows = rows.some((r) => {
      const strength = Number(r.strength);
      const pct = Number(r.renewal_pct);
      return (
        !Number.isFinite(strength) ||
        strength <= 0 ||
        !Number.isFinite(pct) ||
        pct < 1 ||
        pct > 100
      );
    });
    if (invalidRows) {
      Alert.alert('Validation', 'Each product must have Strength > 0 and Chance % between 1 and 100');
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
        recommendations: renewRecommendations,
        products: rows.map((r) => ({
          product_name: r.product_name.trim(),
          quantity: Number(r.strength) || 1,
          strength: Number(r.strength) || 1,
          term: r.term || 'Term 1',
          unit_price: 0,
          renewal_pct: Number(r.renewal_pct),
          is_from_previous_dc: r.isFromPreviousDc,
        })),
      });
      Alert.alert('Success', 'Renewal lead created');
      setSelectedSchool(null);
      setSchoolQuery('');
      setRenewRemarks('');
      setRenewRecommendations('');
      setRenewProducts([emptyAdditionalLine()]);
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
    setUpdateRecommendations(lead.recommendations || '');
    const pi: RenewProductLine[] =
      Array.isArray(lead.products) && lead.products.length > 0
        ? lead.products.map((p: any) => {
            const pct = p.renewal_pct ?? p.chance;
            const strengthRaw = p.strength ?? p.quantity;
            return {
              product_name: p.product_name || p.product || '',
              term: p.term || 'Term 1',
              strength:
                strengthRaw != null && strengthRaw !== '' && Number.isFinite(Number(strengthRaw))
                  ? Number(strengthRaw)
                  : ('' as const),
              renewal_pct:
                pct != null && pct !== '' && Number.isFinite(Number(pct)) ? Number(pct) : ('' as const),
              isFromPreviousDc: Boolean(p.is_from_previous_dc),
            };
          })
        : [];
    setProductsInterested(pi.length ? pi : [emptyAdditionalLine()]);
    setUpdateOpen(true);
  };

  const updateInterestedProduct = (
    i: number,
    field: keyof RenewProductLine,
    value: string | number | boolean,
  ) => {
    setProductsInterested((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    if (!updateRemarks.trim()) {
      Alert.alert('Validation', 'Remarks is required');
      return;
    }
    const productRows = productsInterested.filter((p) => p.product_name?.trim());
    if (productRows.length === 0) {
      Alert.alert('Validation', 'Add at least one product with Strength and Chance %');
      return;
    }
    const invalidRows = productRows.some((p) => {
      const strength = Number(p.strength);
      const pct = Number(p.renewal_pct);
      return (
        !Number.isFinite(strength) ||
        strength <= 0 ||
        !Number.isFinite(pct) ||
        pct < 1 ||
        pct > 100
      );
    });
    if (invalidRows) {
      Alert.alert('Validation', 'Each product must have Strength > 0 and Chance % between 1 and 100');
      return;
    }
    setUpdating(true);
    try {
      await apiService.put(`/leads/${selectedLead._id}`, {
        follow_up_date: followUpDate.toISOString(),
        priority,
        remarks: updateRemarks,
        recommendations: updateRecommendations,
        productsInterested: productRows.map((p) => ({
          product_name: p.product_name.trim(),
          term: p.term || 'Term 1',
          strength: Number(p.strength),
          renewal_pct: Number(p.renewal_pct),
          chance: Number(p.renewal_pct),
          is_from_previous_dc: p.isFromPreviousDc,
          quantity: Number(p.strength),
          unit_price: 0,
        })),
      });
      Alert.alert('Success', 'Renewal saved');
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
            recommendations: lead.recommendations || '',
            priority: lead.priority || 'Warm',
            updatedAt: lead.createdAt,
            updatedBy: { name: 'System' },
          },
        ];
      }
      historyData.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
      );
      setHistory(historyData);
    } catch {
      Alert.alert('Error', 'Could not load history');
    }
  };

  const renderStrengthChanceInputs = (
    row: RenewProductLine,
    i: number,
    onChange: (i: number, field: keyof RenewProductLine, value: string | number | boolean) => void,
    editable = true,
  ) => (
    <View style={styles.productRowInline}>
      <View style={styles.numField}>
        <WebLabel>Strength</WebLabel>
        <WebInput
          placeholder="—"
          value={row.strength === '' ? '' : String(row.strength)}
          onChangeText={(v) => onChange(i, 'strength', v === '' ? '' : Number(v) || '')}
          keyboardType="number-pad"
          editable={editable}
        />
      </View>
      <View style={styles.numField}>
        <WebLabel>Chance %</WebLabel>
        <WebInput
          placeholder="%"
          value={row.renewal_pct === '' ? '' : String(row.renewal_pct)}
          onChangeText={(v) => onChange(i, 'renewal_pct', v === '' ? '' : Number(v) || '')}
          keyboardType="number-pad"
          editable={editable}
        />
      </View>
    </View>
  );

  return (
    <ScreenShell
      title="Renewal Leads"
      subtitle="Existing schools only — search, minimal input, same pipeline as follow-ups"
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadLeads();
      }}
    >
      <PageSection title="Create renewal lead">
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
            <Text style={styles.selectedTitle}>Selected school</Text>
            {schoolDetailLoading ? <Text style={styles.hint}>Loading full record…</Text> : null}
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>Name: </Text>
              {selectedSchool.school_name}
            </Text>
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>Code: </Text>
              {schoolDisplayCode(selectedSchool)}
            </Text>
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>Zone: </Text>
              {displayField(selectedSchool.zone)}
            </Text>
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>Address: </Text>
              {displayField(selectedSchool.address)}
            </Text>
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>Pincode: </Text>
              {displayField(selectedSchool.pincode)}
              {'  '}
              <Text style={styles.detailLabel}>City: </Text>
              {displayField(selectedSchool.city)}
            </Text>
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>State: </Text>
              {displayField(selectedSchool.state)}
              {'  '}
              <Text style={styles.detailLabel}>Region: </Text>
              {displayField(selectedSchool.region)}
            </Text>
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>Area: </Text>
              {displayField(selectedSchool.area)}
            </Text>
            <Text style={styles.detailLine}>
              <Text style={styles.detailLabel}>Location: </Text>
              {displayField(selectedSchool.location)}
            </Text>
          </View>
        ) : null}

        <WebLabel>Contact person (editable)</WebLabel>
        <WebInput
          placeholder="Contact person"
          value={renewContactPerson}
          onChangeText={setRenewContactPerson}
          editable={!!selectedSchool}
        />
        <WebLabel>Mobile (editable)</WebLabel>
        <WebInput
          value={renewContactMobile}
          onChangeText={(text) => setRenewContactMobile(sanitizePhoneDigits(text))}
          keyboardType="phone-pad"
          maxLength={15}
          placeholder="10 to 15 digits"
          editable={!!selectedSchool}
        />

        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Enter Strength and Chance % manually for each product. Prior DC products have no
            defaults. New products default Chance % to 100%.
          </Text>
        </View>

        {selectedSchool && priorDcProducts.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.sectionLabel}>Previous DC products</Text>
            <Text style={styles.hint}>Enter strength and chance % for each product on file.</Text>
            {renewProducts.map((row, i) =>
              !row.isFromPreviousDc ? null : (
                <View key={`prior-${i}`} style={styles.productRow}>
                  <Text style={styles.productLabel}>
                    {row.product_name}{' '}
                    <Text style={styles.hint}>({row.term})</Text>
                  </Text>
                  {renderStrengthChanceInputs(row, i, updateRenewProduct, !!selectedSchool)}
                  <WebButton
                    title="Remove"
                    variant="outline"
                    onPress={() => removeRenewProduct(i)}
                    disabled={!selectedSchool}
                  />
                </View>
              ),
            )}
          </View>
        ) : null}

        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Additional products</Text>
            <WebButton
              title="Add product"
              variant="outline"
              onPress={() => setRenewProducts((p) => [...p, emptyAdditionalLine()])}
              disabled={!selectedSchool}
            />
          </View>
          {renewProducts.map((row, i) =>
            row.isFromPreviousDc ? null : (
              <View key={`new-${i}`} style={styles.productRow}>
                <WebSelect
                  label="Product"
                  value={row.product_name}
                  onValueChange={(v) => updateRenewProduct(i, 'product_name', v)}
                  items={productNames.map((n) => ({ label: n, value: n }))}
                  placeholder="Product"
                />
                <WebSelect
                  label="Term"
                  value={row.term}
                  onValueChange={(v) => updateRenewProduct(i, 'term', v)}
                  items={TERMS}
                />
                {renderStrengthChanceInputs(row, i, updateRenewProduct, !!selectedSchool)}
                {additionalProducts.length > 1 ? (
                  <WebButton
                    title="Remove"
                    variant="outline"
                    onPress={() => removeRenewProduct(i)}
                    disabled={!selectedSchool}
                  />
                ) : null}
              </View>
            ),
          )}
          {selectedSchool && additionalProducts.length === 0 && priorDcProducts.length > 0 ? (
            <Text style={styles.hint}>Use Add product for new lines (defaults to 100%).</Text>
          ) : null}
        </View>

        <WebLabel>Notes</WebLabel>
        <WebInput
          placeholder="Optional context for this renewal…"
          value={renewRemarks}
          onChangeText={setRenewRemarks}
          multiline
          style={{ minHeight: 60 }}
          editable={!!selectedSchool}
        />
        <WebLabel>Recommendations</WebLabel>
        <WebInput
          placeholder="Renewal recommendations for this school…"
          value={renewRecommendations}
          onChangeText={setRenewRecommendations}
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
        <WebButton
          title="New school? Use Add Lead"
          variant="outline"
          onPress={() => navigateRoot('LeadAdd')}
        />
      </PageSection>

      <PageSection title="Filters">
        <WebSelect
          label="Zone"
          value={zoneFilter}
          onValueChange={setZoneFilter}
          placeholder="All Zones"
          items={[
            { label: 'All Zones', value: 'all' },
            ...zones.map((z) => ({ label: z, value: z })),
          ]}
        />
        <WebLabel>School Name</WebLabel>
        <WebInput placeholder="Filter…" value={schoolFilter} onChangeText={setSchoolFilter} />
        <WebLabel>Contact Mobile</WebLabel>
        <WebInput
          placeholder="Filter…"
          value={mobileFilter}
          onChangeText={setMobileFilter}
          keyboardType="phone-pad"
        />
        <WebButton
          title="Refresh"
          variant="outline"
          onPress={() => {
            setRefreshing(true);
            loadLeads();
          }}
        />
      </PageSection>

      <PageSection title={`Active leads (${leads.length})`}>
        {leads.map((lead) => {
          const pColor = priorityColor(lead.priority);
          const followUpPast =
            lead.follow_up_date && new Date(lead.follow_up_date).getTime() < Date.now();
          return (
            <View key={lead._id} style={styles.leadCard}>
              <View style={styles.leadHeader}>
                <View style={styles.leadTitleRow}>
                  <Text style={styles.leadTitle}>{lead.school_name || '—'}</Text>
                  <View style={styles.renewalBadge}>
                    <Text style={styles.renewalBadgeText}>Renewal</Text>
                  </View>
                </View>
                <Text style={styles.codeText}>Code: {leadSchoolCode(lead)}</Text>
                {lead.location ? <Text style={styles.hint}>{lead.location}</Text> : null}
              </View>

              <View style={styles.metaGrid}>
                <Text style={styles.metaLine}>
                  <Text style={styles.detailLabel}>Contact: </Text>
                  {lead.contact_person || '—'}
                </Text>
                <Text style={styles.metaLine}>
                  <Text style={styles.detailLabel}>Mobile: </Text>
                  {lead.contact_mobile || '—'}
                </Text>
                {lead.remarks ? (
                  <Text style={styles.metaLine}>
                    <Text style={styles.detailLabel}>Remarks: </Text>
                    {lead.remarks}
                  </Text>
                ) : null}
                {lead.recommendations ? (
                  <Text style={styles.metaLine}>
                    <Text style={styles.detailLabel}>Recommendations: </Text>
                    {lead.recommendations}
                  </Text>
                ) : null}
                {lead.follow_up_date ? (
                  <Text style={[styles.metaLine, followUpPast ? styles.overdue : null]}>
                    <Text style={styles.detailLabel}>Follow up: </Text>
                    {new Date(lead.follow_up_date).toLocaleString()}
                  </Text>
                ) : null}
                <View style={styles.priorityRow}>
                  <Text style={styles.detailLabel}>Priority: </Text>
                  <View style={[styles.priorityChip, { backgroundColor: pColor.bg }]}>
                    <Text style={[styles.priorityChipText, { color: pColor.text }]}>
                      {lead.priority || 'Warm'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.metaLine}>
                  <Text style={styles.detailLabel}>Status: </Text>
                  {lead.status || '—'}
                </Text>
                {Array.isArray(lead.products) && lead.products.length > 0 ? (
                  <View style={styles.productChips}>
                    {lead.products.map((p: any, idx: number) => {
                      const name = p.product_name || p.product || 'Product';
                      const meta = formatRenewalProductMeta(p);
                      return (
                        <View key={idx} style={styles.productChip}>
                          <Text style={styles.productChipText}>
                            {name}
                            {meta ? ` · ${meta}` : ''}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <View style={styles.leadActions}>
                <WebButton
                  title="Close Lead"
                  variant="outline"
                  onPress={() => navigateRoot('LeadClose', { id: lead._id })}
                />
                <WebButton
                  title="Edit Details"
                  variant="outline"
                  onPress={() => navigateRoot('LeadEdit', { id: lead._id })}
                />
                <WebButton title="Create Renewal" onPress={() => openUpdateModal(lead)} />
                <WebButton
                  title="View History"
                  variant="outline"
                  onPress={() => openHistoryModal(lead)}
                />
              </View>
            </View>
          );
        })}
        {leads.length === 0 ? (
          <Text style={styles.hint}>
            {allLeads.length === 0
              ? 'No active renewal leads. Create one above or check Closed in reports.'
              : 'No leads match filters.'}
          </Text>
        ) : null}
      </PageSection>

      <Modal visible={updateOpen} animationType="slide" transparent onRequestClose={() => setUpdateOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Create renewal</Text>
            <Text style={styles.hint}>Log renewal interaction for this lead</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateBtn}>
                Follow-up date *: {followUpDate.toLocaleDateString()}
              </Text>
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
            <WebSelect label="Priority *" value={priority} onValueChange={setPriority} items={PRIORITIES} />

            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>Products interested *</Text>
              <WebButton
                title="Add"
                variant="outline"
                onPress={() => setProductsInterested((p) => [...p, emptyAdditionalLine()])}
              />
            </View>
            <Text style={styles.hint}>
              Enter Strength and Chance % (1–100) for each product. New lines default Chance % to
              100%.
            </Text>
            {productsInterested.map((row, i) => (
              <View key={`up-${i}`} style={styles.productRow}>
                {row.isFromPreviousDc ? (
                  <Text style={styles.productLabel}>
                    {row.product_name} <Text style={styles.priorTag}>(prior DC)</Text>
                  </Text>
                ) : (
                  <WebSelect
                    label="Product"
                    value={row.product_name}
                    onValueChange={(v) => updateInterestedProduct(i, 'product_name', v)}
                    items={productNames.map((n) => ({ label: n, value: n }))}
                    placeholder="Product"
                  />
                )}
                <WebSelect
                  label="Term"
                  value={row.term}
                  onValueChange={(v) => updateInterestedProduct(i, 'term', v)}
                  items={TERMS}
                />
                {renderStrengthChanceInputs(row, i, updateInterestedProduct)}
                <WebButton
                  title="Remove"
                  variant="outline"
                  onPress={() =>
                    setProductsInterested((p) => p.filter((_, idx) => idx !== i))
                  }
                />
              </View>
            ))}

            <WebLabel>Recommendations</WebLabel>
            <WebInput
              placeholder="Renewal recommendations for this school…"
              value={updateRecommendations}
              onChangeText={setUpdateRecommendations}
              multiline
              style={{ minHeight: 70 }}
            />
            <WebLabel>Remarks *</WebLabel>
            <WebInput
              placeholder="Interaction notes for this renewal…"
              value={updateRemarks}
              onChangeText={setUpdateRemarks}
              multiline
              style={{ minHeight: 70 }}
            />
            <View style={styles.modalFooter}>
              <WebButton title="Cancel" variant="outline" onPress={() => setUpdateOpen(false)} />
              <WebButton
                title={updating ? 'Creating…' : 'Create renewal'}
                onPress={handleUpdateLead}
                loading={updating}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalBox}>
            <Text style={styles.modalTitle}>Update history</Text>
            <Text style={styles.hint}>{historyLead?.school_name}</Text>
            {history.length === 0 ? <Text style={styles.hint}>No history entries.</Text> : null}
            {history.map((h, i) => (
              <View key={i} style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {h.updatedAt ? new Date(h.updatedAt).toLocaleString() : '—'}
                </Text>
                {h.priority ? <Text>Priority: {h.priority}</Text> : null}
                {h.recommendations ? (
                  <Text style={styles.metaLine}>
                    <Text style={styles.detailLabel}>Recommendations: </Text>
                    {h.recommendations}
                  </Text>
                ) : null}
                {h.remarks ? <Text style={{ marginTop: 4 }}>{h.remarks}</Text> : null}
                {h.follow_up_date ? (
                  <Text style={styles.hint}>
                    Next: {new Date(h.follow_up_date).toLocaleDateString()}
                  </Text>
                ) : null}
                {Array.isArray(h.productsInterested) && h.productsInterested.length > 0
                  ? h.productsInterested.map((p: any, j: number) => {
                      const name = p.product_name || p.product || 'Product';
                      const term = p.term ? ` (${p.term})` : '';
                      const meta = formatRenewalProductMeta(p);
                      return (
                        <Text key={j} style={styles.hint}>
                          {name}
                          {term}
                          {meta ? ` — ${meta}` : ''}
                        </Text>
                      );
                    })
                  : null}
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
    marginVertical: 12,
  },
  infoBannerText: { fontSize: 13, color: '#854D0E', lineHeight: 18 },
  hint: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  block: { marginTop: 8, marginBottom: 8 },
  sectionLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  productRowInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' },
  numField: { width: 100 },
  searchHit: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchName: { fontWeight: '600', color: colors.textPrimary },
  selectedBox: {
    padding: 12,
    backgroundColor: colors.successLight,
    borderRadius: 8,
    marginVertical: 8,
    gap: 4,
  },
  selectedTitle: { fontWeight: '600', color: '#166534', marginBottom: 4 },
  detailLine: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  detailLabel: { color: colors.textSecondary },
  productRow: { marginVertical: 8, gap: 8 },
  productLabel: { fontWeight: '500', marginBottom: 4, color: colors.textPrimary },
  priorTag: { color: '#15803D', fontWeight: '500', fontSize: 12 },
  leadCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  leadHeader: { gap: 4 },
  leadTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  leadTitle: { fontSize: 17, fontWeight: '700', color: '#15803D' },
  renewalBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  renewalBadgeText: { fontSize: 11, fontWeight: '600', color: '#166534' },
  codeText: { fontSize: 12, color: colors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  metaGrid: { gap: 4 },
  metaLine: { fontSize: 13, color: colors.textPrimary },
  overdue: { color: colors.error, fontWeight: '600' },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  priorityChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityChipText: { fontSize: 12, fontWeight: '600' },
  productChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  productChip: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  productChipText: { fontSize: 11, color: '#065F46' },
  leadActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 24 },
  dateBtn: { color: colors.primary, marginVertical: 12, fontWeight: '500' },
  historyItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyDate: { fontWeight: '600', marginBottom: 4 },
});
