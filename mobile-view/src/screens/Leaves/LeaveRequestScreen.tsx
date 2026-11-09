import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { LEAVE_DAY_TYPES, HALF_DAY_SESSIONS, formatLeaveDays, LEAVE_TYPE_OPTIONS, LEAVE_TYPE_HINTS } from '../../lib/leaveTypes';
import type { LeaveAllocation, LeaveBalance } from '../../lib/leavePolicy';
import LeaveBalanceCard from '../../components/leaves/LeaveBalanceCard';
import LeavePaymentBreakdown from '../../components/leaves/LeavePaymentBreakdown';

const todayDateString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isBeforeToday = (dateStr: string) => dateStr && dateStr < todayDateString();


const HALF_DAY_SESSION_OPTIONS = HALF_DAY_SESSIONS.map((s) => ({ label: s, value: s }));

const emptyForm = () => ({
  startDate: '',
  endDate: '',
  leaveType: 'Sick Leave',
  dayType: 'Full Day' as string,
  halfDaySession: 'First Half' as string,
  reason: '',
  days: 0,
});

export default function LeaveRequestScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const isHalfDay = form.dayType === 'Half Day';
  // Half Day is a single date: the end date follows the start date.
  const effectiveEndDate = isHalfDay ? form.startDate : form.endDate;
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [preview, setPreview] = useState<LeaveAllocation | null>(null);

  const loadBalance = () => {
    apiService.get('/leaves/balance').then((b: any) => setBalance(b || null)).catch(() => setBalance(null));
  };
  useEffect(loadBalance, []);

  // How the chosen days would be paid (monthly leave, comp-off, loss of pay, sandwich days).
  useEffect(() => {
    if (!(form.days > 0)) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      apiService
        .post('/leaves/preview', {
          leaveType: form.leaveType,
          dayType: form.dayType,
          ...(isHalfDay ? { halfDaySession: form.halfDaySession } : {}),
          startDate: form.startDate,
          endDate: effectiveEndDate,
        })
        .then((p: any) => setPreview(p || null))
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [form.leaveType, form.dayType, form.halfDaySession, form.startDate, effectiveEndDate, form.days, isHalfDay]);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (form.startDate && effectiveEndDate) {
      const start = new Date(form.startDate + 'T00:00:00');
      const end = new Date(effectiveEndDate + 'T00:00:00');
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = isHalfDay ? 0.5 : Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setForm((f) => ({ ...f, days: diffDays }));
      } else {
        setForm((f) => ({ ...f, days: 0 }));
      }
    } else {
      setForm((f) => (f.days ? { ...f, days: 0 } : f));
    }
  }, [form.startDate, effectiveEndDate, isHalfDay]);

  const handleSubmit = async () => {
    clearMessages();
    if (!form.startDate?.trim()) {
      setErrorMessage(isHalfDay ? 'Leave date is required' : 'Start date is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!effectiveEndDate?.trim()) {
      setErrorMessage('End date is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (isBeforeToday(form.startDate) || isBeforeToday(effectiveEndDate)) {
      setErrorMessage('Past dates cannot be selected for leave');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (new Date(effectiveEndDate) < new Date(form.startDate)) {
      setErrorMessage('End date must be on or after start date');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.reason?.trim()) {
      setErrorMessage('Please provide a reason for your leave request');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/leaves/create', {
        leaveType: form.leaveType,
        dayType: form.dayType,
        ...(isHalfDay ? { halfDaySession: form.halfDaySession } : {}),
        startDate: form.startDate,
        endDate: effectiveEndDate,
        reason: form.reason.trim(),
        days: form.days,
        employeeId: user?._id,
      });
      setSuccessMessage('Leave request submitted successfully!');
      setForm(emptyForm());
      loadBalance();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to submit leave request');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell
      noScroll
      title="Apply for Leave"
      headerRight={
        <TouchableOpacity onPress={() => navigation.navigate('LeavesApproved')}>
          <Text style={styles.headerLink}>My Leaves</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {successMessage && (
          <MessageBanner
            type="success"
            message={successMessage}
            actionLabel="View My Leaves"
            onAction={() => navigation.navigate('LeavesApproved')}
          />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <LeaveBalanceCard balance={balance} />

        <PageSection title="Leave details">
        <WebSelect
          label="Leave Type *"
          value={form.leaveType}
          onValueChange={(v) => setForm((f) => ({ ...f, leaveType: v }))}
          items={LEAVE_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
        />
        <Text style={styles.hint}>{LEAVE_TYPE_HINTS[form.leaveType] || ''}</Text>

        <View style={styles.fieldContainer}>
          <WebLabel>Leave Duration *</WebLabel>
          <View style={styles.segment}>
            {LEAVE_DAY_TYPES.map((t) => {
              const active = form.dayType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.segmentItem, active && styles.segmentItemActive]}
                  onPress={() => setForm((f) => ({ ...f, dayType: t }))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t === 'Half Day' ? 'Half-Day Leave' : 'Full-Day Leave'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isHalfDay && (
          <WebSelect
            label="Which half *"
            value={form.halfDaySession}
            onValueChange={(v) => setForm((f) => ({ ...f, halfDaySession: v }))}
            items={HALF_DAY_SESSION_OPTIONS}
          />
        )}
        </PageSection>

        <PageSection title="Dates">

        <DateField
          label={isHalfDay ? 'Leave Date *' : 'Start Date *'}
          value={form.startDate}
          onPress={() => setShowStartPicker(true)}
        />
        {!isHalfDay && (
          <DateField label="End Date *" value={form.endDate} onPress={() => setShowEndPicker(true)} />
        )}

        {form.days > 0 && (
          <View style={styles.daysContainer}>
            <Text style={styles.daysText}>
              Total: {formatLeaveDays(form.days)}
              {isHalfDay ? ` (${form.halfDaySession})` : ''}
            </Text>
          </View>
        )}
        <LeavePaymentBreakdown allocation={preview} />
        </PageSection>

        <PageSection title="Reason">
        <View>
          <WebLabel>Reason *</WebLabel>
          <WebInput
            style={styles.textArea}
            value={form.reason}
            onChangeText={(text) => setForm((f) => ({ ...f, reason: text }))}
            placeholder="Brief reason for leave"
            multiline
            numberOfLines={4}
          />
        </View>
        </PageSection>

        <WebButton
          title={submitting ? 'Submitting…' : 'Submit Request'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
        />

        <WebButton
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="outline"
        />
      </ScrollView>

      {showStartPicker && (
        <DatePickerModal
          title={isHalfDay ? 'Leave date' : 'Start date'}
          value={form.startDate}
          minimumDate={startOfToday()}
          onClose={() => setShowStartPicker(false)}
          onChange={(d) =>
            setForm((f) => ({
              ...f,
              startDate: d,
              endDate: f.endDate && f.endDate < d ? '' : f.endDate,
            }))
          }
        />
      )}
      {showEndPicker && (
        <DatePickerModal
          title="End date"
          value={form.endDate}
          minimumDate={
            form.startDate && form.startDate >= todayDateString()
              ? startOfDayFromIso(form.startDate)
              : startOfToday()
          }
          onClose={() => setShowEndPicker(false)}
          onChange={(d) => setForm((f) => ({ ...f, endDate: d }))}
        />
      )}
    </ScreenShell>
  );
}

function DateField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldContainer}>
      <WebLabel>{label}</WebLabel>
      <TouchableOpacity style={styles.dateTouchable} onPress={onPress}>
        <Text style={[styles.dateText, !value && styles.datePlaceholder]}>
          {value
            ? new Date(value + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Tap to pick date'}
        </Text>
        <Text>📅</Text>
      </TouchableOpacity>
    </View>
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDayFromIso(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? startOfToday() : d;
}

function DatePickerModal({
  title,
  value,
  minimumDate,
  onClose,
  onChange,
}: {
  title: string;
  value: string;
  minimumDate: Date;
  onClose: () => void;
  onChange: (isoDate: string) => void;
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
          value={value ? startOfDayFromIso(value) : minimumDate}
          mode="date"
          minimumDate={minimumDate}
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(_, d) => {
            if (d) {
              // Local calendar day: toISOString() turns today (midnight IST) into yesterday, so today was rejected.
              const picked = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              if (!isBeforeToday(picked)) onChange(picked);
            }
            if (Platform.OS === 'android') onClose();
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 48 },
  headerLink: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  fieldContainer: { marginBottom: 14 },
  textArea: { minHeight: 100, textAlignVertical: 'top', marginBottom: 0 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  dateText: { fontSize: 15, color: colors.textPrimary },
  datePlaceholder: { color: colors.textMuted },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundMuted,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  segmentItemActive: { backgroundColor: colors.backgroundLight, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 14, color: colors.textTertiary, fontWeight: '600' },
  segmentTextActive: { color: colors.primaryDark },
  daysContainer: {
    padding: 12,
    backgroundColor: colors.accent,
    borderRadius: 10,
  },
  hint: { fontSize: 12, color: '#6B7280', marginTop: -6, marginBottom: 10 },
  daysText: { fontSize: 14, color: colors.primaryDark, fontWeight: '700', textAlign: 'center' },
  dateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  datePickerBox: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  doneText: { color: colors.primaryDark, fontWeight: '700', fontSize: 15 },
});
