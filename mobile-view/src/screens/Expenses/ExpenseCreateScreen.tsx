import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService, getApiUrl } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

type ExpensePolicy = {
  skipFinanceStage: boolean;
  foodBillMandatoryAbove: number;
  requireTicketForModes: string[];
};

type CartLine = {
  id: string;
  category: 'travel' | 'food' | 'accommodation' | 'other';
  date: string;
  amount: string;
  remarks: string;
  transportType: string;
  travelFrom: string;
  travelTo: string;
  approxKms: string;
  gpsDistance: number | null;
  lodgeName: string;
  city: string;
  stayDate: string;
  stayDateEnd: string;
  restaurantName: string;
  mealDate: string;
  otherExpenseType: string;
  expenseName: string;
  description: string;
  billUri: string | null;
  ticketUri: string | null;
};

const CATEGORY_OPTIONS = [
  { label: 'Travel', value: 'travel' },
  { label: 'Accommodation', value: 'accommodation' },
  { label: 'Food', value: 'food' },
  { label: 'Other expenses', value: 'other' },
];

const TRANSPORT_OPTIONS = ['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto'].map((m) => ({
  label: m,
  value: m,
}));

const OTHER_TYPES = ['Parking', 'Toll', 'Courier', 'Printing', 'Miscellaneous', 'Other'] as const;

function emptyLine(category: CartLine['category'] = 'travel'): CartLine {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category,
    date: today,
    amount: '',
    remarks: '',
    transportType: '',
    travelFrom: '',
    travelTo: '',
    approxKms: '',
    gpsDistance: null,
    lodgeName: '',
    city: '',
    stayDate: today,
    stayDateEnd: today,
    restaurantName: '',
    mealDate: today,
    otherExpenseType: 'Miscellaneous',
    expenseName: '',
    description: '',
    billUri: null,
    ticketUri: null,
  };
}

function calcTravelAmount(mode: string, kms: number): string {
  if (mode === 'Bike') return (kms * 2.8).toFixed(2);
  if (mode === 'Car') return (kms * 8).toFixed(2);
  return '';
}

function apiCategory(cat: CartLine['category']): string {
  return cat === 'other' ? 'others' : cat;
}

async function submitOneExpense(line: CartLine, batchId: string, token: string | null) {
  const formData = new FormData();
  const payload: Record<string, string | number> = {
    category: apiCategory(line.category),
    date: line.date,
    amount: parseFloat(line.amount) || 0,
    employeeRemarks: line.remarks,
    submissionBatchId: batchId,
    title: `${line.category} expense`,
    status: 'Pending',
  };

  if (line.category === 'travel') {
    payload.transportType = line.transportType;
    payload.travelFrom = line.travelFrom;
    payload.travelTo = line.travelTo;
    payload.approxKms = parseFloat(line.approxKms) || 0;
    if (line.gpsDistance != null) {
      payload.gpsDistance = line.gpsDistance;
      payload.gpsProvider = 'google';
    }
  }
  if (line.category === 'accommodation') {
    payload.lodgeName = line.lodgeName;
    payload.city = line.city;
    payload.stayDate = line.stayDate;
    if (line.stayDateEnd) payload.stayDateEnd = line.stayDateEnd;
  }
  if (line.category === 'food') {
    payload.restaurantName = line.restaurantName;
    payload.mealDate = line.mealDate;
  }
  if (line.category === 'other') {
    payload.otherExpenseType = line.otherExpenseType;
    payload.expenseName = line.expenseName || line.otherExpenseType;
    payload.description = line.description;
  }

  Object.entries(payload).forEach(([k, v]) => formData.append(k, String(v)));

  const appendFile = (uri: string | null, field: string) => {
    if (!uri) return;
    const filename = uri.split('/').pop() || 'file.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append(field, { uri, name: filename, type } as any);
  };

  appendFile(line.billUri, 'bill');
  appendFile(line.ticketUri, 'ticket');

  const base = getApiUrl().replace(/\/$/, '');
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}/expenses/create`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to submit expense');
  }
  return res.json();
}

export default function ExpenseCreateScreen({ navigation }: any) {
  const [policy, setPolicy] = useState<ExpensePolicy | null>(null);
  const [draft, setDraft] = useState<CartLine>(emptyLine('travel'));
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsNote, setGpsNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStayDatePicker, setShowStayDatePicker] = useState(false);
  const [showStayEndDatePicker, setShowStayEndDatePicker] = useState(false);
  const [showMealDatePicker, setShowMealDatePicker] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    apiService
      .get<ExpensePolicy>('/expenses/policy')
      .then(setPolicy)
      .catch(() =>
        setPolicy({
          skipFinanceStage: false,
          foodBillMandatoryAbove: 500,
          requireTicketForModes: ['Bus', 'Train', 'Flight'],
        })
      );
  }, []);

  const ticketRequired = useMemo(() => {
    if (!policy || draft.category !== 'travel') return false;
    return policy.requireTicketForModes.includes(draft.transportType);
  }, [draft, policy]);

  const showGlobalBillUpload = draft.category === 'travel' && !ticketRequired;

  const billRequired = useMemo(() => {
    if (draft.category === 'accommodation') return true;
    const amt = parseFloat(draft.amount) || 0;
    if (draft.category === 'food' && policy) return amt >= policy.foodBillMandatoryAbove;
    if (draft.category === 'other') {
      return ['Parking', 'Toll', 'Courier', 'Printing'].includes(draft.otherExpenseType);
    }
    return false;
  }, [draft, policy]);

  const totals = useMemo(() => {
    const t = { travel: 0, accommodation: 0, food: 0, other: 0, grandTotal: 0 };
    for (const line of cart) {
      const a = parseFloat(line.amount) || 0;
      if (line.category === 'travel') t.travel += a;
      else if (line.category === 'accommodation') t.accommodation += a;
      else if (line.category === 'food') t.food += a;
      else t.other += a;
      t.grandTotal += a;
    }
    return t;
  }, [cart]);

  const pickImage = async (field: 'billUri' | 'ticketUri') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setDraft((d) => ({ ...d, [field]: result.assets[0].uri }));
    }
  };

  const fetchGpsDistance = async () => {
    if (!draft.travelFrom.trim() || !draft.travelTo.trim()) {
      setErrorMessage('Enter From and To locations first');
      return;
    }
    setGpsLoading(true);
    setGpsNote('');
    try {
      const res = await apiService.post<{ gpsDistance: number | null; error?: string }>(
        '/expenses/calculate-distance',
        { from: draft.travelFrom, to: draft.travelTo }
      );
      if (res.gpsDistance != null) {
        setDraft((d) => ({ ...d, gpsDistance: res.gpsDistance }));
        setGpsNote(`System estimate: ${res.gpsDistance} km`);
      } else {
        setGpsNote(res.error || 'GPS distance unavailable — manager can verify manually.');
      }
    } catch (e: any) {
      setGpsNote(e?.message || 'Could not calculate GPS distance');
    } finally {
      setGpsLoading(false);
    }
  };

  const travelAmountFor = (mode: string, kms: string) => {
    if (mode !== 'Bike' && mode !== 'Car') return null;
    return calcTravelAmount(mode, parseFloat(kms) || 0);
  };

  const updateKms = (kms: string) => {
    const calculated = travelAmountFor(draft.transportType, kms);
    setDraft({
      ...draft,
      approxKms: kms,
      amount: calculated ?? draft.amount,
    });
  };

  const updateTransport = (mode: string) => {
    const calculated = travelAmountFor(mode, draft.approxKms);
    setDraft({
      ...draft,
      transportType: mode,
      amount: calculated ?? draft.amount,
    });
  };

  const validateDraft = (): string | null => {
    if (!draft.amount || parseFloat(draft.amount) <= 0) return 'Enter a valid amount';
    if (draft.category === 'travel') {
      if (!draft.transportType || !draft.travelFrom || !draft.travelTo || !draft.approxKms) {
        return 'Complete all travel fields including distance claimed';
      }
      if (ticketRequired && !draft.ticketUri) {
        return 'Ticket/proof upload is required for this travel mode';
      }
    }
    if (draft.category === 'accommodation') {
      if (!draft.lodgeName || !draft.city || !draft.stayDate || !draft.stayDateEnd) {
        return 'Lodge name, city, and stay period (from–to) are required';
      }
      if (new Date(draft.stayDateEnd) < new Date(draft.stayDate)) {
        return 'Stay to date must be on or after stay from date';
      }
      if (!draft.billUri) return 'Bill upload is required for accommodation';
    }
    if (draft.category === 'food') {
      if (!draft.restaurantName || !draft.mealDate) return 'Restaurant and meal date are required';
      if (billRequired && !draft.billUri) {
        return `Bill required for food expenses of ₹${policy?.foodBillMandatoryAbove ?? 500}+`;
      }
    }
    if (draft.category === 'other') {
      if (!draft.description.trim()) return 'Description is required';
      if (billRequired && !draft.billUri) return 'Proof upload is required for this expense type';
    }
    return null;
  };

  const showValidationError = (msg: string) => {
    setErrorMessage(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const addToCart = () => {
    setErrorMessage(null);
    const err = validateDraft();
    if (err) {
      showValidationError(err);
      return;
    }
    setCart((c) => [...c, { ...draft, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }]);
    setDraft(emptyLine(draft.category));
    setGpsNote('');
  };

  const submitNow = async () => {
    setErrorMessage(null);
    const err = validateDraft();
    if (err) {
      showValidationError(err);
      return;
    }
    setSubmitting(true);
    const batchId = `batch-${Date.now()}`;
    try {
      const token = await AsyncStorage.getItem('authToken');
      await submitOneExpense(draft, batchId, token);
      setSuccessMessage('Expense submitted for approval.');
      setDraft(emptyLine(draft.category));
      setGpsNote('');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e: any) {
      setErrorMessage(e?.message || 'Submit failed');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const submitAll = async () => {
    if (cart.length === 0) {
      setErrorMessage('Add at least one expense line before submitting');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    const batchId = `batch-${Date.now()}`;
    try {
      const token = await AsyncStorage.getItem('authToken');
      for (const line of cart) {
        await submitOneExpense(line, batchId, token);
      }
      setSuccessMessage(`${cart.length} expense(s) submitted for approval.`);
      setCart([]);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (e: any) {
      setErrorMessage(e?.message || 'Submit failed');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  const DateField = ({
    label,
    value,
    onPress,
  }: {
    label: string;
    value: string;
    onPress: () => void;
  }) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateTouchable} onPress={onPress}>
        <Text style={[styles.dateText, !value && styles.datePlaceholder]}>
          {value || 'Tap to pick date'}
        </Text>
        <Text>📅</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenShell
      noScroll
      title="Create Expense"
      subtitle="Add to list (batch) or submit this line now"
    >
      <View style={styles.page}>
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
            actionLabel="View My Expenses"
            onAction={() => navigation.navigate('ExpenseMy')}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Proof rules: accommodation always needs a bill; food above ₹
            {policy?.foodBillMandatoryAbove ?? 500} needs a bill; Bus/Train/Flight/Other travel needs a
            ticket. Use GPS verify on travel to compare claimed distance.
          </Text>
        </View>

        <WebSelect
          label="Category *"
          value={draft.category}
          onValueChange={(v) => setDraft(emptyLine(v as CartLine['category']))}
          items={CATEGORY_OPTIONS}
        />

        <DateField label="Date *" value={draft.date} onPress={() => setShowDatePicker(true)} />

        {draft.category === 'travel' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Travel</Text>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Travel mode *</Text>
              <View style={styles.modeRow}>
                {TRANSPORT_OPTIONS.map((opt) => {
                  const selected = draft.transportType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.modeChip, selected && styles.modeChipSelected]}
                      onPress={() => updateTransport(opt.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <FormField
              label="From *"
              value={draft.travelFrom}
              onChangeText={(t) => setDraft((d) => ({ ...d, travelFrom: t }))}
              placeholder="Hyderabad"
            />
            <FormField
              label="To *"
              value={draft.travelTo}
              onChangeText={(t) => setDraft((d) => ({ ...d, travelTo: t }))}
              placeholder="Vijayawada"
            />
            <FormField
              label="Total distance claimed (km) *"
              value={draft.approxKms}
              onChangeText={updateKms}
              placeholder="0"
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={fetchGpsDistance}
              disabled={gpsLoading}
            >
              {gpsLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={styles.gpsButtonText}>Verify distance (GPS)</Text>
              )}
            </TouchableOpacity>
            {gpsNote ? <Text style={styles.hint}>{gpsNote}</Text> : null}
            {(draft.transportType === 'Bike' || draft.transportType === 'Car') && (
              <Text style={styles.calcPreview}>
                Calculated amount: ₹{draft.amount || '0.00'} (
                {draft.transportType === 'Bike' ? '₹2.8/km' : '₹8/km'})
              </Text>
            )}
            {ticketRequired && (
              <UploadField
                label="Ticket / proof upload *"
                uri={draft.ticketUri}
                onPick={() => pickImage('ticketUri')}
              />
            )}
          </View>
        )}

        {draft.category === 'accommodation' && (
          <View style={[styles.sectionCard, styles.sectionPurple]}>
            <Text style={styles.sectionTitle}>Accommodation</Text>
            <FormField label="Lodge / hotel name *" value={draft.lodgeName} onChangeText={(t) => setDraft((d) => ({ ...d, lodgeName: t }))} />
            <FormField label="City *" value={draft.city} onChangeText={(t) => setDraft((d) => ({ ...d, city: t }))} />
            <DateField label="Stay from *" value={draft.stayDate} onPress={() => setShowStayDatePicker(true)} />
            <DateField label="Stay to *" value={draft.stayDateEnd} onPress={() => setShowStayEndDatePicker(true)} />
            <UploadField label="Bill photo *" uri={draft.billUri} onPick={() => pickImage('billUri')} />
          </View>
        )}

        {draft.category === 'food' && (
          <View style={[styles.sectionCard, styles.sectionOrange]}>
            <Text style={styles.sectionTitle}>Food</Text>
            <FormField label="Restaurant name *" value={draft.restaurantName} onChangeText={(t) => setDraft((d) => ({ ...d, restaurantName: t }))} />
            <DateField label="Meal date *" value={draft.mealDate} onPress={() => setShowMealDatePicker(true)} />
            <UploadField
              label={`Bill upload${billRequired ? ' *' : ''}`}
              uri={draft.billUri}
              onPick={() => pickImage('billUri')}
            />
          </View>
        )}

        {draft.category === 'other' && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Other expenses</Text>
            <WebSelect
              label="Type *"
              value={draft.otherExpenseType}
              onValueChange={(v) => setDraft((d) => ({ ...d, otherExpenseType: v }))}
              items={OTHER_TYPES.map((t) => ({ label: t, value: t }))}
            />
            {draft.otherExpenseType === 'Other' && (
              <FormField label="Name *" value={draft.expenseName} onChangeText={(t) => setDraft((d) => ({ ...d, expenseName: t }))} />
            )}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Description *</Text>
              <WebInput
                style={[styles.input, styles.textArea]}
                value={draft.description}
                onChangeText={(t) => setDraft((d) => ({ ...d, description: t }))}
                multiline
                numberOfLines={3}
              />
            </View>
            <UploadField
              label={`Proof upload${billRequired ? ' *' : ''}`}
              uri={draft.billUri}
              onPick={() => pickImage('billUri')}
            />
          </View>
        )}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Amount (₹) *</Text>
          <WebInput
            style={styles.input}
            value={draft.amount}
            onChangeText={(text) => setDraft((d) => ({ ...d, amount: text }))}
            placeholder="0.00"
            keyboardType="decimal-pad"
            editable={
              !(
                draft.category === 'travel' &&
                (draft.transportType === 'Bike' || draft.transportType === 'Car')
              )
            }
          />
          {draft.category === 'travel' &&
            (draft.transportType === 'Bike' || draft.transportType === 'Car') && (
              <Text style={styles.hint}>
                Rate: {draft.transportType === 'Bike' ? '₹2.8/km' : '₹8/km'} — updates when distance changes
              </Text>
            )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Remarks</Text>
          <WebInput
            style={[styles.input, styles.textArea]}
            value={draft.remarks}
            onChangeText={(t) => setDraft((d) => ({ ...d, remarks: t }))}
            multiline
            numberOfLines={3}
          />
        </View>

        {showGlobalBillUpload && (
          <UploadField
            label={`Bill / receipt upload${billRequired ? ' *' : ''}`}
            uri={draft.billUri}
            onPick={() => pickImage('billUri')}
          />
        )}

        {cart.length > 0 && (
          <View style={styles.cartCard}>
            <Text style={styles.cartTitle}>Submission list ({cart.length})</Text>
            {cart.map((line) => (
              <View key={line.id} style={styles.cartRow}>
                <Text style={styles.cartRowText}>
                  {line.category} — ₹{line.amount}
                  {line.category === 'travel' && line.approxKms ? ` (${line.approxKms} km)` : ''}
                </Text>
                <TouchableOpacity onPress={() => setCart((c) => c.filter((x) => x.id !== line.id))}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsText}>Travel: ₹{totals.travel.toFixed(2)}</Text>
              <Text style={styles.totalsText}>Stay: ₹{totals.accommodation.toFixed(2)}</Text>
              <Text style={styles.totalsText}>Food: ₹{totals.food.toFixed(2)}</Text>
              <Text style={styles.totalsText}>Other: ₹{totals.other.toFixed(2)}</Text>
              <Text style={styles.totalsGrand}>Total: ₹{totals.grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <WebButton
          title="+ Add to list"
          onPress={addToCart}
          variant="outline"
          disabled={submitting}
        />
        <WebButton
          title={submitting ? 'Submitting…' : 'Submit this expense'}
          onPress={submitNow}
          loading={submitting}
          disabled={submitting}
        />
        {cart.length > 0 && (
          <WebButton
            title={submitting ? 'Submitting…' : `Submit all (${cart.length}) for approval`}
            onPress={submitAll}
            loading={submitting}
            disabled={submitting}
          />
        )}
        <WebButton title="Cancel" onPress={() => navigation.goBack()} variant="outline" disabled={submitting} />
      </View>
      </View>

      {showDatePicker && (
        <DatePickerModal
          value={draft.date}
          title="Expense date"
          onClose={() => setShowDatePicker(false)}
          onChange={(d) => setDraft((prev) => ({ ...prev, date: d }))}
        />
      )}
      {showStayDatePicker && (
        <DatePickerModal
          value={draft.stayDate}
          title="Stay from"
          onClose={() => setShowStayDatePicker(false)}
          onChange={(d) => setDraft((prev) => ({ ...prev, stayDate: d }))}
        />
      )}
      {showStayEndDatePicker && (
        <DatePickerModal
          value={draft.stayDateEnd}
          title="Stay to"
          minimumDate={draft.stayDate ? new Date(draft.stayDate + 'T00:00:00') : undefined}
          onClose={() => setShowStayEndDatePicker(false)}
          onChange={(d) => setDraft((prev) => ({ ...prev, stayDateEnd: d }))}
        />
      )}
      {showMealDatePicker && (
        <DatePickerModal
          value={draft.mealDate}
          title="Meal date"
          onClose={() => setShowMealDatePicker(false)}
          onChange={(d) => setDraft((prev) => ({ ...prev, mealDate: d }))}
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
          value={value ? new Date(value + 'T00:00:00') : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          minimumDate={minimumDate}
          onChange={(_, d) => {
            if (d) onChange(d.toISOString().split('T')[0]);
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
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function UploadField({ label, uri, onPick }: { label: string; uri: string | null; onPick: () => void }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={onPick}>
        <Text style={styles.uploadButtonText}>{uri ? 'File selected (tap to change)' : 'Select image'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 24 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  infoText: { ...typography.body.small, color: '#92400e' },
  fieldContainer: { marginBottom: 14 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  hint: { ...typography.body.small, color: colors.textSecondary, marginTop: 6 },
  calcPreview: {
    ...typography.body.medium,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
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
    borderColor: colors.info + '40',
    backgroundColor: colors.info + '08',
  },
  sectionPurple: { borderColor: '#c4b5fd', backgroundColor: '#f5f3ff' },
  sectionOrange: { borderColor: '#fdba74', backgroundColor: '#fff7ed' },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  modeChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modeChipTextSelected: {
    color: colors.textLight,
    fontWeight: '700',
  },
  gpsButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  gpsButtonText: { ...typography.body.medium, color: colors.primary, fontWeight: '600' },
  uploadButton: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    alignItems: 'center',
  },
  uploadButtonText: { ...typography.body.medium, color: colors.primary },
  cartCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  cartTitle: { ...typography.heading.h4, marginBottom: 12 },
  cartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartRowText: { ...typography.body.medium, flex: 1, marginRight: 8 },
  removeText: { color: colors.error, fontWeight: '600', fontSize: 13 },
  totalsRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  totalsText: { ...typography.body.small, color: colors.textSecondary },
  totalsGrand: { ...typography.body.medium, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
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
