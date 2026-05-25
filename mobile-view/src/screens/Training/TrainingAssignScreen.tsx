import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Platform,
  TouchableOpacity,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

const todayIso = () => new Date().toISOString().split('T')[0];

export default function TrainingAssignScreen({ navigation }: any) {
  const [form, setForm] = useState({
    schoolCode: '',
    schoolName: '',
    zone: '',
    town: '',
    subject: '',
    trainerId: '',
    employeeId: '',
    trainingDate: '',
    term: '',
    trainingLevel: '',
    remarks: '',
  });
  const [trainers, setTrainers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScheduleLabel, setLastScheduleLabel] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadLastTraining = useCallback(async () => {
    const code = form.schoolCode.trim();
    const name = form.schoolName.trim();
    if (!code && !name) {
      setLastScheduleLabel(null);
      return;
    }
    const queries: string[] = [];
    if (code) queries.push(`schoolCode=${encodeURIComponent(code)}`);
    if (name) queries.push(`schoolName=${encodeURIComponent(name)}`);
    try {
      const byId = new Map<string, any>();
      for (const q of queries) {
        const rows = await apiService.get<any[]>(`/training?${q}`);
        (Array.isArray(rows) ? rows : []).forEach((r) => {
          const id = r._id || JSON.stringify(r);
          if (!byId.has(id)) byId.set(id, r);
        });
      }
      let completed = Array.from(byId.values()).filter((r) => r.status === 'Completed');
      const subject = form.subject.trim();
      if (subject) {
        completed = completed.filter(
          (r) => String(r.subject || '').trim().toLowerCase() === subject.toLowerCase()
        );
      }
      if (completed.length === 0) {
        setLastScheduleLabel(null);
        return;
      }
      const latest = completed.reduce((a, b) => {
        const da = new Date(a.completionDate || a.trainingDate || 0).getTime();
        const db = new Date(b.completionDate || b.trainingDate || 0).getTime();
        return db > da ? b : a;
      });
      const d = new Date(latest.completionDate || latest.trainingDate || '');
      const dateStr = d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const extra = [latest.subject, latest.term].filter(Boolean).join(' · ');
      setLastScheduleLabel(extra ? `${dateStr} (${extra})` : dateStr);
    } catch {
      setLastScheduleLabel(null);
    }
  }, [form.schoolCode, form.schoolName, form.subject]);

  useEffect(() => {
    const t = setTimeout(loadLastTraining, 400);
    return () => clearTimeout(t);
  }, [loadLastTraining]);

  const loadOptions = async () => {
    try {
      setLoading(true);
      const [trainersData, employeesData] = await Promise.all([
        apiService.get('/trainers?status=active'),
        apiService.get('/employees?isActive=true'),
      ]);
      setTrainers(Array.isArray(trainersData) ? trainersData : []);
      setEmployees(Array.isArray(employeesData) ? employeesData : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load options');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!form.schoolName?.trim()) {
      setErrorMessage('School Name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.trainerId?.trim()) {
      setErrorMessage('Trainer is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.trainingDate?.trim()) {
      setErrorMessage('Training Date is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (form.trainingDate < todayIso()) {
      setErrorMessage('Training date cannot be in the past');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!form.subject?.trim()) {
      setErrorMessage('Subject is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setSubmitting(true);
    try {
      await apiService.post('/training/create', {
        ...form,
        status: 'Scheduled',
        trainingDate: form.trainingDate,
      });
      setSuccessMessage('Training assigned successfully.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to assign training');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ScreenShell title="Assign Training" loading />;
  }

  return (
    <ScreenShell noScroll title="Assign Training">
      <View style={styles.page}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {successMessage && (
            <MessageBanner
              type="success"
              message={successMessage}
              actionLabel="View Trainings"
              onAction={() => navigation.navigate('TrainingList')}
            />
          )}
          {errorMessage && (
            <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
          )}

          <FormField
            label="School Code"
            value={form.schoolCode}
            onChangeText={(t) => setForm((f) => ({ ...f, schoolCode: t }))}
            placeholder="Enter school code"
          />
          <FormField
            label="School Name *"
            value={form.schoolName}
            onChangeText={(t) => setForm((f) => ({ ...f, schoolName: t }))}
            placeholder="Enter school name"
          />
          <FormField label="Zone" value={form.zone} onChangeText={(t) => setForm((f) => ({ ...f, zone: t }))} />
          <FormField label="Town" value={form.town} onChangeText={(t) => setForm((f) => ({ ...f, town: t }))} />
          <FormField
            label="Product / Subject *"
            value={form.subject}
            onChangeText={(t) => setForm((f) => ({ ...f, subject: t }))}
          />
          {lastScheduleLabel ? (
            <FormField
              label="Last training date"
              value={lastScheduleLabel}
              editable={false}
            />
          ) : null}

          <Text style={styles.label}>Trainer *</Text>
          <View style={styles.chipRow}>
            {trainers.map((trainer) => (
              <TouchableOpacity
                key={trainer._id}
                style={[styles.chip, form.trainerId === trainer._id && styles.chipOn]}
                onPress={() => setForm((f) => ({ ...f, trainerId: trainer._id }))}
              >
                <Text style={[styles.chipText, form.trainerId === trainer._id && styles.chipTextOn]}>
                  {trainer.name || trainer.email}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Training Date *</Text>
            <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateTouchableText}>
                {form.trainingDate || 'Tap to pick date (today or later)'}
              </Text>
            </TouchableOpacity>
          </View>

          <FormField label="Term" value={form.term} onChangeText={(t) => setForm((f) => ({ ...f, term: t }))} />
          <FormField
            label="Training Level"
            value={form.trainingLevel}
            onChangeText={(t) => setForm((f) => ({ ...f, trainingLevel: t }))}
          />
          <FormField
            label="Remarks"
            value={form.remarks}
            onChangeText={(t) => setForm((f) => ({ ...f, remarks: t }))}
            multiline
          />
        </ScrollView>

        <View style={styles.footer}>
          <WebButton title={submitting ? 'Assigning…' : 'Add Training'} onPress={handleSubmit} loading={submitting} />
          <WebButton title="Cancel" onPress={() => navigation.goBack()} variant="outline" disabled={submitting} />
        </View>
      </View>

      {showDatePicker && (
        <Modal visible transparent animationType="slide">
          <View style={styles.datePickerBox}>
            <DateTimePicker
              value={form.trainingDate ? new Date(form.trainingDate + 'T00:00:00') : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(_, d) => {
                if (d) setForm((f) => ({ ...f, trainingDate: d.toISOString().split('T')[0] }));
                if (Platform.OS === 'android') setShowDatePicker(false);
              }}
            />
            <WebButton title="Done" onPress={() => setShowDatePicker(false)} />
          </View>
        </Modal>
      )}
    </ScreenShell>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={[styles.input, multiline && styles.textArea, !editable && styles.readOnlyInput]}
        value={value}
        onChangeText={onChangeText || (() => {})}
        placeholder={placeholder}
        multiline={multiline}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 16 },
  fieldContainer: { marginBottom: 14 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 6 },
  input: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  readOnlyInput: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  infoBox: {
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  infoText: { ...typography.body.small, color: '#065f46' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    ...typography.body.small,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  chipText: { ...typography.body.small, color: colors.textPrimary },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
  dateTouchable: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  dateTouchableText: { ...typography.body.medium, color: colors.textPrimary },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  datePickerBox: {
    backgroundColor: colors.backgroundLight,
    padding: 16,
    marginTop: 'auto',
  },
});
