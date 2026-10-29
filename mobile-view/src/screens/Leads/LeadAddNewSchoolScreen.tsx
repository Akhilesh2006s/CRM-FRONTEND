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
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import {
  LEAD_PRODUCT_STATUSES,
  validateLeadStyleProducts,
  type LeadProductStatus,
} from '../../lib/crm/leadProductRules';

const SCHOOL_TYPE_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Existing', value: 'Existing' },
];
const TERM_OPTIONS = [
  { label: 'Term 1', value: 'Term 1' },
  { label: 'Term 2', value: 'Term 2' },
  { label: 'Both', value: 'Both' },
];
const PRODUCT_STATUS_OPTIONS = LEAD_PRODUCT_STATUSES.map((s) => ({ label: s, value: s }));

/** Same shape as the web new-school page; numbers kept as strings so empty fields stay empty. */
type ProductSelection = {
  name: string;
  checked: boolean;
  term: string;
  status: LeadProductStatus;
  strength: string;
  unit_price: string;
  chance: string;
  not_interested_reason: string;
};

/** Digits only, no leading zeros, optionally capped (web normalizeIntegerInput). */
function normalizeIntegerInput(raw: string, max?: number): string {
  let value = String(raw || '').replace(/\D/g, '');
  if (value.length > 1) value = value.replace(/^0+/, '') || '0';
  if (value && max !== undefined && Number(value) > max) value = String(max);
  return value;
}

function isBeforeToday(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return ymd < today;
}

function parseFollowUpDate(s: string): string | undefined {
  if (!s?.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

export default function LeadAddNewSchoolScreen({ navigation }: any) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin' || Boolean((user as any)?.isSuperAdmin);
  const [bdeOptions, setBdeOptions] = useState<{ _id: string; name: string; zone?: string; cluster?: string }[]>([]);
  const [form, setForm] = useState({
    school_type: 'New',
    school_name: '',
    school_code: '',
    contact_person: '',
    contact_mobile: '',
    contact_designation: '',
    email: '',
    decision_maker_name: '',
    decision_maker_mobile: '',
    financial_contact_designation: '',
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
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
    cluster_code: '',
    assigned_to: '',
  });
  const [products, setProducts] = useState<ProductSelection[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [areas, setAreas] = useState<
    Array<{ name: string; district: string; block?: string; branchType?: string }>
  >([]);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const roles = ['Executive', 'Sales BDE', 'Employee'];
    Promise.all(
      roles.map((role) =>
        apiService.get(`/employees?isActive=true&role=${encodeURIComponent(role)}`).catch(() => []),
      ),
    ).then((batches) => {
      const seen = new Set<string>();
      const list: { _id: string; name: string; zone?: string; cluster?: string }[] = [];
      for (const batch of batches) {
        for (const u of Array.isArray(batch) ? batch : []) {
          const id = String(u?._id || u?.id || '');
          const name = String(u?.name || '').trim();
          if (!id || !name || seen.has(id)) continue;
          seen.add(id);
          list.push({ _id: id, name, zone: u.assignedCity || u.zone || '', cluster: u.cluster || '' });
        }
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setBdeOptions(list);
    });
  }, [isSuperAdmin]);

  useEffect(() => {
    const loadUserZone = async () => {
      if (isSuperAdmin) return;
      if (!user?._id) return;
      try {
        // Zone and cluster come from the employee profile, as on the web.
        const userProfile = await apiService.get('/auth/me');
        const employeeZone = userProfile.assignedCity || userProfile.zone || '';
        const employeeCluster = userProfile.cluster || '';
        if (employeeZone || employeeCluster) {
          setForm((f) => ({
            ...f,
            zone: f.zone || employeeZone,
            cluster: f.cluster || employeeCluster,
            cluster_code: f.cluster_code || employeeCluster,
          }));
        }
      } catch (err) {
        console.error('Failed to load user zone:', err);
      }
    };
    loadUserZone();
  }, [user?._id]);

  // Clusters of the selected zone, for the Cluster dropdown (same as the web).
  const [clustersForZone, setClustersForZone] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const loadClusters = async () => {
      if (!form.zone) {
        setClustersForZone([]);
        return;
      }
      try {
        const zones = await apiService.get('/zones');
        const match = (Array.isArray(zones) ? zones : []).find((z: any) => z?.name === form.zone);
        if (!match?._id) {
          if (active) setClustersForZone([]);
          return;
        }
        const clusters = await apiService.get(`/zones/${match._id}/clusters`);
        if (active) {
          setClustersForZone(
            (Array.isArray(clusters) ? clusters : []).map((c: any) => String(c?.name || '')).filter(Boolean),
          );
        }
      } catch {
        if (active) setClustersForZone([]);
      }
    };
    loadClusters();
    return () => {
      active = false;
    };
  }, [form.zone]);

  useEffect(() => {
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
          .map((p: any) => p.productName || p.name)
          .filter(Boolean);
        setProducts(
          names.map((name: string) => ({
            name,
            checked: true,
            term: 'Term 1',
            status: '' as const,
            strength: '',
            unit_price: '',
            chance: '',
            not_interested_reason: '',
          })),
        );
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    loadProducts();
  }, []);

  const handlePincodeChange = async (pincode: string) => {
    const cleanPincode = pincode.replace(/\D/g, '').slice(0, 6);
    setForm((f) => ({
      ...f,
      pincode: cleanPincode,
      area: cleanPincode.length < 6 ? '' : f.area,
    }));
    setPincodeError(null);

    if (cleanPincode.length === 6) {
      setLoadingPincode(true);
      try {
        const response = await apiService.get(`/location/get-town?pincode=${cleanPincode}`);
        if (response?.success && response.town) {
          setForm((f) => ({
            ...f,
            city: response.district || '',
            state: response.state || '',
            region: response.region || response.town || '',
            area: '',
          }));
          if (response.postOffices?.length > 0) {
            setAreas(
              response.postOffices.map((po: any) => ({
                name: String(po.Name || '').trim(),
                district: po.District || '',
                block: po.Block,
                branchType: po.BranchType,
              })).filter((a: { name: string }) => a.name),
            );
          } else {
            setAreas([{ name: response.town, district: response.district || '' }]);
          }
        } else {
          setAreas([]);
          setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }));
          setPincodeError(response?.message || 'Could not find this pincode. Enter location manually.');
        }
      } catch (err: any) {
        console.error('Pincode lookup failed:', err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Pincode lookup failed. Enter location manually.';
        setAreas([]);
        setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }));
        setPincodeError(msg);
      } finally {
        setLoadingPincode(false);
      }
    } else {
      setAreas([]);
      setForm((f) => ({ ...f, city: '', state: '', region: '', area: '' }));
    }
  };

  const setFollowUpDate = (ymd: string) => {
    setForm((f) => ({ ...f, follow_up_date: ymd }));
  };

  const parseLocalYmd = (s: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00');
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const toLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const updateProduct = (index: number, patch: Partial<ProductSelection>) => {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  // Products cannot be deselected (all are required, as on the web).

  const handleProductStatusChange = (index: number, status: ProductSelection['status']) => {
    setProducts((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p;
        if (status === 'Not Interested') {
          return { ...p, status, strength: '', unit_price: '', chance: '0' };
        }
        if (status !== 'Hot' && status !== 'Warm') {
          return { ...p, status, strength: '', unit_price: '', chance: '', not_interested_reason: '' };
        }
        return { ...p, status, chance: p.chance === '0' ? '' : p.chance, not_interested_reason: '' };
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

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    clearMessages();

    if (!form.school_name?.trim()) {
      setErrorMessage('School name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (isSuperAdmin && !form.assigned_to) {
      setErrorMessage('Select the BDE this school is assigned to');
      return;
    }
    if (!form.contact_person?.trim()) {
      setErrorMessage('School contact person name is required');
      return;
    }
    if (!form.contact_designation?.trim()) {
      setErrorMessage('School contact designation is required');
      return;
    }
    if (!form.decision_maker_name?.trim()) {
      setErrorMessage('Financial contact person name is required');
      return;
    }
    if (!form.financial_contact_designation?.trim()) {
      setErrorMessage('Financial contact designation is required');
      return;
    }
    if (!form.email?.trim()) {
      setErrorMessage('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (phoneDigitsError(form.contact_mobile, true)) {
      setErrorMessage('Contact mobile must be 10 to 15 digits');
      return;
    }
    if (phoneDigitsError(form.decision_maker_mobile, true)) {
      setErrorMessage('Financial contact mobile must be 10 to 15 digits');
      return;
    }
    if (!form.area?.trim()) {
      setErrorMessage('Area is required. Please enter pincode and select an area.');
      return;
    }
    if (!form.average_fee?.trim()) {
      setErrorMessage('Average School Fee is required');
      return;
    }
    if (!form.branches?.trim()) {
      setErrorMessage('No. of Branches is required');
      return;
    }
    if (!form.strength?.trim()) {
      setErrorMessage('School Strength is required');
      return;
    }
    if (!form.remarks?.trim()) {
      setErrorMessage('Remarks is required');
      return;
    }
    if (!form.zone?.trim()) {
      setErrorMessage('Zone is required');
      return;
    }
    if (!form.cluster?.trim()) {
      setErrorMessage('Cluster is required');
      return;
    }
    if (!form.follow_up_date?.trim()) {
      setErrorMessage('Follow-up date is required');
      return;
    }
    if (isBeforeToday(form.follow_up_date)) {
      setErrorMessage('Follow-up date cannot be in the past');
      return;
    }

    // All products are mandatory / pre-selected
    const selectedProducts = products.filter((p) => p.checked);
    if (selectedProducts.length === 0) {
      setErrorMessage('All products must be included. Please wait for products to load.');
      return;
    }
    const productError = validateLeadStyleProducts(selectedProducts);
    if (productError) {
      setErrorMessage(productError);
      return;
    }

    setSubmitting(true);
    try {
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
          not_interested_reason:
            p.status === 'Not Interested' ? p.not_interested_reason.trim() : '',
        };
      });

      // Same payload as web new-school (no lead_status / priority: the backend derives them).
      const payload = {
        school_name: form.school_name,
        school_type: form.school_type || 'New',
        contact_person: form.contact_person,
        contact_mobile: sanitizePhoneDigits(form.contact_mobile),
        contact_designation: form.contact_designation.trim(),
        contact_person2: form.decision_maker_name || undefined,
        contact_mobile2: sanitizePhoneDigits(form.decision_maker_mobile),
        financial_contact_designation: form.financial_contact_designation.trim(),
        location: form.location || undefined,
        address: form.address || undefined,
        pincode: form.pincode || undefined,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area || undefined,
        mandal: form.mandal || undefined,
        cluster: form.cluster || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        zone: form.zone || undefined,
        branches: form.branches ? Number(form.branches) : undefined,
        no_of_branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength && form.strength.trim() ? Number(form.strength) : undefined,
        remarks: form.remarks || undefined,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        avg_fee: form.average_fee ? Number(form.average_fee) : undefined,
        email: form.email,
        products: productsPayload,
        follow_up_date: parseFollowUpDate(form.follow_up_date),
        assigned_to: isSuperAdmin ? form.assigned_to : user?._id,
        cluster_code: form.cluster || form.cluster_code || undefined,
      };

      await apiService.post('/dc-orders/create', payload);
      setErrorMessage(null);
      // Same as the web: go to Follow-up Leads, where the new lead is listed.
      Alert.alert('Lead created', 'New school lead created successfully.');
      if (typeof navigation.replace === 'function') navigation.replace('LeadFollowup');
      else navigation.navigate('LeadFollowup');
    } catch (error: any) {
      const raw = error?.message || 'Failed to create lead';
      setErrorMessage(
        /school code already exists/i.test(raw) ? 'This school already exists. Go to Renewal Leads.' : raw,
      );
      setSuccessMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  const areaItems = areas.map((a) => {
    const display = `${a.name}${a.block ? ` - ${a.block}` : ''}${
      a.branchType ? ` (${a.branchType})` : ''
    }`.trim();
    return { label: display || a.name, value: a.name };
  });

  return (
    <ScreenShell title="Add New School">
      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="View Follow-up"
            onAction={() => navigation.navigate('LeadFollowup')}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <Text style={styles.mandatoryNote}>Fields marked with * are mandatory.</Text>

        {isSuperAdmin ? (
          <WebSelect
            label="Assign to (BDE) *"
            value={form.assigned_to}
            onValueChange={(v) => {
              const bde = bdeOptions.find((b) => b._id === v);
              setForm((f) => ({
                ...f,
                assigned_to: v,
                zone: bde?.zone || f.zone,
                cluster: bde?.cluster || f.cluster,
                cluster_code: bde?.cluster || f.cluster_code,
              }));
            }}
            items={bdeOptions.map((b) => ({ label: b.name, value: b._id }))}
            placeholder={bdeOptions.length === 0 ? 'No BDEs found' : 'Select BDE'}
          />
        ) : null}

        <FormField
          label="School name *"
          value={form.school_name}
          onChangeText={(text) => setForm((f) => ({ ...f, school_name: text }))}
          placeholder="Enter school name"
        />

        <FormField
          label="School code"
          value="Assigned automatically from the pincode, zone, and cluster"
          onChangeText={() => {}}
          editable={false}
        />

        <WebSelect
          label="School Type"
          value={form.school_type}
          onValueChange={(v) => setForm((f) => ({ ...f, school_type: v }))}
          items={SCHOOL_TYPE_OPTIONS}
        />

        <FormField
          label="School contact person *"
          value={form.contact_person}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_person: text }))}
          placeholder="Enter contact person name"
        />

        <FormField
          label="School contact mobile *"
          value={form.contact_mobile}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_mobile: sanitizePhoneDigits(text) }))}
          placeholder="10 to 15 digits"
          keyboardType="phone-pad"
          maxLength={15}
        />

        <FormField
          label="School contact designation *"
          value={form.contact_designation}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_designation: text }))}
          placeholder="e.g. Principal"
        />

        <FormField
          label="Email *"
          value={form.email}
          onChangeText={(text) => setForm((f) => ({ ...f, email: text }))}
          placeholder="Enter email"
          keyboardType="email-address"
        />

        <FormField
          label="Financial contact person *"
          value={form.decision_maker_name}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_name: text }))}
          placeholder="Enter financial contact name"
        />

        <FormField
          label="Financial contact mobile *"
          value={form.decision_maker_mobile}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_mobile: sanitizePhoneDigits(text) }))}
          placeholder="10 to 15 digits"
          keyboardType="phone-pad"
          maxLength={15}
        />

        <FormField
          label="Financial contact designation *"
          value={form.financial_contact_designation}
          onChangeText={(text) => setForm((f) => ({ ...f, financial_contact_designation: text }))}
          placeholder="e.g. Accountant"
        />

        <FormField
          label="Pincode *"
          value={form.pincode}
          onChangeText={handlePincodeChange}
          placeholder="Enter 6-digit pincode"
          keyboardType="number-pad"
        />
        {loadingPincode && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading location details...</Text>
          </View>
        )}
        {pincodeError && !loadingPincode ? (
          <Text style={styles.pincodeError}>{pincodeError}</Text>
        ) : null}

        <FormField
          label="State"
          value={form.state}
          onChangeText={(text) => setForm((f) => ({ ...f, state: text }))}
          placeholder="Auto-filled from pincode"
        />

        <FormField
          label="District"
          value={form.city}
          onChangeText={(text) => setForm((f) => ({ ...f, city: text }))}
          placeholder="Auto-filled from pincode"
        />

        <FormField
          label="City/Town"
          value={form.region}
          onChangeText={(text) => setForm((f) => ({ ...f, region: text }))}
          placeholder="Town / region"
        />

        <FormField
          label="Landmark"
          value={form.location}
          onChangeText={(text) => setForm((f) => ({ ...f, location: text }))}
          placeholder="Enter landmark"
        />

        <WebSelect
          label="Area *"
          value={form.area}
          onValueChange={(v) => setForm((f) => ({ ...f, area: v }))}
          items={areaItems}
          placeholder={areas.length === 0 ? 'Enter pincode to load areas' : 'Select exact area'}
          disabled={areas.length === 0}
        />
        <Text style={styles.hint}>Select the exact post office area for this location.</Text>

        <View style={styles.textAreaContainer}>
          <Text style={styles.label}>Address</Text>
          <WebInput
            style={styles.textArea}
            value={form.address}
            onChangeText={(text) => setForm((f) => ({ ...f, address: text }))}
            placeholder="Enter address"
            multiline
            numberOfLines={3}
          />
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
        {clustersForZone.length > 0 ? (
          <WebSelect
            label="Cluster *"
            value={form.cluster}
            onValueChange={(v) => setForm((f) => ({ ...f, cluster: v, cluster_code: v }))}
            items={[...new Set([...(form.cluster ? [form.cluster] : []), ...clustersForZone])].map((c) => ({ label: c, value: c }))}
            placeholder="Select cluster"
          />
        ) : (
          <FormField
            label="Cluster *"
            value={form.cluster}
            onChangeText={(text) => setForm((f) => ({ ...f, cluster: text, cluster_code: text }))}
            placeholder="Enter cluster"
          />
        )}
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
          label="School Strength (students) *"
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
            placeholder="Enter remarks"
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Products * (all required — cannot deselect)</Text>
          {loadingProducts ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : products.length === 0 ? (
            <Text style={styles.hint}>No products available.</Text>
          ) : (
            products.map((product, index) => {
              const hotOrWarm = product.status === 'Hot' || product.status === 'Warm';
              return (
                <View key={product.name} style={styles.productCard}>
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
                      onValueChange={(v) =>
                        handleProductStatusChange(index, v as ProductSelection['status'])
                      }
                      items={PRODUCT_STATUS_OPTIONS}
                      placeholder="Select status"
                    />
                    <FormField
                      label={hotOrWarm ? 'Strength *' : 'Strength'}
                      value={product.strength}
                      onChangeText={(text) =>
                        updateProduct(index, { strength: normalizeIntegerInput(text) })
                      }
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
                      onChangeText={(text) =>
                        updateProduct(index, { chance: normalizeIntegerInput(text, 100) })
                      }
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
          label="Zone"
          value={form.zone}
          onChangeText={() => {}}
          placeholder="Assigned zone"
          editable={false}
        />

        <FormField
          label="Cluster Code"
          value={form.cluster_code}
          onChangeText={(text) => setForm((f) => ({ ...f, cluster_code: text }))}
          placeholder="Enter cluster code"
        />

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Follow-up date *</Text>
          {Platform.OS === 'web' ? (
            React.createElement('input', {
              type: 'date',
              value: form.follow_up_date || '',
              min: toLocalYmd(new Date()),
              onChange: (e: any) => setFollowUpDate(e.target.value || ''),
              style: {
                width: '100%',
                padding: 14,
                borderRadius: 12,
                border: '1px solid #E2E8F0',
                fontSize: 16,
                backgroundColor: '#fff',
                color: '#1E293B',
                boxSizing: 'border-box',
              },
            })
          ) : (
            <TouchableOpacity
              style={styles.dateTouchable}
              onPress={() => setShowFollowUpDatePicker(true)}
            >
              <Text style={[styles.dateText, !form.follow_up_date && styles.datePlaceholder]}>
                {form.follow_up_date || 'Tap to pick date'}
              </Text>
              <Text style={styles.calendarIcon}>📅</Text>
            </TouchableOpacity>
          )}
        </View>

        {Platform.OS !== 'web' && showFollowUpDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={parseLocalYmd(form.follow_up_date)}
            mode="date"
            display="default"
            minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
            onChange={(event, d) => {
              setShowFollowUpDatePicker(false);
              if (event.type === 'set' && d) setFollowUpDate(toLocalYmd(d));
            }}
          />
        )}

        {Platform.OS === 'ios' && showFollowUpDatePicker && (
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
                value={parseLocalYmd(form.follow_up_date)}
                mode="date"
                display="spinner"
                minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                onChange={(_, d) => {
                  if (d) setFollowUpDate(toLocalYmd(d));
                }}
              />
            </View>
          </Modal>
        )}

        <WebButton
          title={submitting ? 'Creating...' : 'Create New School Lead'}
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
  placeholder,
  keyboardType,
  editable = true,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address' | 'decimal-pad';
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
        placeholder={placeholder}
        keyboardType={keyboardType}
        editable={editable}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 48 },
  mandatoryNote: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  fieldContainer: { marginBottom: 16 },
  label: {
    ...typography.label.medium,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    ...typography.body.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
  },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.7 },
  textAreaContainer: { marginBottom: 16 },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingText: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  hint: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  pincodeError: {
    ...typography.body.small,
    color: colors.error || '#DC2626',
    marginBottom: 12,
    marginTop: -4,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    ...typography.label.large,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  productCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.backgroundLight,
  },
  productHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  productName: { ...typography.body.medium, fontWeight: '600', flex: 1 },
  productFields: { gap: 4 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  datePlaceholder: { color: colors.textMuted },
  calendarIcon: { fontSize: 18 },
  dateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  datePickerBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: { ...typography.label.large, color: colors.textPrimary },
  doneText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
});
