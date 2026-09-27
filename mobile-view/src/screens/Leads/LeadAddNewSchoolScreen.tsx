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
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const LEAD_STATUS_OPTIONS = ['Hot', 'Warm', 'Cold'] as const;
const SCHOOL_TYPE_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Existing', value: 'Existing' },
];
const TERM_OPTIONS = [
  { label: 'Term 1', value: 'Term 1' },
  { label: 'Term 2', value: 'Term 2' },
  { label: 'Both', value: 'Both' },
];
const PRODUCT_STATUS_OPTIONS = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Not Interested', value: 'Not Interested' },
  { label: 'Management Not Met', value: 'Management Not Met' },
  { label: 'Visit Again', value: 'Visit Again' },
];

type ProductSelection = {
  name: string;
  checked: boolean;
  term: string;
  status: 'Hot' | 'Warm' | 'Not Interested' | 'Management Not Met' | 'Visit Again';
  strength: number;
  unitPrice: number;
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

export default function LeadAddNewSchoolScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    school_type: 'New',
    school_name: '',
    school_code: '',
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
    lead_status: 'Warm',
    zone: '',
    branches: '',
    strength: '',
    remarks: '',
    average_fee: '',
    follow_up_date: '',
    cluster_code: '',
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
    const loadUserZone = async () => {
      if (!user?._id) return;
      try {
        const userProfile = await apiService.get('/auth/me');
        const employeeZone = userProfile.assignedCity || userProfile.zone || '';
        if (employeeZone) {
          setForm((f) => (f.zone ? f : { ...f, zone: employeeZone }));
        }
      } catch (err) {
        console.error('Failed to load user zone:', err);
      }
    };
    loadUserZone();
  }, [user?._id]);

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
            checked: false,
            term: 'Term 1',
            status: 'Warm' as const,
            strength: 0,
            unitPrice: 0,
            chance: 0,
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

  const handleProductCheck = (index: number, checked: boolean) => {
    updateProduct(index, { checked });
  };

  const handleProductStatusChange = (index: number, status: ProductSelection['status']) => {
    const patch: Partial<ProductSelection> = { status };
    if (status !== 'Hot' && status !== 'Warm') {
      patch.strength = 0;
      patch.chance = 0;
    }
    updateProduct(index, patch);
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
    if (!form.contact_person?.trim()) {
      setErrorMessage('Contact person is required');
      return;
    }
    if (!form.contact_mobile?.trim()) {
      setErrorMessage('Contact mobile is required');
      return;
    }
    if (!form.decision_maker_name?.trim()) {
      setErrorMessage('Decision Maker Name is required');
      return;
    }
    if (!form.decision_maker_mobile?.trim()) {
      setErrorMessage('Decision Maker Mobile Number is required');
      return;
    }
    const mobileError = phoneDigitsError(form.contact_mobile, true) || phoneDigitsError(form.decision_maker_mobile, true);
    if (mobileError) {
      setErrorMessage(mobileError);
      return;
    }
    if (form.pincode.length !== 6) {
      setErrorMessage('Valid 6-digit pincode is required');
      return;
    }
    if (!form.area?.trim()) {
      setErrorMessage('Area is required. Enter pincode and select an area.');
      return;
    }
    if (!form.address?.trim()) {
      setErrorMessage('Address is required');
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
    if (!form.follow_up_date?.trim()) {
      setErrorMessage('Follow-up date is required');
      return;
    }

    const selectedProducts = products.filter((p) => p.checked);
    if (selectedProducts.length === 0) {
      setErrorMessage('Please select at least one product in Products Interested.');
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

    setSubmitting(true);
    try {
      const productsPayload = selectedProducts.map((p) => ({
        product_name: p.name,
        quantity: 1,
        unit_price: p.unitPrice || 0,
        term: p.term || 'Term 1',
        status: p.status,
        strength: p.strength || 0,
        chance: p.status === 'Hot' || p.status === 'Warm' ? p.chance || 0 : 0,
      }));

      const payload = {
        school_name: form.school_name.trim(),
        school_type: form.school_type || 'New',
        contact_person: form.contact_person.trim(),
        contact_mobile: form.contact_mobile.trim(),
        contact_person2: form.decision_maker_name.trim(),
        contact_mobile2: form.decision_maker_mobile.trim(),
        decision_maker: form.decision_maker_name.trim(),
        email: form.email?.trim() || undefined,
        location: form.location?.trim() || undefined,
        address: form.address.trim(),
        pincode: form.pincode,
        state: form.state || undefined,
        city: form.city || undefined,
        region: form.region || undefined,
        area: form.area.trim(),
        mandal: form.mandal?.trim() || undefined,
        cluster: form.cluster?.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        zone: form.zone || undefined,
        lead_status: form.lead_status || 'Warm',
        branches: form.branches ? Number(form.branches) : undefined,
        no_of_branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        remarks: form.remarks.trim(),
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        avg_fee: form.average_fee ? Number(form.average_fee) : undefined,
        products: productsPayload,
        follow_up_date: parseFollowUpDate(form.follow_up_date),
        assigned_to: user?._id,
        cluster_code: form.cluster_code?.trim() || undefined,
      };

      await apiService.post('/dc-orders/create', payload);
      setSuccessMessage('New school lead created successfully.');
      setErrorMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create lead');
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
          label="Contact person *"
          value={form.contact_person}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_person: text }))}
          placeholder="Enter contact person name"
        />

        <FormField
          label="Contact mobile *"
          value={form.contact_mobile}
          onChangeText={(text) => setForm((f) => ({ ...f, contact_mobile: sanitizePhoneDigits(text) }))}
          placeholder="10 to 15 digits"
          keyboardType="phone-pad"
          maxLength={15}
        />

        <FormField
          label="Email"
          value={form.email}
          onChangeText={(text) => setForm((f) => ({ ...f, email: text }))}
          placeholder="Enter email"
          keyboardType="email-address"
        />

        <FormField
          label="Decision Maker Name *"
          value={form.decision_maker_name}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_name: text }))}
          placeholder="Enter decision maker name"
        />

        <FormField
          label="Decision Maker Mobile Number *"
          value={form.decision_maker_mobile}
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_mobile: sanitizePhoneDigits(text) }))}
          placeholder="10 to 15 digits"
          keyboardType="phone-pad"
          maxLength={15}
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
          <Text style={styles.label}>Address *</Text>
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
          <Text style={styles.sectionTitle}>Products Interested *</Text>
          {loadingProducts ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
          ) : products.length === 0 ? (
            <Text style={styles.hint}>No products available.</Text>
          ) : (
            products.map((product, index) => {
              const hotOrWarm = product.status === 'Hot' || product.status === 'Warm';
              return (
                <View key={product.name} style={styles.productCard}>
                  <TouchableOpacity
                    style={styles.productHeader}
                    onPress={() => handleProductCheck(index, !product.checked)}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        product.checked && styles.checkboxSelected,
                      ]}
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
                          handleProductStatusChange(index, v as ProductSelection['status'])
                        }
                        items={PRODUCT_STATUS_OPTIONS}
                      />
                      <FormField
                        label="Strength"
                        value={hotOrWarm ? String(product.strength || '') : '0'}
                        onChangeText={(text) =>
                          updateProduct(index, { strength: Number(text) || 0 })
                        }
                        placeholder="Qty"
                        keyboardType="number-pad"
                        editable={hotOrWarm}
                      />
                      <FormField
                        label="Unit Price"
                        value={product.unitPrice ? String(product.unitPrice) : ''}
                        onChangeText={(text) =>
                          updateProduct(index, { unitPrice: Math.max(0, Number(text) || 0) })
                        }
                        placeholder="Enter unit price"
                        keyboardType="number-pad"
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
            Select products and set Status, Strength, and Chance % (required for Hot/Warm). Term is set after the lead is closed.
          </Text>
        </View>

        <WebSelect
          label="Lead status *"
          value={form.lead_status}
          onValueChange={(v) => setForm((f) => ({ ...f, lead_status: v }))}
          items={LEAD_STATUS_OPTIONS.map((o) => ({ label: o, value: o }))}
        />
        <Text style={styles.hint}>Pipeline status (Hot / Warm / Cold).</Text>

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
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
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
