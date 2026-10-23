import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

/** Same list and order as web app/dashboard/payments/add-payment/page.tsx */
const PAYMENT_MODES = ['Cash', 'UPI', 'NEFT/RTGS', 'Cheque', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Online Payment', 'Other'];
const FINANCIAL_YEARS = ['2024-25', '2025-26', '2026-27'];
const PAYMENT_GATEWAYS = ['Razorpay', 'PayU', 'Paytm', 'PhonePe', 'Google Pay', 'Other'];

type School = {
  _id: string;
  schoolCode: string;
  schoolName: string;
  contactName?: string;
  mobileNumber?: string;
  location?: string;
};

function responseRows(res: any): any[] {
  if (Array.isArray(res)) return res;
  return Array.isArray(res?.data) ? res.data : [];
}

/** Client records use school_code; dc_code is legacy fallback only (web lib/clientSchoolCode.ts). */
function displayClientSchoolCode(record?: { school_code?: string; dc_code?: string } | null): string {
  if (!record) return '';
  return String(record.school_code || record.dc_code || '').trim();
}

function schoolMapKey(code: string, fallbackId: string): string {
  const c = (code || '').trim();
  return c || `id:${fallbackId}`;
}

const EMPTY_DETAILS = {
  upiId: '',
  transactionId: '',
  chequeNumber: '',
  chequeDate: '',
  bankName: '',
  depositedBank: '',
  depositedBankBranch: '',
  accountNumber: '',
  ifscCode: '',
  cardLast4: '',
  paymentGateway: '',
  otherDetails: '',
};

export default function PaymentAddScreen({ navigation }: any) {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [school, setSchool] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('Cash');
  const [financialYear, setFinancialYear] = useState('2024-25');
  const [remarks, setRemarks] = useState('');
  const [details, setDetails] = useState({ ...EMPTY_DETAILS });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const setDetail = (key: keyof typeof EMPTY_DETAILS, value: string) =>
    setDetails((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    async function loadSchools() {
      if (!user?._id) {
        setLoadingSchools(false);
        return;
      }
      try {
        const isEmployee = user.role === 'Executive' || user.role === 'Sales BDE';
        if (isEmployee) {
          const [dcRes, leadRes, orderRes] = await Promise.all([
            apiService.get(`/dc?employeeId=${user._id}`).catch(() => []),
            apiService.get(`/leads?assignedTo=${user._id}&limit=500`).catch(() => []),
            apiService.get(`/dc-orders?assigned_to=${user._id}&limit=500`).catch(() => []),
          ]);
          const map = new Map<string, School>();
          const addSchool = (row: School) => {
            if (!row.schoolName?.trim() && !row.schoolCode?.trim()) return;
            const key = schoolMapKey(row.schoolCode, row._id);
            const prev = map.get(key);
            if (!prev || (row.schoolCode && !prev.schoolCode)) map.set(key, row);
          };
          responseRows(dcRes).forEach((dc: any) => {
            const order = dc.dcOrderId;
            if (!order || typeof order !== 'object') return;
            addSchool({
              _id: order._id || dc._id || '',
              schoolCode: displayClientSchoolCode(order),
              schoolName: order.school_name || dc.customerName || '',
              contactName: order.contact_person || '',
              mobileNumber: order.contact_mobile || dc.customerPhone || '',
              location: order.location || dc.customerAddress || '',
            });
          });
          responseRows(leadRes)
            .filter((lead: any) => lead.status === 'Closed' || lead.school_code)
            .forEach((lead: any) => {
              addSchool({
                _id: lead._id || '',
                schoolCode: displayClientSchoolCode(lead),
                schoolName: lead.school_name || '',
                contactName: lead.contact_person || '',
                mobileNumber: lead.contact_mobile || '',
                location: lead.location || '',
              });
            });
          responseRows(orderRes).forEach((order: any) => {
            addSchool({
              _id: order._id || '',
              schoolCode: displayClientSchoolCode(order),
              schoolName: order.school_name || '',
              contactName: order.contact_person || '',
              mobileNumber: order.contact_mobile || '',
              location: order.location || '',
            });
          });
          const list = Array.from(map.values())
            .filter((s) => s.schoolCode.trim())
            .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
          if (!cancelled) setSchools(list);
        } else {
          const data = await apiService.get('/schools');
          if (!cancelled) setSchools(responseRows(data));
        }
      } catch (err: any) {
        if (!cancelled) setErrorMessage(err?.message || 'Failed to load schools');
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    }
    loadSchools();
    return () => {
      cancelled = true;
    };
  }, [user?._id, user?.role]);

  const schoolItems = useMemo(
    () =>
      schools
        .filter((s) => s.schoolCode?.trim())
        .map((s) => ({ label: `${s.schoolCode} — ${s.schoolName}`, value: s.schoolCode })),
    [schools]
  );

  const selectedSchool = schools.find((s) => s.schoolCode === school);

  const fail = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage(null);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const changeMode = (m: string) => {
    setMode(m || 'Cash');
    setDetails({ ...EMPTY_DETAILS });
  };

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!school || !amount || !mode) return fail('Please fill all required fields (School, Amount, and Payment Mode)');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return fail('Please enter a valid amount');
    if (!selectedSchool?.schoolCode?.trim()) return fail('School code is required. Choose a converted client by school code.');
    const d = details;
    if (mode === 'UPI' && !d.upiId.trim()) return fail('Please enter UPI ID');
    if ((mode === 'NEFT/RTGS' || mode === 'Bank Transfer' || mode === 'Online Payment') && !d.transactionId.trim())
      return fail('Please enter Transaction ID');
    if (mode === 'Cheque' && (!d.chequeNumber.trim() || !d.chequeDate.trim())) return fail('Please enter Cheque Number and Cheque Date');
    if (mode === 'Cheque' && Number.isNaN(new Date(d.chequeDate).getTime())) return fail('Cheque Date must be YYYY-MM-DD');
    if ((mode === 'Credit Card' || mode === 'Debit Card') && !d.cardLast4.trim()) return fail('Please enter Card Last 4 Digits');
    if ((mode === 'Credit Card' || mode === 'Debit Card') && !/^\d{4}$/.test(d.cardLast4.trim()))
      return fail('Card Last 4 Digits must be exactly 4 digits');

    const payload: any = {
      customerName: selectedSchool.schoolName,
      schoolCode: selectedSchool.schoolCode,
      contactName: selectedSchool.contactName || '',
      mobileNumber: selectedSchool.mobileNumber || '',
      location: selectedSchool.location || '',
      amount: amt,
      paymentMethod: mode,
      financialYear,
      description: remarks,
      paymentDate: new Date().toISOString(),
      status: 'Pending',
    };
    if (mode === 'UPI') {
      payload.upiId = d.upiId;
      payload.referenceNumber = d.upiId;
    } else if (mode === 'NEFT/RTGS' || mode === 'Bank Transfer') {
      payload.transactionId = d.transactionId;
      payload.referenceNumber = d.transactionId;
      payload.bankName = d.bankName || undefined;
      payload.accountNumber = d.accountNumber || undefined;
      payload.ifscCode = d.ifscCode || undefined;
      payload.txnNo = d.transactionId;
    } else if (mode === 'Cheque') {
      payload.chequeNumber = d.chequeNumber;
      payload.referenceNumber = d.chequeNumber;
      payload.chqDate = d.chequeDate ? new Date(d.chequeDate).toISOString() : undefined;
      payload.bankName = d.bankName || undefined;
      payload.depositedBank = d.depositedBank.trim() || undefined;
      payload.depositedBankBranch = d.depositedBankBranch.trim() || undefined;
    } else if (mode === 'Credit Card' || mode === 'Debit Card') {
      payload.cardLast4 = d.cardLast4;
      payload.referenceNumber = d.cardLast4;
      payload.bankName = d.bankName || undefined;
    } else if (mode === 'Online Payment') {
      payload.transactionId = d.transactionId;
      payload.referenceNumber = d.transactionId;
      payload.paymentGateway = d.paymentGateway || undefined;
      payload.txnNo = d.transactionId;
    } else if (mode === 'Other') {
      payload.otherDetails = d.otherDetails;
      payload.referenceNumber = d.otherDetails || undefined;
    }

    setSubmitting(true);
    try {
      await apiService.post('/payments/create', payload);
      setSuccessMessage('Payment added');
      setSchool('');
      setAmount('');
      setMode('Cash');
      setRemarks('');
      setDetails({ ...EMPTY_DETAILS });
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      fail(error?.message || 'Failed to add payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title="Add Payment" noScroll>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="View Payments"
            onAction={() => navigation.navigate('PaymentList')}
          />
        )}
        {errorMessage && <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />}

        <WebSelect
          label="School (school code) *"
          value={school}
          onValueChange={setSchool}
          items={schoolItems}
          disabled={loadingSchools}
          placeholder={
            loadingSchools ? 'Loading schools...' : schoolItems.length ? 'Select by school code' : 'No converted clients with school code'
          }
        />
        {selectedSchool ? (
          <View style={styles.schoolInfo}>
            <Text style={styles.schoolInfoText}>School: {selectedSchool.schoolName || '—'}</Text>
            {selectedSchool.contactName ? <Text style={styles.schoolInfoText}>Contact: {selectedSchool.contactName}</Text> : null}
            {selectedSchool.mobileNumber ? <Text style={styles.schoolInfoText}>Mobile: {selectedSchool.mobileNumber}</Text> : null}
            {selectedSchool.location ? <Text style={styles.schoolInfoText}>Location: {selectedSchool.location}</Text> : null}
          </View>
        ) : null}

        <FormField label="Amount (₹) *" value={amount} onChangeText={setAmount} placeholder="Enter amount" keyboardType="decimal-pad" />

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Payment Mode *</Text>
          <View style={styles.chipsWrap}>
            {PAYMENT_MODES.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, mode === m && styles.chipSelected]}
                onPress={() => changeMode(m)}
              >
                <Text style={[styles.chipText, mode === m && styles.chipTextSelected]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <WebSelect
          label="Financial Year *"
          value={financialYear}
          onValueChange={(v) => setFinancialYear(v || '2024-25')}
          items={FINANCIAL_YEARS.map((fy) => ({ label: fy, value: fy }))}
        />

        {mode === 'UPI' && (
          <FormField label="UPI ID *" value={details.upiId} onChangeText={(t: string) => setDetail('upiId', t)} placeholder="e.g. name@paytm, phone@upi" autoCapitalize="none" />
        )}

        {(mode === 'NEFT/RTGS' || mode === 'Bank Transfer') && (
          <>
            <FormField
              label="Transaction ID *"
              value={details.transactionId}
              onChangeText={(t: string) => setDetail('transactionId', t)}
              placeholder={mode === 'NEFT/RTGS' ? 'Enter NEFT/RTGS Transaction ID' : 'Enter Transaction ID'}
            />
            <FormField label="Bank Name" value={details.bankName} onChangeText={(t: string) => setDetail('bankName', t)} placeholder="Enter Bank Name" />
            <FormField label="Account Number" value={details.accountNumber} onChangeText={(t: string) => setDetail('accountNumber', t)} placeholder="Enter Account Number" />
            <FormField label="IFSC Code" value={details.ifscCode} onChangeText={(t: string) => setDetail('ifscCode', t.toUpperCase())} placeholder="Enter IFSC Code" autoCapitalize="characters" />
          </>
        )}

        {mode === 'Cheque' && (
          <>
            <FormField label="Cheque Number *" value={details.chequeNumber} onChangeText={(t: string) => setDetail('chequeNumber', t)} placeholder="Enter Cheque Number" />
            <FormField label="Cheque Date *" value={details.chequeDate} onChangeText={(t: string) => setDetail('chequeDate', t)} placeholder="YYYY-MM-DD" />
            <FormField label="Bank Name" value={details.bankName} onChangeText={(t: string) => setDetail('bankName', t)} placeholder="Enter Bank Name" />
            <FormField label="Deposited Bank" value={details.depositedBank} onChangeText={(t: string) => setDetail('depositedBank', t)} placeholder="Bank where the cheque was deposited" />
            <FormField label="Deposited Bank Branch" value={details.depositedBankBranch} onChangeText={(t: string) => setDetail('depositedBankBranch', t)} placeholder="Branch of the deposited bank" />
          </>
        )}

        {(mode === 'Credit Card' || mode === 'Debit Card') && (
          <>
            <FormField
              label="Card Last 4 Digits *"
              value={details.cardLast4}
              onChangeText={(t: string) => setDetail('cardLast4', t.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter last 4 digits (e.g., 1234)"
              keyboardType="number-pad"
              maxLength={4}
            />
            <FormField label="Bank Name" value={details.bankName} onChangeText={(t: string) => setDetail('bankName', t)} placeholder="Enter Bank/Card Issuer Name" />
          </>
        )}

        {mode === 'Online Payment' && (
          <>
            <FormField label="Transaction ID *" value={details.transactionId} onChangeText={(t: string) => setDetail('transactionId', t)} placeholder="Enter Transaction ID" />
            <WebSelect
              label="Payment Gateway"
              value={details.paymentGateway}
              onValueChange={(v) => setDetail('paymentGateway', v)}
              items={PAYMENT_GATEWAYS.map((g) => ({ label: g, value: g }))}
              placeholder="Select Payment Gateway"
            />
          </>
        )}

        {mode === 'Other' && (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Payment Details *</Text>
            <WebInput
              style={styles.textArea}
              value={details.otherDetails}
              onChangeText={(t) => setDetail('otherDetails', t)}
              placeholder="Enter payment details (e.g., payment method, reference number, etc.)"
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Remarks</Text>
          <WebInput
            style={styles.textArea}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Enter any remarks or notes about this payment"
            multiline
            numberOfLines={3}
          />
        </View>

        <WebButton title={submitting ? 'Saving...' : 'Add Payment'} onPress={handleSubmit} loading={submitting} disabled={submitting || loadingSchools} />
      </ScrollView>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, maxLength, autoCapitalize }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  fieldContainer: { marginBottom: 4 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  chipText: { ...typography.body.medium, color: colors.textPrimary },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  schoolInfo: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    padding: 10,
    marginTop: -4,
    marginBottom: 12,
  },
  schoolInfoText: { fontSize: 13, color: colors.accentForeground, marginBottom: 2 },
});
