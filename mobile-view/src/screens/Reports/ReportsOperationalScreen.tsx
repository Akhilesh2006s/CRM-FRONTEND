import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory, downloadAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, radii, spacing } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService, getApiUrl } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

type ReportCatalogItem = { key: string; title: string; description: string };
type ReportColumn = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime';
};
type ReportPayload = {
  report: ReportCatalogItem;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: Record<string, unknown>;
  notes?: string[];
  generatedAt: string;
};

type Filters = {
  fromDate: string;
  toDate: string;
  academicYear: string;
  zone: string;
  schoolCode: string;
  search: string;
};

const emptyFilters: Filters = { fromDate: '', toDate: '', academicYear: '', zone: '', schoolCode: '', search: '' };
const PAGE_SIZE = 50;

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown, type?: ReportColumn['type']) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  if (type === 'percent')
    return `${(Number(value || 0) * 100).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
  if (type === 'number') return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (type === 'date' || type === 'datetime') {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(
        'en-GB',
        type === 'date' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }
      );
    }
  }
  return String(value);
}

function buildQuery(f: Filters) {
  const parts: string[] = [];
  (Object.keys(f) as (keyof Filters)[]).forEach((k) => {
    const v = f[k].trim();
    if (v) parts.push(`${k}=${encodeURIComponent(v)}`);
  });
  parts.push('limit=1000');
  return parts.join('&');
}

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

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fieldBlock}>
        <WebLabel>{label}</WebLabel>
        {React.createElement('input', {
          type: 'date',
          value: value || '',
          onChange: (e: any) => onChange(e.target.value || ''),
          style: {
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            fontSize: 15,
            backgroundColor: '#fff',
            color: colors.textPrimary,
            boxSizing: 'border-box',
            marginBottom: 12,
          },
        })}
      </View>
    );
  }

  return (
    <View style={styles.fieldBlock}>
      <WebLabel>{label}</WebLabel>
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateTouchable} onPress={() => setShow(true)} activeOpacity={0.7}>
          <Text style={[styles.dateText, !value && styles.datePlaceholder]}>{value || 'Any'}</Text>
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={10} style={styles.dateClear}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {show && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseYmd(value)}
          mode="date"
          display="default"
          onChange={(event, d) => {
            setShow(false);
            if (event.type === 'set' && d) onChange(toYmd(d));
          }}
        />
      ) : null}
      {show && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.datePickerBox}>
            <DateTimePicker
              value={parseYmd(value)}
              mode="date"
              display="spinner"
              onChange={(_, d) => {
                if (d) onChange(toYmd(d));
              }}
            />
            <WebButton title="Done" onPress={() => setShow(false)} />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

async function downloadOperationalReport(reportKey: string, queryString: string) {
  const url = `${getApiUrl()}/reports/operational/${encodeURIComponent(reportKey)}/export?${queryString}`;
  const filename = `${reportKey}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const token = await AsyncStorage.getItem('authToken');
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const res = await fetch(url, { headers });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to export report');
    }
    const blob = await res.blob();
    if (!blob.size) throw new Error('Export returned an empty file');
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
    document.body.removeChild(anchor);
    return;
  }

  if (!documentDirectory) throw new Error('File storage is not available on this device');
  const result = await downloadAsync(url, `${documentDirectory}${filename}`, { headers });
  if (result.status !== 200) throw new Error(`Export failed (${result.status})`);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Operational report',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  } else {
    Alert.alert('Export complete', `Excel file saved to:\n${result.uri}`);
  }
}

export default function ReportsOperationalScreen() {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [reportKey, setReportKey] = useState('collections');
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  /** Filters applied to the last load (web reloads on every keystroke; mobile applies on button press). */
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    apiService
      .get('/reports/operational')
      .then((items: ReportCatalogItem[]) => {
        const list = Array.isArray(items) ? items : [];
        setCatalog(list);
        setReportKey((prev) => (list.length && !list.some((i) => i.key === prev) ? list[0].key : prev));
      })
      .catch((e: any) => setBanner({ type: 'error', message: errMsg(e, 'Failed to load report catalog') }));
  }, []);

  const queryString = useMemo(() => buildQuery(applied), [applied]);

  const loadReport = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const response = await apiService.get(`/reports/operational/${encodeURIComponent(reportKey)}?${queryString}`);
      if (id !== reqId.current) return;
      setPayload(response as ReportPayload);
      setVisibleCount(PAGE_SIZE);
    } catch (e: any) {
      if (id !== reqId.current) return;
      setPayload(null);
      setBanner({ type: 'error', message: errMsg(e, 'Failed to load report') });
    } finally {
      if (id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [queryString, reportKey]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const applyFilters = () => {
    // Same object content still forces a reload, like the web "Apply filters" button.
    setApplied({ ...filters });
    if (buildQuery(filters) === queryString) loadReport();
  };

  // Web reloads as soon as the inputs clear, so clearing also re-runs the report here.
  const clearFilters = () => {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
  };

  const exportReport = async () => {
    try {
      setExporting(true);
      await downloadOperationalReport(reportKey, queryString);
      setBanner({ type: 'success', message: 'Excel report downloaded' });
    } catch (e: any) {
      setBanner({ type: 'error', message: errMsg(e, 'Failed to export report') });
    } finally {
      setExporting(false);
    }
  };

  const setField = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const selected = catalog.find((i) => i.key === reportKey);
  const rows = payload?.rows || [];
  const columns = payload?.columns || [];
  const titleCol = columns[0];
  const restCols = columns.slice(1);

  return (
    <ScreenShell
      title="Operational Reports"
      subtitle="Collections, school status, PO/DC, master lists, schedules, visits, returns, and ledger."
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        loadReport();
      }}
    >
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <View style={styles.panel}>
        <WebSelect
          label="Report"
          value={reportKey}
          onValueChange={(v) => v && setReportKey(v)}
          items={catalog.map((i) => ({ label: i.title, value: i.key }))}
          placeholder={catalog.length ? 'Select report' : 'Loading reports…'}
        />

        <TouchableOpacity style={styles.filterToggle} onPress={() => setShowFilters((s) => !s)} activeOpacity={0.7}>
          <Ionicons name="funnel-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.filterToggleText}>{showFilters ? 'Hide filters' : 'Show filters'}</Text>
          <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primaryDark} />
        </TouchableOpacity>

        {showFilters ? (
          <>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <DateField label="From date" value={filters.fromDate} onChange={setField('fromDate')} />
              </View>
              <View style={styles.col}>
                <DateField label="To date" value={filters.toDate} onChange={setField('toDate')} />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <WebLabel>Academic year</WebLabel>
                <WebInput placeholder="2026-27" value={filters.academicYear} onChangeText={setField('academicYear')} />
              </View>
              <View style={styles.col}>
                <WebLabel>Zone</WebLabel>
                <WebInput placeholder="Zone" value={filters.zone} onChangeText={setField('zone')} />
              </View>
            </View>
            <WebLabel>School code</WebLabel>
            <WebInput
              placeholder="School code"
              value={filters.schoolCode}
              onChangeText={setField('schoolCode')}
              autoCapitalize="characters"
            />
            <WebLabel>Search</WebLabel>
            <WebInput
              placeholder="Search any displayed field"
              value={filters.search}
              onChangeText={setField('search')}
              returnKeyType="search"
              onSubmitEditing={applyFilters}
            />
            <View style={styles.btnRow}>
              <View style={styles.col}>
                <WebButton title="Apply filters" onPress={applyFilters} disabled={loading} />
              </View>
              <View style={styles.col}>
                <WebButton title="Clear" variant="outline" onPress={clearFilters} />
              </View>
            </View>
          </>
        ) : null}

        <WebButton
          title={exporting ? 'Exporting…' : 'Export Excel'}
          variant="outline"
          onPress={exportReport}
          disabled={loading || exporting || !payload}
        />
      </View>

      <Text style={styles.reportTitle}>{payload?.report?.title || selected?.title || 'Report'}</Text>
      {payload?.report?.description || selected?.description ? (
        <Text style={styles.reportDesc}>{payload?.report?.description || selected?.description}</Text>
      ) : null}

      {payload && Object.keys(payload.summary || {}).length > 0 ? (
        <View style={styles.summaryGrid}>
          {Object.entries(payload.summary).map(([key, value]) => (
            <View key={key} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{formatLabel(key)}</Text>
              <Text style={styles.summaryValue}>
                {typeof value === 'number'
                  ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                  : String(value ?? '—')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {payload?.notes?.map((note) => (
        <View key={note} style={styles.note}>
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ))}

      <View style={styles.rowsHeader}>
        <Text style={styles.rowsCount}>{loading ? 'Loading…' : `${rows.length} rows`}</Text>
        {payload?.generatedAt ? (
          <Text style={styles.generated}>Generated {new Date(payload.generatedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
        ) : null}
      </View>

      {!loading && rows.length === 0 ? <Text style={styles.empty}>No records match these filters.</Text> : null}

      {!loading
        ? rows.slice(0, visibleCount).map((row, index) => (
            <View key={index} style={styles.rowCard}>
              {titleCol ? (
                <Text style={styles.rowTitle}>{formatValue(row[titleCol.key], titleCol.type)}</Text>
              ) : null}
              {restCols.map((c) => (
                <View key={c.key} style={styles.kv}>
                  <Text style={styles.kvLabel}>{c.label}</Text>
                  <Text style={[styles.kvValue, c.type && c.type !== 'text' ? styles.kvValueRight : null]}>
                    {formatValue(row[c.key], c.type)}
                  </Text>
                </View>
              ))}
            </View>
          ))
        : null}

      {!loading && rows.length > visibleCount ? (
        <WebButton
          title={`Show more (${rows.length - visibleCount} remaining)`}
          variant="outline"
          onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  filterToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  filterToggleText: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  fieldBlock: { marginBottom: 0 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateTouchable: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.backgroundLight,
  },
  dateClear: { marginLeft: 6, marginBottom: 12 },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  datePlaceholder: { color: colors.textMuted },
  datePickerBox: { backgroundColor: colors.backgroundLight, padding: 16, marginTop: 'auto' },
  reportTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  reportDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.sm },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: spacing.sm },
  summaryCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  summaryLabel: { fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 4 },
  note: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: spacing.sm,
  },
  noteText: { fontSize: 13, color: '#78350F' },
  rowsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowsCount: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  generated: { fontSize: 12, color: colors.textTertiary },
  empty: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl },
  rowCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: spacing.sm,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  kv: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 8,
  },
  kvLabel: { flex: 1, fontSize: 12, color: colors.textTertiary },
  kvValue: { flex: 1.3, fontSize: 13, color: colors.textPrimary },
  kvValueRight: { textAlign: 'right' },
});
