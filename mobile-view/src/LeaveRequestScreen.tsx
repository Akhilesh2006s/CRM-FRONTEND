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
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const LEAVE_TYPE_OPTIONS = [
  { label: 'Sick Leave', value: 'Sick Leave' },
  { label: 'Annual Leave', value: 'Annual Leave' },
  { label: 'Casual Leave', value: 'Casual Leave' },
  { label: 'Emergency Leave', value: 'Emergency Leave' },
  { label: 'Other', value: 'Other' },
];

export default function LeaveRequestScreen({ navigation }: any) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'Casual Leave',
    reason: '',
    days: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  useEffect(() => {
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate + 'T00:00:00');
      const end = new Date(form.endDate + 'T00:00:00');
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setForm((f) => ({ ...f, days: diffDays }));
      } else {
        setForm((f) => ({ ...f, days: 0 }));
      }
    }
  }, [form.startDate, form.endDate]);

  const handleSubmit = async () => {
    clearMessages();
    if (!form.startDate?.trim()) {
      setErrorMessage('Start date is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.endDate?.trim()) {
      setErrorMessage('End date is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
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
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
        days: form.days,
        employeeId: user?._id,
      });
      setSuccessMessage('Leave request submitted successfully!');
      setForm({
        startDate: '',
        endDate: '',
        leaveType: 'Casual Leave',
        reason: '',
        days: 0,
      });
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
      title="Apply for Leave"
      headerRight={
        <TouchableOpacity onPress={() => navigation.navigate('LeavesApproved')}>
          <Text style={styles.headerLink}>My Leaves</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer}>
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

        <WebSelect
          label="Leave Type *"
          value={form.leaveType}
          onValueChange={(v) => setForm((f) => ({ ...f, leaveType: v }))}
          items={LEAVE_TYPE_OPTIONS}
        />

        <DateField
          label="Start Date *"
          value={form.startDate}
          onPress={() => setShowStartPicker(true)}
        />
        <DateField label="End Date *" value={form.endDate} onPress={() => setShowEndPicker(true)} />

        {form.days > 0 && (
          <View style={styles.daysContainer}>
            <Text style={styles.daysText}>Total days: {form.days}</Text>
          </View>
        )}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Reason *</Text>
          <WebInput
            style={styles.textArea}
            value={form.reason}
            onChangeText={(text) => setForm((f) => ({ ...f, reason: text }))}
            placeholder="Brief reason for leave"
            multiline
            numberOfLines={4}
          />
        </View>

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
          title="Start date"
          value={form.startDate}
          onClose={() => setShowStartPicker(false)}
          onChange={(d) => setForm((f) => ({ ...f, startDate: d }))}
        />
      )}
      {showEndPicker && (
        <DatePickerModal
          title="End date"
          value={form.endDate}
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
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.dateTouchable} onPress={onPress}>
        <Text style={[styles.dateText, !value && styles.datePlaceholder]}>
          {value
            ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN')
            : 'Tap to pick date'}
        </Text>
        <Text>📅</Text>
      </TouchableOpacity>
    </View>
  );
}

function DatePickerModal({
  title,
  value,
  onClose,
  onChange,
}: {
  title: string;
  value: string;
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
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={(_, d) => {
            if (d) onChange(d.toISOString().split('T')[0]);
            if (Platform.OS === 'android') onClose();
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40, gap: 4 },
  headerLink: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  textArea: {
    ...typography.body.medium,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
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
  daysContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.primary + '10',
    borderRadius: 12,
  },
  daysText: { ...typography.body.medium, color: colors.primary, fontWeight: '600', textAlign: 'center' },
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
