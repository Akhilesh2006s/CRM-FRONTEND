import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { appendFileToFormData, MAX_BILL_BYTES, type PickedFile } from '../../lib/expenseFiles';

import { ymdToDmy } from '../../utils/dateFormat';
/** Per-km rates for Bike / Car come from GET /expenses/policy (defaults ₹2.80 / ₹8) — web lib/expenseTravelRates.ts */
type TravelPerKmRates = { bikeRatePerKm?: number; carRatePerKm?: number };

type ExpenseType = '' | 'travel' | 'food' | 'accommodation' | 'others';

type FieldKey = 'receiptNumber' | 'remarks' | 'bill' | 'hotelName' | 'hotelAddress' | 'checkInDate' | 'checkOutDate' | 'approxKms';
type FieldErrors = Partial<Record<FieldKey, string>>;

const TYPE_OPTIONS = [
  { label: 'Travel', value: 'travel' },
  { label: 'Food', value: 'food' },
  { label: 'Accommodation', value: 'accommodation' },
  { label: 'Others', value: 'others' },
];

const TRAVEL_MODES = ['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto'];

function resolveRates(rates?: TravelPerKmRates) {
  const bike = Number(rates?.bikeRatePerKm);
  const car = Number(rates?.carRatePerKm);
  return { bikeRatePerKm: bike > 0 ? bike : 2.8, carRatePerKm: car > 0 ? car : 8 };
}

const isPerKmMode = (mode: string) => mode === 'Bike' || mode === 'Car';

function calcTravelAmount(mode: string, kms: number, rates?: TravelPerKmRates): string {
  if (!isPerKmMode(mode) || kms <= 0) return '';
  const r = resolveRates(rates);
  return (kms * (mode === 'Bike' ? r.bikeRatePerKm : r.carRatePerKm)).toFixed(2);
}

function perKmRateLabel(mode: string, rates?: TravelPerKmRates): string {
  const r = resolveRates(rates);
  if (mode === 'Bike') return `₹${r.bikeRatePerKm}/km`;
  if (mode === 'Car') return `₹${r.carRatePerKm}/km`;
  return '';
}

const todayIso = () => new Date().toISOString().split('T')[0];

const emptyForm = () => ({
  type: '' as ExpenseType,
  date: todayIso(),
  amount: '',
  receiptNumber: '',
  remarks: '',
  transportType: '',
  travelFrom: '',
  travelTo: '',
  approxKms: '',
  hotelName: '',
  hotelAddress: '',
  checkInDate: '',
  checkOutDate: '',
});

type DateField = 'date' | 'checkInDate' | 'checkOutDate';

export default function ExpenseCreateScreen({ navigation }: any) {
  const [rates, setRates] = useState<TravelPerKmRates>({});
  const [form, setForm] = useState(emptyForm());
  const [billFile, setBillFile] = useState<PickedFile | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [datePicker, setDatePicker] = useState<DateField | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    apiService
      .get('/expenses/policy')
      .then((policy: TravelPerKmRates) => setRates(policy || {}))
      .catch(() => setRates({}));
  }, []);

  const isTravelType = form.type === 'travel';
  const needsHotel = form.type === 'food' || form.type === 'accommodation';
  const isStay = form.type === 'accommodation';
  const amountLocked = isTravelType && isPerKmMode(form.transportType);
  const autoAmount = amountLocked ? calcTravelAmount(form.transportType, Number(form.approxKms) || 0, rates) : '';
  const amountValue = amountLocked ? autoAmount : form.amount;
  // Auto rickshaws give no bill: bill and receipt number are optional for Auto travel.
  const billOptional = isTravelType && form.transportType === 'Auto';

  const update = (patch: Partial<ReturnType<typeof emptyForm>>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch) as FieldKey[];
    if (keys.some((k) => fieldErrors[k])) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const acceptFile = (file: PickedFile) => {
    const isImage = file.mimeType.startsWith('image/');
    const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) {
      showError('Only image files (JPG, PNG) and PDF files are allowed');
      return;
    }
    if (file.size != null && file.size > MAX_BILL_BYTES) {
      showError('File size must be less than 5MB');
      return;
    }
    setBillFile(isPdf ? { ...file, mimeType: 'application/pdf' } : file);
    setFieldErrors((prev) => ({ ...prev, bill: undefined }));
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showError('Photo library access is required to attach a bill photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    acceptFile({
      uri: a.uri,
      name: a.fileName || a.uri.split('/').pop() || 'bill.jpg',
      mimeType: a.mimeType || 'image/jpeg',
      size: a.fileSize ?? null,
      webFile: (a as any).file,
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    acceptFile({
      uri: a.uri,
      name: a.name || 'bill',
      mimeType: a.mimeType || (/\.pdf$/i.test(a.name || '') ? 'application/pdf' : 'image/jpeg'),
      size: a.size ?? null,
      webFile: (a as any).file,
    });
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (isTravelType && amountLocked && !(Number(form.approxKms) > 0)) errors.approxKms = 'Enter the kilometres travelled.';
    if (needsHotel) {
      if (!form.hotelName.trim()) errors.hotelName = 'Hotel Name is required.';
      if (!form.hotelAddress.trim()) errors.hotelAddress = 'Hotel Address is required.';
    }
    if (isStay) {
      if (!form.checkInDate) errors.checkInDate = 'Check-in Date is required.';
      if (!form.checkOutDate) errors.checkOutDate = 'Check-out Date is required.';
      else if (form.checkInDate && form.checkOutDate < form.checkInDate) {
        errors.checkOutDate = 'Check-out must be on or after Check-in.';
      }
    }
    if (!form.remarks.trim()) errors.remarks = 'Remarks are required.';
    if (!billOptional && !billFile) errors.bill = 'Bill upload is required.';
    return errors;
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!form.type || (!isStay && !form.date) || !(Number(amountValue) > 0)) {
      showError(amountLocked ? 'Enter the kilometres travelled to calculate the amount' : 'Please fill in Type, Date and Amount');
      return;
    }
    if (isTravelType && (!form.transportType || !form.travelFrom.trim() || !form.travelTo.trim())) {
      showError('Please fill in all required travel fields (Travel mode, From, To)');
      return;
    }
    const errors = validate();
    setFieldErrors(errors);
    const firstError = Object.values(errors).find(Boolean);
    if (firstError) {
      showError(firstError);
      return;
    }

    setSubmitting(true);
    try {
      const expenseData: Record<string, string | number | undefined> = {
        title: `${form.type.charAt(0).toUpperCase() + form.type.slice(1)} Expense`,
        category: form.type,
        amount: Number(amountValue),
        date: isStay ? form.checkInDate || form.date : form.date,
        receiptNumber: form.receiptNumber.trim() || undefined,
        employeeRemarks: form.remarks.trim() || undefined,
        status: 'Pending',
      };
      if (isTravelType) {
        expenseData.transportType = form.transportType;
        expenseData.travelFrom = form.travelFrom.trim();
        expenseData.travelTo = form.travelTo.trim();
        if (form.approxKms) expenseData.approxKms = Number(form.approxKms);
      }
      if (needsHotel) {
        expenseData.hotelName = form.hotelName.trim();
        expenseData.hotelAddress = form.hotelAddress.trim();
      }
      if (isStay) {
        expenseData.checkInDate = form.checkInDate;
        expenseData.checkOutDate = form.checkOutDate;
      }

      if (billFile) {
        const formData = new FormData();
        Object.entries(expenseData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) formData.append(key, String(value));
        });
        await appendFileToFormData(formData, 'bill', billFile);
        await apiService.upload('/expenses/create', formData);
      } else {
        const body: Record<string, string | number> = {};
        Object.entries(expenseData).forEach(([k, v]) => {
          if (v !== undefined) body[k] = v;
        });
        await apiService.post('/expenses/create', body);
      }

      navigation.navigate('ExpenseMy', { view: 'pending' });
      setForm(emptyForm());
      setBillFile(null);
    } catch (e: any) {
      showError(e?.message || 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  };

  const errorText = (key: FieldKey) => (fieldErrors[key] ? <Text style={styles.fieldError}>{fieldErrors[key]}</Text> : null);
  const errStyle = (key: FieldKey) => (fieldErrors[key] ? styles.inputError : null);

  const DateInput = ({ field, label }: { field: DateField; label: string }) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.dateTouchable, field !== 'date' && errStyle(field as FieldKey)]}
        onPress={() => setDatePicker(field)}
      >
        <Text style={[styles.dateText, !form[field] && styles.datePlaceholder]}>{ymdToDmy(form[field]) || 'Tap to pick date'}</Text>
        <Text>📅</Text>
      </TouchableOpacity>
      {field !== 'date' ? errorText(field as FieldKey) : null}
    </View>
  );

  return (
    <ScreenShell noScroll title="Create Expense" contentContainerStyle={{ flex: 1, minHeight: 0 }}>
      <View style={styles.page}>
        <ScrollView
          ref={scrollRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {errorMessage && <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

          <WebSelect
            label="Type *"
            value={form.type}
            placeholder="Select expense type"
            onValueChange={(v) =>
              update({
                type: v as ExpenseType,
                transportType: '',
                travelFrom: '',
                travelTo: '',
                approxKms: '',
                hotelName: '',
                hotelAddress: '',
                checkInDate: '',
                checkOutDate: '',
              })
            }
            items={TYPE_OPTIONS}
          />

          {!isStay && <DateInput field="date" label="Date *" />}

          {isTravelType && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Travel Details</Text>
              <WebSelect
                label="Travel mode *"
                value={form.transportType}
                onValueChange={(v) => update({ transportType: v })}
                items={TRAVEL_MODES.map((m) => ({
                  label: isPerKmMode(m) ? `${m} (${perKmRateLabel(m, rates)})` : m,
                  value: m,
                }))}
                placeholder="Select mode"
              />
              <FormField label="From *" value={form.travelFrom} onChangeText={(t) => update({ travelFrom: t })} placeholder="Enter origin location" />
              <FormField label="To *" value={form.travelTo} onChangeText={(t) => update({ travelTo: t })} placeholder="Enter destination location" />
              <FormField
                label={`Kilometres${amountLocked ? ' *' : ''}`}
                value={form.approxKms}
                onChangeText={(t) => update({ approxKms: t })}
                placeholder="Enter kilometres travelled"
                keyboardType="decimal-pad"
                error={fieldErrors.approxKms}
              />
            </View>
          )}

          {needsHotel && (
            <View style={[styles.sectionCard, styles.sectionAmber]}>
              <Text style={styles.sectionTitle}>{isStay ? 'Stay Details' : 'Hotel Details'}</Text>
              {isStay && (
                <>
                  <DateInput field="checkInDate" label="Check-in Date *" />
                  <DateInput field="checkOutDate" label="Check-out Date *" />
                </>
              )}
              <FormField
                label="Hotel Name *"
                value={form.hotelName}
                onChangeText={(t) => update({ hotelName: t })}
                placeholder="Enter hotel name"
                error={fieldErrors.hotelName}
              />
              <FormField
                label="Hotel Address *"
                value={form.hotelAddress}
                onChangeText={(t) => update({ hotelAddress: t })}
                placeholder="Enter hotel address"
                multiline
                error={fieldErrors.hotelAddress}
              />
            </View>
          )}

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Amount *</Text>
            <WebInput
              style={[styles.input, amountLocked && styles.inputLocked]}
              value={amountValue}
              onChangeText={(t) => {
                if (!amountLocked) update({ amount: t });
              }}
              placeholder={amountLocked ? 'Calculated from kilometres' : '0.00'}
              keyboardType="decimal-pad"
              editable={!amountLocked}
            />
            {amountLocked && (
              <Text style={styles.hint}>Calculated automatically: kilometres × {perKmRateLabel(form.transportType, rates)}</Text>
            )}
          </View>

          <FormField
            label="Bill Number"
            value={form.receiptNumber}
            onChangeText={(t) => update({ receiptNumber: t })}
            placeholder="Optional"
            error={fieldErrors.receiptNumber}
          />

          <FormField
            label="Remarks *"
            value={form.remarks}
            onChangeText={(t) => update({ remarks: t })}
            placeholder="What was this expense for?"
            multiline
            error={fieldErrors.remarks}
          />

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>{`Upload Bill${billOptional ? ' (optional for Auto)' : ' *'}`}</Text>
            <View style={styles.uploadRow}>
              <TouchableOpacity style={[styles.uploadButton, errStyle('bill')]} onPress={pickPhoto} disabled={submitting}>
                <Text style={styles.uploadButtonText}>Choose photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadButton, errStyle('bill')]} onPress={pickDocument} disabled={submitting}>
                <Text style={styles.uploadButtonText}>Choose file (image / PDF)</Text>
              </TouchableOpacity>
            </View>
            {billFile ? (
              <View style={styles.fileRow}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {billFile.name}
                </Text>
                <TouchableOpacity onPress={() => setBillFile(null)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {errorText('bill')}
            <Text style={styles.hint}>Accepted formats: JPG, PNG, PDF (Max 5MB)</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <WebButton title={submitting ? 'Creating...' : 'Create Expense'} onPress={handleSubmit} loading={submitting} disabled={submitting} />
          <WebButton title="Cancel" onPress={() => navigation.goBack()} variant="outline" disabled={submitting} />
        </View>
      </View>

      {datePicker && (
        <DatePickerModal
          value={form[datePicker]}
          title={datePicker === 'date' ? 'Expense date' : datePicker === 'checkInDate' ? 'Check-in date' : 'Check-out date'}
          minimumDate={
            datePicker === 'checkOutDate' && form.checkInDate ? new Date(form.checkInDate + 'T00:00:00') : undefined
          }
          onClose={() => setDatePicker(null)}
          onChange={(d) => update({ [datePicker]: d } as any)}
        />
      )}
    </ScreenShell>
  );
}

function DatePickerModal({
  value,
  title,
  onClose,
  onChange,
  minimumDate,
}: {
  value: string;
  title: string;
  onClose: () => void;
  onChange: (isoDate: string) => void;
  minimumDate?: Date;
}) {
  if (Platform.OS === 'web') {
    return (
      <Modal visible transparent animationType="fade">
        <TouchableOpacity style={styles.dateOverlay} activeOpacity={1} onPress={onClose} />
        <View style={styles.datePickerBox}>
          <View style={styles.datePickerHeader}>
            <Text style={styles.datePickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            {React.createElement('input', {
              type: 'date',
              value: value || '',
              min: minimumDate ? minimumDate.toISOString().split('T')[0] : undefined,
              onChange: (e: any) => onChange(e.target.value),
              style: { fontSize: 16, padding: 8 },
            })}
          </View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible transparent animationType="slide">
      <TouchableOpacity style={styles.dateOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.datePickerBox}>
        <View style={styles.datePickerHeader}>
          <Text style={styles.datePickerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
        <DateTimePicker
          value={value ? new Date(value + 'T00:00:00') : minimumDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          minimumDate={minimumDate}
          onChange={(_, d) => {
            if (d) {
              const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
              onChange(local.toISOString().split('T')[0]);
            }
            if (Platform.OS === 'android') onClose();
          }}
        />
      </View>
    </Modal>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
  multiline?: boolean;
  error?: string;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={[styles.input, multiline && styles.textArea, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 3 : undefined}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0 },
  content: { flex: 1, minHeight: 0 },
  contentContainer: { padding: 20, paddingBottom: 24, flexGrow: 1 },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  fieldContainer: { marginBottom: 14 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    marginBottom: 0,
  },
  inputLocked: { backgroundColor: colors.backgroundMuted, fontWeight: '600' },
  inputError: { borderColor: colors.error },
  fieldError: { fontSize: 12, color: colors.error, marginTop: 4 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  hint: { ...typography.body.small, color: colors.textSecondary, marginTop: 6 },
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
  datePlaceholder: { color: colors.textSecondary },
  sectionCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  sectionAmber: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  uploadRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  uploadButton: {
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
  },
  uploadButtonText: { ...typography.body.medium, color: colors.primary },
  fileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  fileName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  removeText: { color: colors.error, fontWeight: '600', fontSize: 13 },
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
