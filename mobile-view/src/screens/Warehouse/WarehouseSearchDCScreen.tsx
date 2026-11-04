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
import { PageSection } from '../../ui/ScreenShell';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState, SectionTitle, toneFor } from '../../ui/Kit';
import { WebInput, WebSelect, WebButton, WebLabel } from '../../ui/WebPrimitives';
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
        <EmptyState icon="🔒" title="Access denied" message="Admin only." />
        <WebButton title="Go Back" variant="outline" onPress={() => navigation.goBack()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Search DC" subtitle="Search and filter Delivery Challans" loading={loading && !searching}>
      <PageSection title="Filters">
        <WebSelect
          label="School"
          value={selectedSchool}
          onValueChange={setSelectedSchool}
          placeholder="Select school (optional)"
          items={toSelectItems(schools)}
        />

        <View style={styles.fieldContainer}>
          <WebLabel>Date</WebLabel>
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
          <View style={{ flex: 1 }}>
            <WebButton title="Search" onPress={handleSearch} loading={searching} disabled={searching || loading} />
          </View>
          <View style={{ flex: 1 }}>
            <WebButton title="Clear All" variant="outline" onPress={clearFilters} disabled={searching || loading} />
          </View>
        </View>
      </PageSection>

      <SectionTitle>{`Search Results (${dcs.length})`}</SectionTitle>

      {(loading || searching) && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>{searching ? 'Searching…' : 'Loading DCs…'}</Text>
        </View>
      )}

      {!loading && !searching && dcs.length === 0 && (
        <EmptyState icon="🔍" title="No DCs found" message="Try adjusting your filters." />
      )}

      {!loading &&
        !searching &&
        dcs.map((dc, idx) => (
          <Card key={dc._id}>
            <CardTitle title={`#${idx + 1} ${getDCNumber(dc)}`} badge={formatStatus(dc.status)} tone={toneFor(dc.status)} />
            <InfoRow label="DC Date" value={formatDate(dc.dcDate || dc.createdAt)} />
            <InfoRow label="School" value={getSchoolName(dc)} />
            <InfoRow label="Zone" value={getZone(dc)} />
            <InfoRow label="DC Category" value={cell(dc.dcCategory)} />
            <InfoRow label="Total Items" value={String(getTotalItems(dc))} />
            <InfoRow label="Created By" value={getCreatedBy(dc)} />
            <ActionRow>
              <WebButton
                title="View DC"
                variant="outline"
                onPress={() => navigation.navigate('WarehouseDCAtWarehouseDetail', { id: dc._id })}
              />
            </ActionRow>
          </Card>
        ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  fieldContainer: { marginBottom: 14 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
  loadingText: { fontSize: 14, color: colors.textSecondary },
});
