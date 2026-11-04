import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Image,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';
import { Card, CardTitle, InfoRow, EmptyState, type Tone } from '../../ui/Kit';
import { SearchBar, matchesWords, ui } from '../../components/dc/DcUi';

export type DCRow = {
  _id: string;
  saleId?: { customerName?: string; product?: string };
  dcOrderId?: {
    _id?: string;
    school_name?: string;
    school_code?: string;
    contact_mobile?: string;
    products?: Array<{ product_name?: string; product?: string }>;
  };
  customerName?: string;
  customerPhone?: string;
  product?: string;
  status?: string;
  poPhotoUrl?: string;
  createdAt?: string;
  employeeId?: { _id?: string; name?: string } | string;
};

function getExecutiveName(dc: DCRow) {
  if (typeof dc.employeeId === 'object' && dc.employeeId?.name) return dc.employeeId.name;
  return 'Not Assigned';
}

function getCustomerName(dc: DCRow) {
  return dc.customerName || dc.saleId?.customerName || dc.dcOrderId?.school_name || '—';
}

function getSchoolCode(dc: DCRow) {
  return (dc.dcOrderId as any)?.school_code || '—';
}

function getProduct(dc: DCRow) {
  if (dc.product || dc.saleId?.product) return dc.product || dc.saleId?.product || '—';
  const prods = dc.dcOrderId?.products;
  if (Array.isArray(prods)) {
    return prods.map((p) => p.product_name || p.product).filter(Boolean).join(', ') || '—';
  }
  return '—';
}

function formatCreatedOn(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusTone(status?: string): Tone {
  if (status === 'po_submitted') return 'warning';
  if (status === 'created' || !status) return 'info';
  return 'neutral';
}

/** Matches web `dashboard/dc/admin/my` */
export default function DCAdminFullView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin';

  const [items, setItems] = useState<DCRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [backendSearching, setBackendSearching] = useState(false);

  const [selectedDC, setSelectedDC] = useState<DCRow | null>(null);
  const [poPhotoUrl, setPoPhotoUrl] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);

  const [raiseModalOpen, setRaiseModalOpen] = useState(false);
  const [selectedForRaise, setSelectedForRaise] = useState<DCRow | null>(null);
  const [raising, setRaising] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/dc?status=created');
      let list: DCRow[] = Array.isArray(data) ? data : [];
      if (filterEmployee) {
        list = list.filter((dc) => {
          const empId = typeof dc.employeeId === 'object' ? dc.employeeId?._id : dc.employeeId;
          return empId === filterEmployee;
        });
      }
      setItems(list);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load DCs');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterEmployee]);

  const loadEmployees = async () => {
    try {
      const data = await apiService.get('/employees?isActive=true');
      const list = Array.isArray(data) ? data : [];
      setEmployees(
        list
          .map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' }))
          .filter((e) => e.name !== 'Unknown')
      );
    } catch {
      setEmployees([]);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    load();
    loadEmployees();
  }, [isAdmin, load]);

  const searchBySchoolCode = async (code: string) => {
    if (!code || code.length < 3) return;
    setBackendSearching(true);
    try {
      const results = await apiService.get(`/dc-orders?school_code=${encodeURIComponent(code)}`);
      if (Array.isArray(results) && results.length) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i._id));
          const mapped: DCRow[] = results
            .filter((r: any) => !existingIds.has(r._id))
            .map((r: any) => ({
              _id: r._id,
              customerName: r.school_name || '',
              customerPhone: r.contact_mobile || '',
              status: r.status || 'created',
              dcOrderId: {
                _id: r._id,
                school_name: r.school_name,
                school_code: r.school_code,
                contact_mobile: r.contact_mobile,
                products: r.products,
              },
              employeeId: r.assigned_to,
            }));
          return [...prev, ...mapped];
        });
      }
    } catch {
      /* local filter still applies */
    } finally {
      setBackendSearching(false);
    }
  };

  useEffect(() => {
    const isCodeLike = /^[a-zA-Z]{2,5}\d*/i.test(searchQuery);
    if (!isCodeLike) return;
    const t = setTimeout(() => searchBySchoolCode(searchQuery), 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const filteredItems = items.filter((d) => {
    const matchesSearch = matchesWords(searchQuery, [
      getSchoolCode(d),
      getCustomerName(d),
      getExecutiveName(d),
      d.customerPhone || d.dcOrderId?.contact_mobile,
      getProduct(d),
      d.status || 'created',
    ]);
    const empId = typeof d.employeeId === 'object' ? d.employeeId?._id : d.employeeId;
    const matchesEmployee = !filterEmployee || empId === filterEmployee;
    return matchesSearch && matchesEmployee;
  });

  const openSubmitDialog = (dc: DCRow) => {
    setSelectedDC(dc);
    setPoPhotoUrl(dc.poPhotoUrl || '');
    setRemarks('');
    setPoModalOpen(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        const mime = asset.mimeType || 'image/jpeg';
        setPoPhotoUrl(`data:${mime};base64,${asset.base64}`);
      } else if (asset.uri) {
        setPoPhotoUrl(asset.uri);
      }
    }
  };

  const submitPO = async () => {
    if (!selectedDC || !poPhotoUrl.trim()) {
      Alert.alert('Missing information', 'Please provide a PO photo URL or upload a file.');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.put(`/dc/${selectedDC._id}`, {
        poPhotoUrl,
        poDocument: poPhotoUrl,
        deliveryNotes: remarks,
      });
      Alert.alert('Success', 'PO photo updated successfully!');
      setPoModalOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update PO photo');
    } finally {
      setSubmitting(false);
    }
  };

  const openRaiseDialog = (dc: DCRow) => {
    setSelectedForRaise(dc);
    setRaiseModalOpen(true);
  };

  const confirmRaiseDc = async () => {
    if (!selectedForRaise) return;
    const dcOrderId =
      typeof selectedForRaise.dcOrderId === 'object'
        ? selectedForRaise.dcOrderId?._id
        : selectedForRaise.dcOrderId;
    if (!dcOrderId) {
      Alert.alert('Error', 'No associated deal found for this DC.');
      return;
    }
    setRaising(true);
    try {
      await apiService.put(`/dc-orders/${dcOrderId}`, { status: 'saved' });
      Alert.alert('Success', 'DC raised successfully. It will now appear in Closed Sales.');
      setRaiseModalOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to raise DC');
    } finally {
      setRaising(false);
    }
  };

  if (!isAdmin) {
    return (
      <ScreenShell title="All Created DCs" showBack>
        <PageSection title="Access denied">
          <Text>You do not have permission to access this page.</Text>
        </PageSection>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="All Created DCs"
      subtitle="Admin view"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      headerRight={
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} hitSlop={8}>
          <Text style={{ color: colors.primaryDark, fontWeight: '600', fontSize: 15 }}>Refresh</Text>
        </TouchableOpacity>
      }
    >
      <SearchBar placeholder="Search school, code, executive, phone, product…" value={searchQuery} onChangeText={setSearchQuery} />
      {backendSearching ? <Text style={styles.hint}>Searching backend…</Text> : null}
      <WebSelect
        value={filterEmployee}
        onValueChange={setFilterEmployee}
        placeholder="All Executives"
        items={employees.map((e) => ({ label: e.name, value: e._id }))}
      />
      {filterEmployee ? (
        <WebButton title="Clear filter" variant="outline" onPress={() => setFilterEmployee('')} />
      ) : null}

      {filteredItems.length === 0 ? (
        <EmptyState title="No created DCs" message="DCs are created automatically when a deal is assigned to an employee." />
      ) : (
        <>
          <Text style={ui.count}>{filteredItems.length} DC{filteredItems.length === 1 ? '' : 's'}</Text>
          {filteredItems.map((d) => {
            const phone = d.customerPhone || d.dcOrderId?.contact_mobile || '—';
            const status = d.status || 'created';
            const code = getSchoolCode(d);
            return (
              <Card key={d._id}>
                <CardTitle
                  title={getCustomerName(d)}
                  subtitle={code === '—' ? 'No school code' : `Code ${code}`}
                  badge={status}
                  tone={statusTone(status)}
                />
                <InfoRow label="Created" value={formatCreatedOn(d.createdAt)} />
                <InfoRow label="Executive" value={getExecutiveName(d)} />
                <InfoRow label="Phone" value={phone === '—' ? '' : phone} phone />
                <InfoRow label="Product" value={getProduct(d) === '—' ? '' : getProduct(d)} />
                <InfoRow label="PO photo" value={d.poPhotoUrl ? 'Uploaded' : 'Not uploaded'} />
              </Card>
            );
          })}
        </>
      )}

      <Modal visible={poModalOpen} animationType="slide" transparent onRequestClose={() => setPoModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {selectedDC?.poPhotoUrl ? 'Update' : 'Add'} Purchase Order (PO) Photo
            </Text>
            <Text style={styles.modalSub}>
              Executive: {selectedDC ? getExecutiveName(selectedDC) : '—'}
            </Text>
            <ScrollView>
              <WebLabel>PO Photo URL or upload</WebLabel>
              <WebInput placeholder="https://..." value={poPhotoUrl} onChangeText={setPoPhotoUrl} />
              <WebButton title="Pick image" variant="outline" onPress={pickImage} />
              {poPhotoUrl ? <Image source={{ uri: poPhotoUrl }} style={styles.preview} /> : null}
              <WebLabel>Remarks (optional)</WebLabel>
              <WebInput
                placeholder="Add remarks..."
                value={remarks}
                onChangeText={setRemarks}
                multiline
                style={{ minHeight: 80 }}
              />
            </ScrollView>
            <View style={styles.modalFooter}>
              <View style={styles.flex1}><WebButton title="Cancel" variant="outline" onPress={() => setPoModalOpen(false)} /></View>
              <View style={styles.flex1}><WebButton title="Save" onPress={submitPO} loading={submitting} disabled={!poPhotoUrl.trim()} /></View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={raiseModalOpen} animationType="slide" transparent onRequestClose={() => setRaiseModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Raise DC</Text>
            <Text style={styles.modalSub}>
              Raising DC will move this deal into Closed Sales so DC details can be managed there.
            </Text>
            {selectedForRaise ? (
              <View style={styles.raiseSummary}>
                <InfoRow label="School" value={getCustomerName(selectedForRaise)} bold />
                <InfoRow label="Executive" value={getExecutiveName(selectedForRaise)} />
                <InfoRow label="Phone" value={selectedForRaise.customerPhone || selectedForRaise.dcOrderId?.contact_mobile || '—'} />
                <InfoRow label="Products" value={getProduct(selectedForRaise)} />
                <InfoRow label="Status" value={selectedForRaise.status || 'created'} />
              </View>
            ) : null}
            <View style={styles.modalFooter}>
              <View style={styles.flex1}><WebButton title="Cancel" variant="outline" onPress={() => setRaiseModalOpen(false)} disabled={raising} /></View>
              <View style={styles.flex1}><WebButton title="Raise DC" onPress={confirmRaiseDc} loading={raising} /></View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
  flex1: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 16, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  modalSub: { fontSize: 13, color: colors.textTertiary, marginBottom: 12 },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 12 },
  preview: { width: '100%', height: 160, borderRadius: 10, marginVertical: 12 },
  raiseSummary: { marginBottom: 8 },
});
