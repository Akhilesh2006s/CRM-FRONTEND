import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { useAuth } from '../../context/AuthContext';
import { LEAD_PRODUCT_STATUSES, validateLeadStyleProducts } from '../../lib/crm/leadProductRules';

import { ymdToDmy } from '../../utils/dateFormat';
const SCHOOL_TYPE_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Existing', value: 'Existing' },
];
const PRIORITY_OPTIONS = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Visit Again', value: 'Visit Again' },
  { label: 'Yet to Visit', value: 'Yet to Visit' },
  { label: 'Not Interested', value: 'Not Interested' },
];

const PRODUCT_STATUS_OPTIONS = LEAD_PRODUCT_STATUSES.map((s) => ({ label: s, value: s }));

type ProductStatus = 'Hot' | 'Warm' | 'Not Interested' | 'Yet to Visit' | 'Visit Again';

/** Same shape as the web edit page; numbers kept as strings so empty fields stay empty. */
type ProductSelection = {
  name: string;
  checked: boolean;
  term: string;
  status: ProductStatus;
  strength: string;
  unit_price: string;
  chance: string;
  not_interested_reason: string;
};

type SavedProductRow = {
  product_name?: string;
  product?: string;
  term?: string;
  status?: string;
  strength?: number;
  chance?: number;
  quantity?: number;
  unit_price?: number;
  not_interested_reason?: string;
};

function parseFollowUpDate(s: string): string | undefined {
  if (!s?.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function apiStatusToUi(status?: string): ProductStatus {
  const s = (status || 'Warm').trim();
  if (s === 'Not Met Management' || s === 'Management Not Met') return 'Yet to Visit';
  if (s === 'Hot' || s === 'Warm' || s === 'Not Interested' || s === 'Yet to Visit' || s === 'Visit Again') {
    return s;
  }
  return 'Warm';
}

function numericFieldToString(value?: number): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

/** Digits only, no leading zeros, optionally capped (web normalizeIntegerInput). */
function normalizeIntegerInput(raw: string, max?: number): string {
  let value = String(raw || '').replace(/\D/g, '');
  if (value.length > 1) value = value.replace(/^0+/, '') || '0';
  if (value && max !== undefined && Number(value) > max) value = String(max);
  return value;
}

function parseLeadProductsToMap(products: any): Map<string, SavedProductRow> {
  const map = new Map<string, SavedProductRow>();
  if (!products) return map;
  let rows: unknown[] = [];
  if (Array.isArray(products)) {
    rows = products;
  } else if (typeof products === 'string') {
    const productsStr = products.trim();
    if (!productsStr) return map;
    try {
      const parsed = JSON.parse(productsStr);
      if (Array.isArray(parsed)) rows = parsed;
      else rows = productsStr.split(',').map((x) => x.trim()).filter(Boolean);
    } catch {
      rows = productsStr.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  for (const raw of rows) {
    if (typeof raw === 'string') {
      const name = raw.trim();
      if (name) map.set(name, { product_name: name });
      continue;
    }
    if (raw && typeof raw === 'object') {
      const row = raw as SavedProductRow;
      const name = String(row.product_name || row.product || '').trim();
      if (name) map.set(name, row);
    }
  }
  return map;
}

function defaultProductRow(name: string, saved?: SavedProductRow): ProductSelection {
  if (saved) {
    return {
      name,
      checked: true,
      term: saved.term || 'Term 1',
      status: apiStatusToUi(saved.status),
      strength: numericFieldToString(saved.strength ?? saved.quantity),
      unit_price: numericFieldToString(saved.unit_price),
      chance: numericFieldToString(saved.chance),
      not_interested_reason: saved.not_interested_reason || '',
    };
  }
  // All products pre-selected / locked (as on the web)
  return {
    name,
    checked: true,
    term: 'Term 1',
    status: 'Warm',
    strength: '',
    unit_price: '',
    chance: '',
    not_interested_reason: '',
  };
}

/** Lead priority = the strongest product status (Hot > Warm > Visit Again > Yet to Visit > Not Interested). Same as web edit page. */
function leadPriorityFromProducts(products: unknown): string {
  if (!Array.isArray(products)) return '';
  const order = ['Hot', 'Warm', 'Visit Again', 'Yet to Visit', 'Not Interested'];
  const alias: Record<string, string> = {
    Renewed: 'Hot',
    'Not Renewed': 'Not Interested',
    'Not Met Management': 'Yet to Visit',
    'Management Not Met': 'Yet to Visit',
  };
  let best = order.length;
  for (const p of products) {
    const raw = String((p as { status?: string })?.status || '').trim();
    const i = order.indexOf(alias[raw] || raw);
    if (i !== -1 && i < best) best = i;
  }
  return best < order.length ? order[best] : '';
}

export default function LeadEditScreen({ navigation, route }: any) {
  const { id } = route.params;
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';
  const [bdeOptions, setBdeOptions] = useState<Array<{ _id: string; name: string }>>([]);
  /** Web loads /leads/:id first, then /dc-orders/:id, and saves back to the same record. */
  const [recordSource, setRecordSource] = useState<'leads' | 'dc-orders'>('dc-orders');
  const [form, setForm] = useState({
    school_name: '',
    school_type: 'New',
    contact_person: '',
    contact_mobile: '',
    contact_designation: '',
    financial_contact_designation: '',
    cluster_code: '',
    assigned_to: '',
    email: '',
    decision_maker_name: '',
    decision_maker_mobile: '',
    location: '',
    city: '',
    address: '',
    pincode: '',
    state: '',
    region: '',
    area: '',
    mandal: '',
    cluster: '',
    latitude: '',
    longitude: '',
    priority: 'Warm',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
  });
  const [products, setProducts] = useState<ProductSelection[]>([]);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const [savedProducts, setSavedProducts] = useState<Map<string, SavedProductRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadProducts();
    loadLead();
  }, [id]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    Promise.all(
      ['Executive', 'Sales BDE', 'Employee'].map((role) =>
        apiService.get(`/employees?isActive=true&role=${encodeURIComponent(role)}`).catch(() => []),
      ),
    ).then((groups) => {
      const byId = new Map<string, { _id: string; name: string }>();
      for (const e of groups.flat() as any[]) {
        if (e?._id && e?.name) byId.set(String(e._id), { _id: String(e._id), name: String(e.name) });
      }
      setBdeOptions([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)));
    });
  }, [isSuperAdmin]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      let data: any;
      try {
        data = await apiService.get('/products/active');
      } catch {
        data = await apiService.get('/products');
      }
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      const names = list
        .filter((p: any) => p.prodStatus !== 0 && p.prodStatus !== false)
        .map((p: any) =>
          typeof p === 'string'
            ? p
            : p.productName || p.name || p.product_name || '',
        )
        .map((n: string) => String(n).trim())
        .filter(Boolean);
      // Unique preserve order
      setCatalogNames(Array.from(new Set(names)));
    } catch (err) {
      console.error('Failed to load products:', err);
      setCatalogNames([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // One row per catalog product (all pre-selected), filled from the saved lead line of the same name.
  useEffect(() => {
    if (catalogNames.length === 0) return;
    const saved = savedProducts || new Map<string, SavedProductRow>();
    const byLower = new Map([...saved.entries()].map(([k, v]) => [k.toLowerCase(), v] as const));
    setProducts(
      catalogNames.map((name) => defaultProductRow(name, saved.get(name) || byLower.get(name.toLowerCase()))),
    );
  }, [catalogNames, savedProducts]);

  const loadLead = async () => {
    try {
      setLoading(true);

      const pickNum = (...vals: any[]) => {
        for (const v of vals) {
          if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
        }
        return '';
      };

      const softGet = async (path: string) => {
        try {
          return await apiService.get(path);
        } catch {
          return null;
        }
      };

      // Follow-up list mixes Lead + DcOrder ids — try both and merge fee/branches/strength.
      const [fromOrder, fromLead] = await Promise.all([
        softGet(`/dc-orders/${id}`),
        softGet(`/leads/${id}`),
      ]);
      const lead: any = fromOrder || fromLead;
      if (!lead) {
        throw new Error('Failed to load lead');
      }
      const record: any = fromLead || fromOrder;
      setRecordSource(fromLead ? 'leads' : 'dc-orders');

      let school: any =
        lead.school_id && typeof lead.school_id === 'object' ? lead.school_id : null;
      const schoolIdRaw =
        (fromLead?.school_id && typeof fromLead.school_id === 'object'
          ? fromLead.school_id._id
          : fromLead?.school_id) ||
        (typeof lead.school_id === 'string' || typeof lead.school_id === 'number'
          ? lead.school_id
          : null);
      if (
        schoolIdRaw &&
        (!school || school.average_fee == null || school.average_fee === '')
      ) {
        const linked = await softGet(`/dc-orders/${schoolIdRaw}`);
        if (linked) school = { ...(school || {}), ...linked };
      }

      const followRaw =
        lead.follow_up_date ||
        fromOrder?.follow_up_date ||
        fromLead?.follow_up_date ||
        lead.estimated_delivery_date ||
        '';
      let followStr = '';
      if (followRaw) {
        try {
          followStr = new Date(followRaw).toISOString().split('T')[0];
        } catch {
          followStr = '';
        }
      }

      setForm({
        school_name: lead.school_name || school?.school_name || '',
        school_type: lead.school_type || school?.school_type || 'New',
        contact_person: lead.contact_person || school?.contact_person || '',
        contact_mobile: lead.contact_mobile || school?.contact_mobile || '',
        contact_designation: record.contact_designation || lead.contact_designation || '',
        financial_contact_designation:
          record.financial_contact_designation || lead.financial_contact_designation || '',
        cluster_code: record.cluster_code || record.cluster || lead.cluster || '',
        assigned_to:
          typeof record.assigned_to === 'string' ? record.assigned_to : record.assigned_to?._id || '',
        email: lead.email || school?.email || '',
        decision_maker_name:
          lead.decision_maker ||
          lead.decision_maker_name ||
          lead.contact_person2 ||
          school?.contact_person2 ||
          '',
        decision_maker_mobile:
          lead.decision_maker_mobile || lead.contact_mobile2 || school?.contact_mobile2 || '',
        location: lead.location || school?.location || '',
        city: lead.city || school?.city || '',
        address: lead.address || school?.address || '',
        pincode: lead.pincode || school?.pincode || '',
        state: lead.state || school?.state || '',
        region: lead.region || school?.region || '',
        area: lead.area || school?.area || '',
        mandal: lead.mandal || school?.mandal || '',
        cluster: lead.cluster || school?.cluster || '',
        latitude:
          lead.latitude != null
            ? String(lead.latitude)
            : school?.latitude != null
              ? String(school.latitude)
              : '',
        longitude:
          lead.longitude != null
            ? String(lead.longitude)
            : school?.longitude != null
              ? String(school.longitude)
              : '',
        priority:
          leadPriorityFromProducts(record.products) || record.lead_status || record.priority || 'Warm',
        zone: lead.zone || school?.zone || '',
        branches: pickNum(
          fromOrder?.branches,
          fromLead?.no_of_branches,
          fromLead?.branches,
          lead.no_of_branches,
          lead.branches,
          school?.branches,
        ),
        strength: pickNum(fromOrder?.strength, fromLead?.strength, lead.strength, school?.strength),
        remarks: lead.remarks || school?.remarks || '',
        average_fee: pickNum(
          fromOrder?.average_fee,
          fromLead?.avg_fee,
          fromLead?.average_fee,
          lead.avg_fee,
          lead.average_fee,
          school?.average_fee,
        ),
        follow_up_date: followStr,
      });

      setSavedProducts(parseLeadProductsToMap(record.products));
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = (index: number, patch: Partial<ProductSelection>) => {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  // Products cannot be deselected (all are required, as on the web).

  const handleProductStatusChange = (index: number, status: ProductStatus) => {
    setProducts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        const next = { ...p, status };
        if (status !== 'Hot' && status !== 'Warm') {
          next.strength = '';
          next.unit_price = '';
          next.chance = status === 'Not Interested' ? '0' : '';
        }
        if (status !== 'Not Interested') next.not_interested_reason = '';
        return next;
      }),
    );
  };

  const handleProductUnitPriceChange = (index: number, raw: string) => {
    let value = String(raw || '').replace(/[^\d.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) value = `${parts[0]}.${parts.slice(1).join('')}`;
    if (value.startsWith('.')) value = `0${value}`;
    updateProduct(index, { unit_price: value });
  };

  const fail = (message: string) => {
    setErrorMessage(message);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);

    const contactError = phoneDigitsError(form.contact_mobile, true);
    if (contactError) return fail(contactError);
    const decisionError = phoneDigitsError(form.decision_maker_mobile, true);
    if (decisionError) return fail(decisionError);

    const selectedProducts = products.filter((p) => p.checked);
    if (selectedProducts.length === 0) return fail('All products must be included.');
    const productError = validateLeadStyleProducts(selectedProducts);
    if (productError) return fail(productError);

    const productsPayload = selectedProducts.map((p) => {
      const strengthNum = Number(p.strength) || 0;
      const hotOrWarm = p.status === 'Hot' || p.status === 'Warm';
      return {
        product_name: p.name,
        quantity: strengthNum > 0 ? strengthNum : 1,
        unit_price: hotOrWarm ? Number(p.unit_price) || 0 : 0,
        term: p.term || 'Term 1',
        status: p.status,
        strength: strengthNum,
        chance: hotOrWarm ? Number(p.chance) || 0 : 0,
        not_interested_reason: p.status === 'Not Interested' ? p.not_interested_reason.trim() : '',
      };
    });

    if (!form.decision_maker_name?.trim()) return fail('Financial contact person name is required');
    if (!form.contact_designation.trim() || !form.financial_contact_designation.trim()) {
      return fail('Both contact designations are required');
    }
    if (!form.decision_maker_mobile?.trim()) return fail('Financial contact mobile is required');
    if (!form.area?.trim()) return fail('Area is required. Please enter pincode and select an area.');
    if (!form.average_fee?.trim()) return fail('Average School Fee is required');
    if (!form.branches?.trim()) return fail('No. of Branches is required');
    if (!form.strength?.trim()) return fail('School Strength is required');
    if (!form.remarks?.trim()) return fail('Remarks is required');

    setSubmitting(true);
    try {
      // Same payload as the web edit page.
      const payload: any = {
        school_name: form.school_name,
        school_type: form.school_type || undefined,
        contact_person: form.contact_person,
        contact_mobile: form.contact_mobile,
        contact_person2: form.decision_maker_name || undefined,
        contact_mobile2: form.decision_maker_mobile || undefined,
        contact_designation: form.contact_designation.trim(),
        financial_contact_designation: form.financial_contact_designation.trim(),
        location: form.location,
        address: form.address || undefined,
        pincode: form.pincode || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        mandal: form.mandal || undefined,
        cluster: form.cluster || undefined,
        cluster_code: form.cluster || form.cluster_code || undefined,
        assigned_to: form.assigned_to || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        zone: form.zone,
        priority: form.priority || 'Warm',
        branches: form.branches ? Number(form.branches) : undefined,
        no_of_branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        remarks: form.remarks || undefined,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        avg_fee: form.average_fee ? Number(form.average_fee) : undefined,
        email: form.email,
        products: productsPayload,
        follow_up_date: parseFollowUpDate(form.follow_up_date),
      };

      const updatePath = recordSource === 'leads' ? `/leads/${id}` : `/dc-orders/${id}`;
      await apiService.put(updatePath, payload);

      setSuccessMessage('Lead details updated successfully.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update lead');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading lead...</Text>
      </View>
    );
  }

  return (
    <ScreenShell title="Edit Lead Details">
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="Back to Follow-up"
            onAction={() => navigation.navigate('LeadFollowup')}
          />
        )}
        {errorMessage && (
          <MessageBanner
            type="error"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {isSuperAdmin ? (
          <WebSelect
            label="Assign to (BDE)"
            value={form.assigned_to}
            onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
            items={bdeOptions.map((b) => ({ label: b.name, value: b._id }))}
            placeholder="Select BDE"
          />
        ) : null}
        <FormField
          label="School name *"
          value={form.school_name}
          onChangeText={(text) => setForm((f) => ({ ...f, school_name: text }))}
        />
        <WebSelect
          label="School Type"
          value={form.school_type}
          onValueChange={(v) => setForm((f) => ({ ...f, school_type: v }))}
          items={SCHOOL_TYPE_OPTIONS}
        />
        <FormField
          label="Contact person *"
          value={form.contact_person}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_person: text }))}
        />
        <FormField
          label="Contact mobile *"
          value={form.contact_mobile}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_mobile: sanitizePhoneDigits(text) }))}
          keyboardType="phone-pad"
          placeholder="10 to 15 digits"
          maxLength={15}
        />
        <FormField
          label="School contact designation *"
          value={form.contact_designation}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_designation: text }))}
          placeholder="e.g. Principal"
        />
        <FormField
          label="Email"
          value={form.email}
          onChangeText={(text) => setForm((f) => ({ ...f, email: text }))}
        />
        <FormField
          label="Financial contact person *"
          value={form.decision_maker_name}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_name: text }))}
        />
        <FormField
          label="Financial contact mobile *"
          value={form.decision_maker_mobile}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_mobile: sanitizePhoneDigits(text) }))}
          keyboardType="phone-pad"
          placeholder="10 to 15 digits"
          maxLength={15}
        />
        <FormField
          label="Financial contact designation *"
          value={form.financial_contact_designation}
          onChangeText={(text) => setForm((f) => ({ ...f, financial_contact_designation: text }))}
          placeholder="e.g. Accountant"
        />
        <FormField
          label="Landmark"
          value={form.location}
          onChangeText={(text) => setForm((f) => ({ ...f, location: text }))}
        />
        <FormField
          label="Pincode"
          value={form.pincode}
          onChangeText={(text) => setForm((f) => ({ ...f, pincode: text }))}
          keyboardType="number-pad"
        />
        <FormField
          label="State"
          value={form.state}
          onChangeText={(text) => setForm((f) => ({ ...f, state: text }))}
        />
        <FormField
          label="City"
          value={form.city}
          onChangeText={(text) => setForm((f) => ({ ...f, city: text }))}
        />
        <FormField
          label="Area *"
          value={form.area}
          onChangeText={(text) => setForm((f) => ({ ...f, area: text }))}
        />
        <View style={styles.textAreaContainer}>
          <Text style={styles.label}>Address</Text>
          <WebInput
            style={styles.textArea}
            value={form.address}
            onChangeText={(text) => setForm((f) => ({ ...f, address: text }))}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products * (all required — cannot deselect)</Text>
          {loadingProducts ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : products.length === 0 ? (
            <View>
              <Text style={styles.hint}>No products available from catalog.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadProducts}>
                <Text style={styles.retryBtnText}>Retry loading products</Text>
              </TouchableOpacity>
            </View>
          ) : (
            products.map((product, index) => {
              const hotOrWarm = product.status === 'Hot' || product.status === 'Warm';
              return (
                <View key={`${product.name}-${index}`} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <View style={[styles.checkbox, styles.checkboxSelected]}>
                      <Text style={styles.checkboxMark}>✓</Text>
                    </View>
                    <Text style={styles.productName}>{product.name}</Text>
                  </View>
                  <View style={styles.productFields}>
                    <WebSelect
                      label="Status *"
                      value={product.status}
                      onValueChange={(v) => handleProductStatusChange(index, v as ProductStatus)}
                      items={PRODUCT_STATUS_OPTIONS}
                    />
                    <FormField
                      label={hotOrWarm ? 'Strength *' : 'Strength'}
                      value={product.strength}
                      onChangeText={(text) => updateProduct(index, { strength: normalizeIntegerInput(text) })}
                      placeholder={hotOrWarm ? 'Qty' : '—'}
                      keyboardType="number-pad"
                      editable={hotOrWarm}
                    />
                    <FormField
                      label={hotOrWarm ? 'Unit Price (₹) *' : 'Unit Price (₹)'}
                      value={product.unit_price}
                      onChangeText={(text) => handleProductUnitPriceChange(index, text)}
                      placeholder={hotOrWarm ? '0' : '—'}
                      keyboardType="number-pad"
                      editable={hotOrWarm}
                    />
                    <FormField
                      label={hotOrWarm ? 'Chance % *' : 'Chance %'}
                      value={product.status === 'Not Interested' ? '0' : product.chance}
                      onChangeText={(text) => updateProduct(index, { chance: normalizeIntegerInput(text, 100) })}
                      placeholder={product.status === 'Hot' ? '80-100' : product.status === 'Warm' ? '20+' : '—'}
                      keyboardType="number-pad"
                      editable={hotOrWarm}
                    />
                    {product.status === 'Not Interested' ? (
                      <FormField
                        label="Reason not interested *"
                        value={product.not_interested_reason}
                        onChangeText={(text) => updateProduct(index, { not_interested_reason: text })}
                        placeholder="Why is the school not interested?"
                      />
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
          <Text style={styles.hint}>
            All products are required. Choose a status for each. Strength, Unit Price, and Chance % are required only for Hot and Warm.
          </Text>
        </View>

        <FormField
          label="Average School Fee *"
          value={form.average_fee}
          onChangeText={(text) => setForm((f) => ({ ...f, average_fee: text }))}
          placeholder="Enter average school fee"
          keyboardType="number-pad"
        />
        <FormField
          label="No. of Branches *"
          value={form.branches}
          onChangeText={(text) => setForm((f) => ({ ...f, branches: text }))}
          placeholder="Enter number of branches"
          keyboardType="number-pad"
        />
        <FormField
          label="Mandal"
          value={form.mandal}
          onChangeText={(text) => setForm((f) => ({ ...f, mandal: text }))}
          placeholder="Enter mandal"
        />
        <FormField
          label="Cluster"
          value={form.cluster}
          onChangeText={(text) => setForm((f) => ({ ...f, cluster: text }))}
          placeholder="Enter cluster"
        />
        <FormField
          label="Latitude"
          value={form.latitude}
          onChangeText={(text) => setForm((f) => ({ ...f, latitude: text }))}
          placeholder="e.g. 17.3850"
          keyboardType="decimal-pad"
        />
        <FormField
          label="Longitude"
          value={form.longitude}
          onChangeText={(text) => setForm((f) => ({ ...f, longitude: text }))}
          placeholder="e.g. 78.4867"
          keyboardType="decimal-pad"
        />
        <FormField
          label="School Strength *"
          value={form.strength}
          onChangeText={(text) => setForm((f) => ({ ...f, strength: text }))}
          placeholder="Enter total strength"
          keyboardType="number-pad"
        />
        <View style={styles.textAreaContainer}>
          <Text style={styles.label}>Remarks *</Text>
          <WebInput
            style={styles.textArea}
            value={form.remarks}
            onChangeText={(text) => setForm((f) => ({ ...f, remarks: text }))}
            multiline
            numberOfLines={4}
          />
        </View>

        <WebSelect
          label="Priority *"
          value={form.priority}
          onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
          items={PRIORITY_OPTIONS}
        />
        <FormField
          label="Zone"
          value={form.zone}
          onChangeText={(text) => setForm((f) => ({ ...f, zone: text }))}
        />

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Follow-up date</Text>
          <TouchableOpacity
            style={styles.dateTouchable}
            onPress={() => setShowFollowUpDatePicker(true)}
          >
            <Text style={[styles.dateText, !form.follow_up_date && styles.datePlaceholder]}>
              {ymdToDmy(form.follow_up_date) || 'Tap to pick date'}
            </Text>
            <Text>📅</Text>
          </TouchableOpacity>
        </View>

        {showFollowUpDatePicker && (
          <Modal visible transparent animationType="slide">
            <TouchableOpacity
              style={styles.dateOverlay}
              activeOpacity={1}
              onPress={() => setShowFollowUpDatePicker(false)}
            />
            <View style={styles.datePickerBox}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Follow-up date</Text>
                <TouchableOpacity onPress={() => setShowFollowUpDatePicker(false)}>
                  <Text style={styles.doneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={form.follow_up_date ? new Date(`${form.follow_up_date}T12:00:00`) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                onChange={(_, d) => {
                  if (d) {
                    // Local calendar day (toISOString would shift to the previous day in IST).
                    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    setForm((f) => ({
                      ...f,
                      follow_up_date: ymd,
                    }));
                  }
                  if (Platform.OS === 'android') setShowFollowUpDatePicker(false);
                }}
              />
            </View>
          </Modal>
        )}

        <WebButton
          title={submitting ? 'Updating...' : 'Update Lead Details'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
        />
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  editable = true,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'decimal-pad';
  placeholder?: string;
  editable?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        editable={editable}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.body.small, color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.7 },
  textAreaContainer: { marginBottom: 16 },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { marginBottom: 16 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  hint: { ...typography.body.small, color: colors.textSecondary, marginTop: 8 },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    alignSelf: 'flex-start',
  },
  retryBtnText: { ...typography.body.small, color: colors.primary, fontWeight: '600' },
  productCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.backgroundLight,
  },
  productHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  productFields: { gap: 4, marginTop: 4 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.backgroundLight,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.textLight, fontSize: 14, fontWeight: 'bold' },
  productName: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  datePlaceholder: { color: colors.textSecondary },
  dateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  datePickerBox: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: { ...typography.heading.h3, color: colors.textPrimary },
  doneText: { color: colors.primary, fontWeight: '600' },
});
