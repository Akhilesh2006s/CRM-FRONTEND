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
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const SCHOOL_TYPE_OPTIONS = [
  { label: 'New', value: 'New' },
  { label: 'Employee', value: 'Employee' },
];
const PRIORITY_OPTIONS = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Visit Again', value: 'Visit Again' },
  { label: 'Not Met Management', value: 'Not Met Management' },
  { label: 'Not Interested', value: 'Not Interested' },
];

type ProductSelection = { name: string; checked: boolean };

function parseFollowUpDate(s: string): string | undefined {
  if (!s?.trim()) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function extractProductNames(products: any): string[] {
  if (!products) return [];
  if (Array.isArray(products)) {
    return products
      .map((p: any) => (typeof p === 'string' ? p : p.product_name || p.product || ''))
      .filter(Boolean);
  }
  if (typeof products === 'string' && products.trim()) {
    try {
      const parsed = JSON.parse(products);
      if (Array.isArray(parsed)) return extractProductNames(parsed);
    } catch {
      return products.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
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
  const [leadProductNames, setLeadProductNames] = useState<string[]>([]);
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
      const list = Array.isArray(data) ? data : data?.data || [];
      const names = list
        .map((p: any) => (typeof p === 'string' ? p : p.name || p.product_name || ''))
        .filter(Boolean);
      setCatalogNames(names);
    } catch {
      setCatalogNames([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (catalogNames.length === 0) return;
    setProducts(
      catalogNames.map((name) => ({
        name,
        checked: leadProductNames.includes(name),
      }))
    );
  }, [catalogNames, leadProductNames]);

  const loadLead = async () => {
    try {
      setLoading(true);
      let lead: any;
      try {
        lead = await apiService.get(`/dc-orders/${id}`);
      } catch {
        lead = await apiService.get(`/leads/${id}`);
      }

      const followRaw = lead.follow_up_date || lead.estimated_delivery_date || '';
      let followStr = '';
      if (followRaw) {
        try {
          followStr = new Date(followRaw).toISOString().split('T')[0];
        } catch {
          followStr = '';
        }
      }

      setForm({
        school_name: lead.school_name || '',
        school_type: lead.school_type || 'New',
        contact_person: lead.contact_person || '',
        contact_mobile: lead.contact_mobile || '',
        email: lead.email || '',
        decision_maker_name: lead.decision_maker_name || lead.contact_person2 || '',
        decision_maker_mobile: lead.decision_maker_mobile || lead.contact_mobile2 || '',
        location: lead.location || '',
        city: lead.city || '',
        address: lead.address || '',
        pincode: lead.pincode || '',
        state: lead.state || '',
        region: lead.region || '',
        area: lead.area || '',
        priority: lead.priority || lead.lead_status || 'Hot',
        zone: lead.zone || '',
        branches: lead.branches != null ? String(lead.branches) : '',
        strength: lead.strength != null ? String(lead.strength) : '',
        remarks: lead.remarks || '',
        average_fee: lead.average_fee != null ? String(lead.average_fee) : '',
        follow_up_date: followStr,
      });

      setLeadProductNames(extractProductNames(lead.products));
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  const handleProductCheck = (index: number, checked: boolean) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, checked } : p))
    );
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
    if (!form.remarks?.trim()) {
      setErrorMessage('Remarks is required');
      return;
    }

    const selectedProducts = products
      .filter((p) => p.checked)
      .map((p) => ({
        product_name: p.name,
        quantity: 1,
        unit_price: 0,
      }));

    if (selectedProducts.length === 0) {
      setErrorMessage('Please select at least one product.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        school_name: form.school_name,
        school_type: form.school_type,
        contact_person: form.contact_person,
        contact_mobile: form.contact_mobile,
        contact_person2: form.decision_maker_name,
        contact_mobile2: form.decision_maker_mobile,
        email: form.email,
        location: form.location,
        address: form.address,
        pincode: form.pincode,
        state: form.state,
        city: form.city,
        region: form.region,
        area: form.area,
        zone: form.zone,
        priority: form.priority,
        branches: form.branches ? Number(form.branches) : undefined,
        strength: form.strength ? Number(form.strength) : undefined,
        remarks: form.remarks,
        average_fee: form.average_fee ? Number(form.average_fee) : undefined,
        products: selectedProducts,
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
          onChangeText={(text) => setForm((f) => ({ ...f, contact_mobile: text }))}
          keyboardType="phone-pad"
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
          onChangeText={(text) => setForm((f) => ({ ...f, decision_maker_mobile: text }))}
          keyboardType="phone-pad"
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
            <Text style={styles.hint}>No products available.</Text>
          ) : (
            products.map((product, index) => (
              <TouchableOpacity
                key={product.name}
                style={styles.productRow}
                onPress={() => handleProductCheck(index, !product.checked)}
              >
                <View
                  style={[styles.checkbox, product.checked && styles.checkboxSelected]}
                >
                  {product.checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <Text style={styles.productName}>{product.name}</Text>
              </TouchableOpacity>
            ))
          )}
          <Text style={styles.hint}>Select the products the school is interested in.</Text>
        </View>

        <FormField
          label="Average School Fee"
          value={form.average_fee}
          onChangeText={(text) => setForm((f) => ({ ...f, average_fee: text }))}
          keyboardType="number-pad"
        />
        <FormField
          label="No. of Branches"
          value={form.branches}
          onChangeText={(text) => setForm((f) => ({ ...f, branches: text }))}
          keyboardType="number-pad"
        />
        <FormField
          label="School Strength"
          value={form.strength}
          onChangeText={(text) => setForm((f) => ({ ...f, strength: text }))}
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
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
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
