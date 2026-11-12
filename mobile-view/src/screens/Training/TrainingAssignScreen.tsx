import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  TouchableOpacity,
  Share,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { documentDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, SectionTitle } from '../../ui/Kit';
import { rk, matchesWords } from '../Reports/ReportKit';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

import { ymdToDmy } from '../../utils/dateFormat';
import PickDateField from '../../ui/DateField';
type School = {
  _id: string;
  school_code?: string;
  school_name?: string;
  school_type?: string;
  contact_person?: string;
  contact_mobile?: string;
  location?: string;
  zone?: string;
  products?: Array<{ product_name: string }> | string[];
  assigned_to?: { _id: string; name?: string };
  created_at?: string;
  createdAt?: string;
};

type Trainer = { _id: string; name: string };
type Employee = { _id: string; name: string };

const ITEMS_PER_PAGE = 10;

const PRODUCT_OPTIONS = [
  { label: 'Abacus', value: 'Abacus' },
  { label: 'Vedic Maths', value: 'Vedic Maths' },
  { label: 'EEL', value: 'EEL' },
  { label: 'IIT', value: 'IIT' },
  { label: 'Financial literacy', value: 'Financial literacy' },
  { label: 'Brain bytes', value: 'Brain bytes' },
  { label: 'Spelling bee', value: 'Spelling bee' },
  { label: 'Skill pro', value: 'Skill pro' },
  { label: 'Maths lab', value: 'Maths lab' },
  { label: 'Codechamp', value: 'Codechamp' },
];

const TERM_OPTIONS = [
  { label: 'Term 1', value: 'Term 1' },
  { label: 'Term 2', value: 'Term 2' },
  { label: 'Term 3', value: 'Term 3' },
  { label: 'Term 4', value: 'Term 4' },
];

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value?: string) {
  if (!value) return new Date();
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function todayIso() {
  return toYmd(startOfToday());
}

function DateField({
  label,
  value,
  onChange,
  showPicker,
  setShowPicker,
  minimumDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  minimumDate?: Date;
}) {
  const minYmd = minimumDate ? toYmd(minimumDate) : undefined;
  const pickerValue = (() => {
    const parsed = parseYmd(value);
    if (minimumDate && parsed < minimumDate) return minimumDate;
    return parsed;
  })();

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fieldBlock}>
        <WebLabel>{label}</WebLabel>
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          min: minYmd,
          onChange: (e: any) => {
            const next = e.target.value || '';
            if (minYmd && next && next < minYmd) return;
            onChange(next);
          },
          style: {
            width: '100%',
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            fontSize: 16,
            backgroundColor: '#fff',
            color: colors.textPrimary,
            boxSizing: 'border-box',
            marginBottom: 8,
          },
        })}
      </View>
    );
  }

  return (
    <View style={styles.fieldBlock}>
      <WebLabel>{label}</WebLabel>
      <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
        <Text style={[styles.dateText, !value && styles.datePlaceholder]}>{ymdToDmy(value) || 'Tap to pick date'}</Text>
      </TouchableOpacity>
      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={(event, d) => {
            setShowPicker(false);
            if (event.type === 'set' && d) onChange(toYmd(d));
          }}
        />
      ) : null}
      {showPicker && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.datePickerBox}>
            <DateTimePicker
              value={pickerValue}
              mode="date"
              display="spinner"
              minimumDate={minimumDate}
              onChange={(_, d) => {
                if (d) onChange(toYmd(d));
              }}
            />
            <WebButton title="Done" onPress={() => setShowPicker(false)} />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function productsLabel(products?: School['products']): string {
  if (!Array.isArray(products) || products.length === 0) return '-';
  return products
    .map((p) => (typeof p === 'string' ? p : p?.product_name || ''))
    .filter(Boolean)
    .join(', ') || '-';
}

export default function TrainingAssignScreen({ navigation }: any) {
  const [schools, setSchools] = useState<School[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [draftFilters, setDraftFilters] = useState({
    schoolCode: '',
    schoolName: '',
    mobile: '',
    town: '',
    fromDate: '',
    toDate: '',
    executive: '',
    zone: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(draftFilters);
  const [currentPage, setCurrentPage] = useState(1);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [assignType, setAssignType] = useState<'training' | 'service'>('training');
  const [submitting, setSubmitting] = useState(false);
  const [lastScheduleLabel, setLastScheduleLabel] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [assignForm, setAssignForm] = useState({
    subject: '',
    trainerId: '',
    employeeId: '',
    date: '',
    term: '',
    trainingLevel: '',
    remarks: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [completedDCsRes, tData, eData] = await Promise.all([
        apiService.get('/dc/completed').catch(() => []),
        apiService.get('/trainers?isActive=true').catch(() => apiService.get('/trainers?status=active').catch(() => [])),
        apiService.get('/employees?isActive=true').catch(() => []),
      ]);

      const completedDCs = Array.isArray(completedDCsRes)
        ? completedDCsRes
        : (completedDCsRes as any)?.data || [];
      const schoolMap = new Map<string, School>();

      completedDCs.forEach((dc: any) => {
        const dcOrder = dc.dcOrderId || {};
        const schoolName = dcOrder.school_name || dc.customerName || '';
        const schoolCode = dcOrder.school_code || dcOrder.dc_code || '';
        const key = schoolName || schoolCode || dc._id;
        if (!key || schoolMap.has(key)) return;

        let products: any[] = [];
        if (Array.isArray(dcOrder.products)) products = dcOrder.products;
        else if (dc.product) products = Array.isArray(dc.product) ? dc.product : [dc.product];

        const assigned_to = dc.employeeId
          ? {
              _id: dc.employeeId._id || dc.employeeId,
              name: dc.employeeId.name || '',
            }
          : undefined;

        schoolMap.set(key, {
          _id: dc._id,
          school_code: schoolCode,
          school_name: schoolName,
          school_type: dcOrder.school_type || 'Existing',
          contact_person: dcOrder.contact_person || '',
          contact_mobile: dcOrder.contact_mobile || dc.customerPhone || '',
          location: dcOrder.location || dcOrder.address || dc.customerAddress || '',
          zone: dcOrder.zone || '',
          products,
          assigned_to,
          created_at: dc.completedAt || dc.createdAt,
        });
      });

      setSchools(Array.from(schoolMap.values()));
      setTrainers(
        (Array.isArray(tData) ? tData : (tData as any)?.data || []).map((t: any) => ({
          _id: t._id,
          name: t.name || t.email || 'Trainer',
        })),
      );
      setEmployees(
        (Array.isArray(eData) ? eData : (eData as any)?.data || []).map((e: any) => ({
          _id: e._id,
          name: e.name || 'Employee',
        })),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load schools');
      setSchools([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const zones = useMemo(
    () => [...new Set(schools.map((s) => s.zone).filter(Boolean) as string[])].sort(),
    [schools],
  );
  const executives = useMemo(
    () =>
      [...new Set(schools.map((s) => s.assigned_to?.name).filter(Boolean) as string[])].sort(),
    [schools],
  );

  const filteredSchools = useMemo(() => {
    let filtered = [...schools];
    const f = appliedFilters;

    if (f.schoolCode) {
      filtered = filtered.filter((s) =>
        (s.school_code || '').toLowerCase().includes(f.schoolCode.toLowerCase()),
      );
    }
    if (f.schoolName) {
      filtered = filtered.filter((s) =>
        matchesWords(f.schoolName, [
          s.school_name,
          s.school_code,
          s.school_type,
          s.contact_person,
          s.contact_mobile,
          productsLabel(s.products),
          s.assigned_to?.name,
          s.location,
          s.zone,
        ]),
      );
    }
    if (f.mobile) {
      filtered = filtered.filter((s) => (s.contact_mobile || '').includes(f.mobile));
    }
    if (f.town) {
      filtered = filtered.filter((s) =>
        (s.location || '').toLowerCase().includes(f.town.toLowerCase()),
      );
    }
    if (f.executive) {
      filtered = filtered.filter((s) => s.assigned_to?.name === f.executive);
    }
    if (f.zone) {
      filtered = filtered.filter((s) => s.zone === f.zone);
    }
    if (f.fromDate) {
      const fromDate = new Date(f.fromDate);
      filtered = filtered.filter((s) => {
        const schoolDate = s.created_at ? new Date(s.created_at) : new Date(0);
        return schoolDate >= fromDate;
      });
    }
    if (f.toDate) {
      const toDate = new Date(f.toDate);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((s) => {
        const schoolDate = s.created_at ? new Date(s.created_at) : new Date(0);
        return schoolDate <= toDate;
      });
    }
    return filtered;
  }, [schools, appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / ITEMS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const paginatedSchools = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredSchools.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSchools, page]);

  const onSearch = () => {
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const headers = [
        'S.No',
        'School Code',
        'School Type',
        'School Name',
        'Contact Name',
        'Mobile',
        'Products',
        'Executive',
        'Location',
      ];
      const rows = filteredSchools.map((school, index) => [
        String(index + 1),
        school.school_code || '',
        school.school_type || 'Existing',
        school.school_name || '',
        school.contact_person || '',
        school.contact_mobile || '',
        productsLabel(school.products).replace(/^-/, ''),
        school.assigned_to?.name || '',
        school.location || '',
      ]);
      const csv = [
        headers.join(','),
        ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const filename = `existing-schools-${todayIso()}.csv`;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Alert.alert('Export complete', 'CSV downloaded.');
      return;
      }

      const dir = documentDirectory;
      if (!dir) throw new Error('File storage is not available on this device');
      const fileUri = `${dir}${filename}`;
      await writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
      try {
        await Share.share({
          title: 'Existing Schools Export',
          message: `Existing Schools export (${filteredSchools.length} schools)`,
          url: fileUri,
        });
      } catch {
        Alert.alert('Export complete', `CSV saved to:\n${fileUri}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const loadLastSchedule = async (
    school: School,
    type: 'training' | 'service',
    subject?: string,
  ) => {
    try {
      const endpoint = type === 'training' ? '/training' : '/services';
      const queries: string[] = [];
      if (school.school_code) queries.push(`schoolCode=${encodeURIComponent(school.school_code)}`);
      if (school.school_name) queries.push(`schoolName=${encodeURIComponent(school.school_name)}`);
      const byId = new Map<string, any>();
      for (const q of queries) {
        const rows = await apiService.get(`${endpoint}?${q}`).catch(() => []);
        (Array.isArray(rows) ? rows : []).forEach((r: any) => {
          const id = r._id || JSON.stringify(r);
          if (!byId.has(id)) byId.set(id, r);
        });
      }
      let completed = Array.from(byId.values()).filter((r) => r.status === 'Completed');
      if (subject?.trim()) {
        completed = completed.filter(
          (r) => String(r.subject || '').trim().toLowerCase() === subject.trim().toLowerCase(),
        );
      }
      if (!completed.length) {
        setLastScheduleLabel(null);
        return;
      }
      const latest = completed.reduce((a, b) => {
        const da = new Date(a.completionDate || a.trainingDate || a.serviceDate || 0).getTime();
        const db = new Date(b.completionDate || b.trainingDate || b.serviceDate || 0).getTime();
        return db > da ? b : a;
      });
      const d = new Date(latest.completionDate || latest.trainingDate || latest.serviceDate || '');
      const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const extra = [latest.subject, latest.term].filter(Boolean).join(' · ');
      setLastScheduleLabel(extra ? `${dateStr} (${extra})` : dateStr);
    } catch {
      setLastScheduleLabel(null);
    }
  };

  const openAssign = (school: School, type: 'training' | 'service') => {
    setSelectedSchool(school);
    setAssignType(type);
    setAssignForm({
      subject: '',
      trainerId: '',
      employeeId: school.assigned_to?._id || '',
      date: '',
      term: '',
      trainingLevel: '',
      remarks: '',
    });
    setLastScheduleLabel(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    setAssignOpen(true);
    loadLastSchedule(school, type);
  };

  useEffect(() => {
    if (!assignOpen || !selectedSchool) return;
    const t = setTimeout(() => {
      loadLastSchedule(selectedSchool, assignType, assignForm.subject || undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [assignOpen, selectedSchool, assignType, assignForm.subject]);

  const submitAssign = async () => {
    if (!selectedSchool) return;
    setErrorMessage(null);
    if (!assignForm.subject.trim()) {
      setErrorMessage('Product is required.');
      return;
    }
    if (!assignForm.trainerId.trim()) {
      setErrorMessage('Trainer is required.');
      return;
    }
    if (!assignForm.term.trim()) {
      setErrorMessage('Term is required.');
      return;
    }
    if (!assignForm.date.trim()) {
      setErrorMessage(assignType === 'training' ? 'Training Date is required.' : 'Service Date is required.');
      return;
    }
    if (assignForm.date < todayIso()) {
      setErrorMessage('Past dates cannot be selected.');
      return;
    }
    if (assignType === 'training' && !assignForm.trainingLevel.trim()) {
      setErrorMessage('Training Level is required.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = assignType === 'training' ? '/training/create' : '/services/create';
      const payload: any = {
        schoolName: selectedSchool.school_name || '',
        zone: selectedSchool.zone || '',
        town: selectedSchool.location || '',
        subject: assignForm.subject.trim(),
        trainerId: assignForm.trainerId,
        [assignType === 'training' ? 'trainingDate' : 'serviceDate']: assignForm.date,
        status: 'Scheduled',
        term: assignForm.term.trim(),
      };
      if (selectedSchool.school_code?.trim()) payload.schoolCode = selectedSchool.school_code.trim();
      if (assignForm.employeeId) payload.employeeId = assignForm.employeeId;
      if (assignType === 'training') payload.trainingLevel = assignForm.trainingLevel.trim();
      if (assignForm.remarks?.trim()) payload.remarks = assignForm.remarks.trim();

      await apiService.post(endpoint, payload);
      setSuccessMessage(
        `${assignType === 'training' ? 'Training' : 'Service'} assigned successfully.`,
      );
      setAssignOpen(false);
      setSelectedSchool(null);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  const pageButtons = useMemo(() => {
    const max = Math.min(5, totalPages);
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [totalPages]);

  return (
    <ScreenShell
      title="Existing Schools List"
      subtitle="Existing Schools"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadData();
      }}
      noScroll
      headerRight={
        <TouchableOpacity style={styles.exportBtn} onPress={exportToExcel} disabled={exporting}>
          <Text style={styles.exportBtnText}>{exporting ? '…' : 'Export'}</Text>
        </TouchableOpacity>
      }
    >
        <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        {successMessage ? (
            <MessageBanner
              type="success"
              message={successMessage}
            onDismiss={() => setSuccessMessage(null)}
            actionLabel="View list"
            onAction={() =>
              navigation.navigate(assignType === 'service' ? 'TrainingList' : 'TrainingList')
            }
          />
        ) : null}

        <PageSection title="Filters">
          <WebInput
            placeholder="Search school, code, contact, mobile, town…"
            value={draftFilters.schoolName}
            onChangeText={(v) => setDraftFilters((f) => ({ ...f, schoolName: v }))}
            returnKeyType="search"
            onSubmitEditing={onSearch}
          />
          <View style={rk.row2}>
            <View style={rk.col}>
              <WebSelect
                label="BDE"
                placeholder="All BDEs"
                value={draftFilters.executive}
                onValueChange={(v) => setDraftFilters((f) => ({ ...f, executive: v }))}
                items={executives.map((e) => ({ label: e, value: e }))}
              />
            </View>
            <View style={rk.col}>
              <WebSelect
                label="Zone"
                placeholder="All Zones"
                value={draftFilters.zone}
                onValueChange={(v) => setDraftFilters((f) => ({ ...f, zone: v }))}
                items={zones.map((z) => ({ label: z, value: z }))}
              />
            </View>
          </View>
          <PickDateField placeholder="From date" value={draftFilters.fromDate} onChange={(v) => setDraftFilters((f) => ({ ...f, fromDate: v }))} />
          <PickDateField placeholder="To date" value={draftFilters.toDate} onChange={(v) => setDraftFilters((f) => ({ ...f, toDate: v }))} />
          <View style={rk.btnRow}>
            <View style={rk.col}>
              <WebButton title="Search" onPress={onSearch} />
            </View>
            <View style={rk.col}>
              <WebButton title={exporting ? 'Exporting…' : 'Export Excel'} variant="outline" onPress={exportToExcel} disabled={exporting} />
            </View>
          </View>
        </PageSection>

        <SectionTitle>{`Existing schools (${filteredSchools.length})`}</SectionTitle>

        {paginatedSchools.length === 0 ? (
          <EmptyState title="No schools found" />
        ) : (
          paginatedSchools.map((school, index) => {
            const sno = (page - 1) * ITEMS_PER_PAGE + index + 1;
            return (
              <Card key={`${school._id}-${sno}`}>
                <CardTitle
                  title={`${sno}. ${school.school_name || 'Unnamed School'}`}
                  subtitle={school.school_code || undefined}
                  badge={school.school_type || 'Existing'}
                  tone="success"
                />
                <InfoRow label="Contact" value={school.contact_person || '-'} />
                <InfoRow label="Mobile" value={school.contact_mobile || '-'} phone />
                <InfoRow label="Products" value={productsLabel(school.products)} />
                <InfoRow label="BDE" value={school.assigned_to?.name || '-'} />
                <InfoRow label="Location" value={school.location || '-'} />
                <ActionRow>
                  <View style={rk.col}>
                    <WebButton title="Assign Training" onPress={() => openAssign(school, 'training')} />
                  </View>
                  <View style={rk.col}>
                    <WebButton title="Assign Service" variant="outline" onPress={() => openAssign(school, 'service')} />
                  </View>
                </ActionRow>
              </Card>
            );
          })
        )}

        {filteredSchools.length > 0 ? (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
              disabled={page === 1}
              onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <Text style={styles.pageBtnText}>Previous</Text>
            </TouchableOpacity>
            {pageButtons.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.pageNumBtn, page === p && styles.pageNumBtnActive]}
                onPress={() => setCurrentPage(p)}
              >
                <Text style={[styles.pageNumText, page === p && styles.pageNumTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
              disabled={page === totalPages}
              onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={styles.pageBtnText}>Next</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={assignOpen} animationType="slide" transparent onRequestClose={() => setAssignOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Assign {assignType === 'training' ? 'Training' : 'Service'}
            </Text>
            <Text style={styles.modalSub}>{selectedSchool?.school_name || ''}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {errorMessage ? (
                <MessageBanner type="error" message={errorMessage} onDismiss={() => setErrorMessage(null)} />
              ) : null}
              <WebSelect
                label="Product *"
                value={assignForm.subject}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, subject: v }))}
                items={PRODUCT_OPTIONS}
                placeholder="Select Product"
              />
              {lastScheduleLabel ? (
                <>
                  <WebLabel>Last completed</WebLabel>
                  <Text style={styles.lastSchedule}>{lastScheduleLabel}</Text>
                </>
              ) : null}
              <WebSelect
                label="Trainer *"
                value={assignForm.trainerId}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, trainerId: v }))}
                items={trainers.map((t) => ({ label: t.name, value: t._id }))}
                placeholder="Select Trainer"
              />
              <WebSelect
                label="Employee"
                value={assignForm.employeeId}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, employeeId: v }))}
                items={employees.map((e) => ({ label: e.name, value: e._id }))}
                placeholder="Select Employee"
              />
              <WebSelect
                label="Term *"
                value={assignForm.term}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, term: v }))}
                items={TERM_OPTIONS}
                placeholder="Select Term"
              />
              <DateField
                label={assignType === 'training' ? 'Training Date *' : 'Service Date *'}
                value={assignForm.date}
                onChange={(v) => setAssignForm((f) => ({ ...f, date: v }))}
                showPicker={showDatePicker}
                setShowPicker={setShowDatePicker}
                minimumDate={startOfToday()}
              />
              {assignType === 'training' ? (
                <>
                  <WebLabel>Training Level *</WebLabel>
                  <WebInput
                    value={assignForm.trainingLevel}
                    onChangeText={(v) => setAssignForm((f) => ({ ...f, trainingLevel: v }))}
                    placeholder="L1 / L2 …"
                  />
                </>
              ) : null}
              <WebLabel>Remarks</WebLabel>
              <WebInput
                value={assignForm.remarks}
                onChangeText={(v) => setAssignForm((f) => ({ ...f, remarks: v }))}
                placeholder="Optional notes"
            multiline
                style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
        </ScrollView>
            <View style={styles.modalFooter}>
              <View style={rk.col}>
                <WebButton title="Cancel" variant="outline" onPress={() => setAssignOpen(false)} disabled={submitting} />
              </View>
              <View style={rk.col}>
                <WebButton
                  title={submitting ? 'Assigning…' : 'Assign'}
                  onPress={submitAssign}
                  loading={submitting}
                />
              </View>
            </View>
          </View>
          </View>
        </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 4 },
  pageBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.backgroundLight,
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  pageNumBtn: {
    minWidth: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  pageNumBtnActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  pageNumText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  pageNumTextActive: { color: colors.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '90%',
    padding: 16,
    gap: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalSub: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
  lastSchedule: {
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundMuted,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  fieldBlock: { marginBottom: 4 },
  dateTouchable: {
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: colors.backgroundLight,
  },
  dateText: { fontSize: 15, color: colors.textPrimary },
  datePlaceholder: { color: colors.textMuted },
  modalFooter: { flexDirection: 'row', gap: 8, marginTop: 8 },
  datePickerBox: { backgroundColor: colors.backgroundLight, padding: 16, marginTop: 'auto' },
});
