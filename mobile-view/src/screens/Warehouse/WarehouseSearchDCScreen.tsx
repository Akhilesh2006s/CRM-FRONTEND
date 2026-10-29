import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';

import DateField from '../../ui/DateField';
const DC_STATUSES = [
  'created',
  'po_submitted',
  'sent_to_manager',
  'pending_dc',
  'warehouse_processing',
  'completed',
  'hold',
  'scheduled_for_later',
];

const DEFAULT_DC_CATEGORIES = ['Term 1', 'Term 2', 'Term 3', 'Full Year', 'New School'];

function toSelectItems(options: string[]) {
  return options.map((o) => ({ label: o, value: o }));
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '-';
  }
}

function formatStatus(status?: string) {
  if (!status) return '-';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function cell(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

export default function WarehouseSearchDCScreen({ navigation }: any) {
  const { user } = useAuth();
  const [schools, setSchools] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [dcCategories, setDcCategories] = useState<string[]>(DEFAULT_DC_CATEGORIES);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDCCategory, setSelectedDCCategory] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [dcs, setDcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';

  const extractFilterOptions = useCallback((arr: any[]) => {
    const s = new Set<string>();
    const z = new Set<string>();
    const p = new Set<string>();
    const c = new Set<string>(DEFAULT_DC_CATEGORIES);

    arr.forEach((dc: any) => {
      const school = dc.dcOrderId?.school_name || dc.dcOrderId?.schoolName || dc.customerName || '';
      const zone = dc.dcOrderId?.zone || dc.zone || '';
      if (school) s.add(school);
      if (zone) z.add(zone);
      if (dc.dcCategory) c.add(dc.dcCategory);
      if (Array.isArray(dc.productDetails)) {
        dc.productDetails.forEach((pd: any) => {
          if (pd.product) p.add(pd.product);
        });
      }
    });

    setSchools(Array.from(s).sort());
    setZones(Array.from(z).sort());
    setProducts(Array.from(p).sort());
    setDcCategories(Array.from(c).sort());
  }, []);

  const loadAllDCs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get('/dc');
      const arr = Array.isArray(data) ? data : [];
      setDcs(arr);
      extractFilterOptions(arr);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load DCs');
      setDcs([]);
    } finally {
      setLoading(false);
    }
  }, [extractFilterOptions]);

  useEffect(() => {
    if (isAdmin) loadAllDCs();
  }, [isAdmin, loadAllDCs]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const hasFilters =
        selectedSchool || selectedZone || selectedStatus || selectedDate || selectedProduct || selectedDCCategory;

      if (!hasFilters) {
        await loadAllDCs();
        return;
      }

      const params = new URLSearchParams();
      if (selectedSchool) params.append('schoolName', selectedSchool);
      if (selectedZone) params.append('zone', selectedZone);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedDCCategory) params.append('visitCategory', selectedDCCategory);
      if (selectedDate) {
        params.append('fromDate', selectedDate);
        params.append('toDate', selectedDate);
      }

      const data = await apiService.get(`/dc?${params.toString()}`);
      let filtered = Array.isArray(data) ? data : [];

      if (selectedProduct) {
        filtered = filtered.filter((dc: any) =>
          dc.productDetails?.some((pd: any) =>
            (pd.product || '').toLowerCase().includes(selectedProduct.toLowerCase()),
          ),
        );
      }

      setDcs(filtered);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const clearFilters = () => {
    setSelectedSchool('');
    setSelectedZone('');
    setSelectedStatus('');
    setSelectedProduct('');
    setSelectedDCCategory('');
    setSelectedDate('');
    loadAllDCs();
  };

  const getSchoolName = (dc: any) =>
    dc.dcOrderId?.school_name || dc.dcOrderId?.schoolName || dc.customerName || '-';

  const getZone = (dc: any) => dc.dcOrderId?.zone || dc.zone || '-';

  const getDCNumber = (dc: any) => dc.dc_code || `DC-${String(dc._id || '').slice(-6)}`;

  const getTotalItems = (dc: any) => {
    if (!Array.isArray(dc.productDetails)) return 0;
    return dc.productDetails.reduce(
      (sum: number, pd: any) => sum + (pd.strength || pd.quantity || 0),
      0,
    );
  };

  const getCreatedBy = (dc: any) => dc.employeeId?.name || '-';

  if (!isAdmin) {
    return (
      <ScreenShell title="Search DC">
        <Text style={styles.errorText}>Access denied. Admin only.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Search DC" loading={loading && !searching}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>Search and filter Delivery Challans</Text>

        <View style={styles.filterCard}>
          <WebSelect
            label="School"
            value={selectedSchool}
            onValueChange={setSelectedSchool}
            placeholder="Select school (optional)"
            items={toSelectItems(schools)}
          />

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Date</Text>
            <DateField placeholder="Date" value={selectedDate} onChange={setSelectedDate} />
          </View>

          <WebSelect
            label="Product"
            value={selectedProduct}
            onValueChange={setSelectedProduct}
            placeholder="Select product (optional)"
            items={toSelectItems(products)}
          />

          <WebSelect
            label="Status"
            value={selectedStatus}
            onValueChange={setSelectedStatus}
            placeholder="Select status (optional)"
            items={DC_STATUSES.map((s) => ({ label: formatStatus(s), value: s }))}
          />

          <WebSelect
            label="DC Category"
            value={selectedDCCategory}
            onValueChange={setSelectedDCCategory}
            placeholder="Select DC category (optional)"
            items={toSelectItems(dcCategories)}
          />

          <WebSelect
            label="Zone"
            value={selectedZone}
            onValueChange={setSelectedZone}
            placeholder="Select zone (optional)"
            items={toSelectItems(zones)}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.searchButton, (searching || loading) && styles.buttonDisabled]}
              onPress={handleSearch}
              disabled={searching || loading}
            >
              {searching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clearButton, (searching || loading) && styles.buttonDisabled]}
              onPress={clearFilters}
              disabled={searching || loading}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Search Results ({dcs.length})</Text>
        </View>

        {(loading || searching) && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>{searching ? 'Searching…' : 'Loading DCs…'}</Text>
          </View>
        )}

        {!loading && !searching && dcs.length === 0 && (
          <Text style={styles.emptyText}>No DCs found. Try adjusting your filters.</Text>
        )}

        {!loading &&
          !searching &&
          dcs.map((dc, idx) => (
            <View key={dc._id} style={styles.resultCard}>
              <View style={styles.resultTop}>
                <Text style={styles.resultIndex}>#{idx + 1}</Text>
                <Text style={styles.dcNumber}>{getDCNumber(dc)}</Text>
              </View>
              <InfoRow label="DC Date" value={formatDate(dc.dcDate || dc.createdAt)} />
              <InfoRow label="School" value={getSchoolName(dc)} />
              <InfoRow label="Zone" value={getZone(dc)} />
              <InfoRow label="DC Category" value={cell(dc.dcCategory)} />
              <InfoRow label="Status" value={formatStatus(dc.status)} />
              <InfoRow label="Total Items" value={String(getTotalItems(dc))} />
              <InfoRow label="Created By" value={getCreatedBy(dc)} />
              <TouchableOpacity
                style={styles.viewButton}
                onPress={() => navigation.navigate('WarehouseDCAtWarehouseDetail', { id: dc._id })}
              >
                <Text style={styles.viewButtonText}>View DC</Text>
              </TouchableOpacity>
            </View>
          ))}
      </ScrollView>
    </ScreenShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 40 },
  subtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 16 },
  filterCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 16,
  },
  fieldContainer: { marginBottom: 12 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: {
    ...typography.body.medium,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  searchButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  searchButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  clearButton: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: { color: colors.textPrimary, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  resultsHeader: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 12,
  },
  resultsTitle: { ...typography.label.large, color: colors.textPrimary, fontWeight: '600' },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 20 },
  loadingText: { ...typography.body.medium, color: colors.textSecondary },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  resultCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  resultIndex: { ...typography.label.small, color: colors.textSecondary },
  dcNumber: { ...typography.label.large, color: colors.textPrimary, fontWeight: '600' },
  infoRow: { flexDirection: 'row', marginBottom: 6 },
  infoLabel: { ...typography.body.small, color: colors.textSecondary, width: 110 },
  infoValue: { ...typography.body.small, color: colors.textPrimary, flex: 1 },
  viewButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  viewButtonText: { ...typography.label.medium, color: colors.textPrimary, fontWeight: '600' },
  errorText: { color: colors.error || '#ef4444', textAlign: 'center', padding: 24 },
  backBtn: { alignSelf: 'center', marginTop: 16, padding: 12, backgroundColor: colors.primary, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '600' },
});
