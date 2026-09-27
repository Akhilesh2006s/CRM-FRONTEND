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

const SCHOOL_TYPE_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Existing', value: 'Existing' },
];
const PRIORITY_OPTIONS = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Visit Again', value: 'Visit Again' },
  { label: 'Not Met Management', value: 'Not Met Management' },
  { label: 'Not Interested', value: 'Not Interested' },
];

const PRODUCT_STATUS_OPTIONS = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Not Interested', value: 'Not Interested' },
  { label: 'Management Not Met', value: 'Management Not Met' },
  { label: 'Visit Again', value: 'Visit Again' },
];

type ProductStatus =
  | 'Hot'
  | 'Warm'
  | 'Not Interested'
  | 'Management Not Met'
  | 'Visit Again';

type ProductSelection = {
  name: string;
  checked: boolean;
  status: ProductStatus;
  strength: number;
  chance: number;
};

type LeadProductDetail = {
  name: string;
  status: ProductStatus;
  strength: number;
  chance: number;
};

function parseFollowUpDate(s: string): string | undefined {
  if (!s?.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function normalizeProductStatus(raw: any): ProductStatus {
  const s = String(raw || '').trim();
  const allowed: ProductStatus[] = [
    'Hot',
    'Warm',
    'Not Interested',
    'Management Not Met',
    'Visit Again',
  ];
  return (allowed.includes(s as ProductStatus) ? s : 'Warm') as ProductStatus;
}

function extractLeadProducts(products: any): LeadProductDetail[] {
  if (!products) return [];
  let list: any[] = [];
  if (Array.isArray(products)) {
    list = products;
  } else if (typeof products === 'string' && products.trim()) {
    try {
      const parsed = JSON.parse(products);
      if (Array.isArray(parsed)) list = parsed;
      else {
        return products
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
          .map((name) => ({ name, status: 'Warm' as ProductStatus, strength: 0, chance: 0 }));
      }
    } catch {
      return products
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((name) => ({ name, status: 'Warm' as ProductStatus, strength: 0, chance: 0 }));
    }
  }
  return list
    .map((p: any) => {
      if (typeof p === 'string') {
        return { name: p.trim(), status: 'Warm' as ProductStatus, strength: 0, chance: 0 };
      }
      const name = String(p.product_name || p.product || p.name || '').trim();
      if (!name) return null;
      return {
        name,
        status: normalizeProductStatus(p.status || p.lead_status),
        strength: Number(p.strength) || 0,
        chance: Number(p.chance) || 0,
      };
    })
    .filter(Boolean) as LeadProductDetail[];
}

/** Prefer current products[]; fill missing strength/chance/status from updateHistory snapshots (incl. create). */
function mergeLeadProductDetails(lead: any): LeadProductDetail[] {
  const fromProducts = extractLeadProducts(lead?.products);
  const history = Array.isArray(lead?.updateHistory) ? [...lead.updateHistory] : [];
  history.sort(
    (a, b) => new Date(a?.updatedAt || 0).getTime() - new Date(b?.updatedAt || 0).getTime(),
  );

  const fromHistory = new Map<string, LeadProductDetail>();
  for (const entry of history) {
    for (const row of extractLeadProducts(entry?.productsInterested)) {
      const key = row.name.toLowerCase();
      const prev = fromHistory.get(key);
      // Later follow-ups override earlier; keep non-zero metrics when a later row clears them
      fromHistory.set(key, {
        name: row.name,
        status: row.status || prev?.status || 'Warm',
        strength: row.strength > 0 ? row.strength : prev?.strength || 0,
        chance: row.chance > 0 ? row.chance : prev?.chance || 0,
      });
    }
  }

  const merged = new Map<string, LeadProductDetail>();

  for (const [key, hist] of fromHistory) {
    merged.set(key, { ...hist });
  }

  for (const p of fromProducts) {
    const key = p.name.toLowerCase();
    const hist = merged.get(key);
    merged.set(key, {
      name: p.name,
      status: p.status || hist?.status || 'Warm',
      strength: p.strength > 0 ? p.strength : hist?.strength || 0,
      chance: p.chance > 0 ? p.chance : hist?.chance || 0,
    });
  }

  return Array.from(merged.values());
}

function emptyProduct(name: string, checked = false): ProductSelection {
  return {
    name,
    checked,
    status: 'Warm',
    strength: 0,
    chance: 0,
  };
}

export default function LeadEditScreen({ navigation, route }: any) {
  const { id } = route.params;
  const [form, setForm] = useState({
    school_name: '',
    school_type: 'New',
    contact_person: '',
    contact_mobile: '',
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
    priority: 'Hot',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
  });
  const [products, setProducts] = useState<ProductSelection[]>([]);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const [leadProducts, setLeadProducts] = useState<LeadProductDetail[]>([]);
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

  useEffect(() => {
    const byName = new Map(
      leadProducts.map((p) => [p.name.trim().toLowerCase(), p] as const),
    );
    const catalogSet = new Set(catalogNames.map((n) => n.trim().toLowerCase()));

    const merged: ProductSelection[] = catalogNames.map((name) => {
      const existing = byName.get(name.trim().toLowerCase());
      if (existing) {
        return {
          name,
          checked: true,
          status: existing.status,
          strength: existing.strength,
          chance: existing.chance,
        };
      }
      return emptyProduct(name, false);
    });

    for (const existing of leadProducts) {
      const key = existing.name.trim().toLowerCase();
      if (!key || catalogSet.has(key)) continue;
      merged.push({
        name: existing.name.trim(),
        checked: true,
        status: existing.status,
        strength: existing.strength,
        chance: existing.chance,
      });
    }

    if (merged.length === 0 && leadProducts.length > 0) {
      setProducts(
        leadProducts.map((p) => ({
          name: p.name,
          checked: true,
          status: p.status,
          strength: p.strength,
          chance: p.chance,
        })),
      );
      return;
    }

    setProducts(merged);
  }, [catalogNames, leadProducts]);

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
        priority: lead.priority || lead.lead_status || 'Hot',
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

      setLeadProducts(mergeLeadProductDetails(fromOrder || fromLead || lead));
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = (index: number, patch: Partial<ProductSelection>) => {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const handleProductCheck = (index: number, checked: boolean) => {
    updateProduct(index, { checked });
  };

  const handleProductStatusChange = (index: number, status: ProductStatus) => {
    const patch: Partial<ProductSelection> = { status };
    if (status !== 'Hot' && status !== 'Warm') {
      patch.strength = 0;
      patch.chance = 0;
    }
    updateProduct(index, patch);
  };

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!form.decision_maker_name?.trim()) {
      setErrorMessage('Decision Maker Name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.decision_maker_mobile?.trim()) {
      setErrorMessage('Decision Maker Mobile is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const mobileError = phoneDigitsError(form.contact_mobile, true) || phoneDigitsError(form.decision_maker_mobile, true);
    if (mobileError) {
      setErrorMessage(mobileError);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.remarks?.trim()) {
      setErrorMessage('Remarks is required');
      return;
    }
    if (!form.average_fee?.trim() || Number(form.average_fee) <= 0) {
      setErrorMessage('Average School Fee is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.branches?.trim() || Number(form.branches) <= 0) {
      setErrorMessage('No. of Branches is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.strength?.trim() || Number(form.strength) <= 0) {
      setErrorMessage('School Strength is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    const selectedProducts = products.filter((p) => p.checked);

    if (selectedProducts.length === 0) {
      setErrorMessage('Please select at least one product.');
      return;
    }

    for (const p of selectedProducts) {
      if ((p.status === 'Hot' || p.status === 'Warm') && (!p.strength || p.strength <= 0)) {
        setErrorMessage(`Enter strength for "${p.name}" when status is ${p.status}.`);
        return;
      }
      if (p.status === 'Hot' && p.chance < 80) {
        setErrorMessage(`Chance % for "${p.name}" must be at least 80% when status is Hot.`);
        return;
      }
      if (p.status === 'Warm' && p.chance < 20) {
        setErrorMessage(`Chance % for "${p.name}" must be at least 20% when status is Warm.`);
        return;
      }
    }

    const productsPayload = selectedProducts.map((p) => ({
      product_name: p.name,
      quantity: 1,
      unit_price: 0,
      status: p.status,
      strength: p.strength || 0,
      chance: p.status === 'Hot' || p.status === 'Warm' ? p.chance || 0 : 0,
    }));

    setSubmitting(true);
    try {
      const payload: any = {
        school_name: form.school_name,
        school_type: form.school_type,
        contact_person: form.contact_person,
        contact_mobile: form.contact_mobile,
        contact_person2: form.decision_maker_name,
        contact_mobile2: form.decision_maker_mobile,
        decision_maker: form.decision_maker_name,
        email: form.email,
        location: form.location,
        address: form.address,
        pincode: form.pincode,
        state: form.state,
        city: form.city,
        region: form.region,
        area: form.area,
        mandal: form.mandal || undefined,
        cluster: form.cluster || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        zone: form.zone,
        priority: form.priority,
        branches: form.branches ? Number(form.branches) : undefined,
        no_of_branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        remarks: form.remarks,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        avg_fee: form.average_fee ? Number(form.average_fee) : undefined,
        products: productsPayload,
        follow_up_date: parseFollowUpDate(form.follow_up_date),
      };

      try {
        await apiService.put(`/leads/${id}`, payload);
      } catch {
        await apiService.put(`/dc-orders/${id}`, payload);
      }

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
          label="Email"
          value={form.email}
          onChangeText={(text) => setForm((f) => ({ ...f, email: text }))}
        />
        <FormField
          label="Decision Maker Name *"
          value={form.decision_maker_name}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_name: text }))}
        />
        <FormField
          label="Decision Maker Mobile *"
          value={form.decision_maker_mobile}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_mobile: sanitizePhoneDigits(text) }))}
          keyboardType="phone-pad"
          placeholder="10 to 15 digits"
          maxLength={15}
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
          label="Area"
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
          <Text style={styles.sectionTitle}>Products Interested *</Text>
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
                  <TouchableOpacity
                    style={styles.productHeader}
                    onPress={() => handleProductCheck(index, !product.checked)}
                  >
                    <View
                      style={[styles.checkbox, product.checked && styles.checkboxSelected]}
                    >
                      {product.checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.productName}>{product.name}</Text>
                  </TouchableOpacity>
                  {product.checked ? (
                    <View style={styles.productFields}>
                      <WebSelect
                        label="Status"
                        value={product.status}
                        onValueChange={(v) =>
                          handleProductStatusChange(index, v as ProductStatus)
                        }
                        items={PRODUCT_STATUS_OPTIONS}
                      />
                      <FormField
                        label="Strength"
                        value={hotOrWarm ? String(product.strength ?? '') : '0'}
                        onChangeText={(text) =>
                          updateProduct(index, { strength: Number(text) || 0 })
                        }
                        placeholder="Qty"
                        keyboardType="number-pad"
                        editable={hotOrWarm}
                      />
                      <FormField
                        label="Chance %"
                        value={hotOrWarm ? String(product.chance ?? '') : '0'}
                        onChangeText={(text) =>
                          updateProduct(index, {
                            chance: Math.min(100, Math.max(0, Number(text) || 0)),
                          })
                        }
                        placeholder="%"
                        keyboardType="number-pad"
                        editable={hotOrWarm}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          <Text style={styles.hint}>
            Previously selected products are checked with their Status, Strength, and Chance %.
            Select more products to add them.
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
              {form.follow_up_date || 'Tap to pick date'}
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
                value={form.follow_up_date ? new Date(form.follow_up_date) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(_, d) => {
                  if (d) {
                    setForm((f) => ({
                      ...f,
                      follow_up_date: d.toISOString().split('T')[0],
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
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
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
