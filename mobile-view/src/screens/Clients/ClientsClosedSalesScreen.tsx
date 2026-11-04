/**
 * Executive Manager: PO Edit Request
 * Matches web Clients → PO Edit Request (filters, Edit Pending, Take Action)
 * Includes field edits (pendingEdit) and edited PO PDFs from the executive dashboard (poChangeRequest).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  RefreshControl,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { apiService, getApiUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, ActionRow, EmptyState } from '../../ui/Kit';
import MessageBanner from '../../components/MessageBanner';
import { colors, radii, spacing } from '../../theme/colors';

type Product = {
  product_name?: string;
  product?: string;
  quantity?: number;
  unit_price?: number;
};

type PendingEdit = {
  school_name?: string;
  contact_person?: string;
  contact_mobile?: string;
  contact_person2?: string;
  contact_mobile2?: string;
  email?: string;
  address?: string;
  school_type?: string;
  zone?: string;
  location?: string;
  products?: Product[];
  pod_proof_url?: string;
  remarks?: string;
  total_amount?: number;
  transport_name?: string;
  transport_location?: string;
  transportation_landmark?: string;
  property_number?: string;
  floor?: string;
  tower_block?: string;
  nearby_landmark?: string;
  area?: string;
  city?: string;
  pincode?: string;
  requestedBy?: { _id?: string; name?: string; email?: string } | string;
  requestedAt?: string;
  status?: string;
};

type PoChangeRequest = {
  status?: string;
  oldPdfUrl?: string;
  newPdfUrl?: string;
  remarks?: string;
  requestedBy?: { _id?: string; name?: string; email?: string } | string;
  requestedAt?: string;
};

type DcOrder = {
  _id: string;
  school_name?: string;
  schoolName?: string;
  school_code?: string;
  school_type?: string;
  zone?: string;
  location?: string;
  address?: string;
  contact_mobile?: string;
  products?: Product[];
  assigned_to?: { _id?: string; name?: string } | string;
  employeeId?: { _id?: string; name?: string } | string;
  created_at?: string;
  createdAt?: string;
  pod_proof_url?: string;
  pendingEdit?: PendingEdit | null;
  poChangeRequest?: PoChangeRequest | null;
  property_number?: string;
  floor?: string;
  tower_block?: string;
  nearby_landmark?: string;
  area?: string;
  city?: string;
  pincode?: string;
};

type Filters = {
  schoolName: string;
  mobile: string;
  fromDate: string;
  toDate: string;
  zone: string;
  executive: string;
  town: string;
};

const EMPTY_FILTERS: Filters = {
  schoolName: '',
  mobile: '',
  fromDate: '',
  toDate: '',
  zone: '',
  executive: '',
  town: '',
};

const APPROVE_SUCCESS_TITLE = 'PO edit request approved successfully!';
const APPROVE_SUCCESS_BODY =
  'Changes have been applied to the database and will be reflected in all closed sales views.';

function idOf(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return String(val._id || val.id || '');
}

function errMsg(e: any, fallback: string) {
  return e?.response?.data?.message || e?.message || fallback;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function productsDisplay(order: DcOrder) {
  const fromEdit =
    order.pendingEdit?.status === 'pending' && Array.isArray(order.pendingEdit.products) && order.pendingEdit.products.length > 0
      ? order.pendingEdit.products
      : null;
  const products = fromEdit || order.products || [];
  if (!products.length) return '-';
  return products
    .map((p) => {
      const name = p.product_name || p.product || 'P';
      return p.quantity != null && p.quantity !== undefined ? `${name} - ${p.quantity}` : name;
    })
    .join(', ');
}

function townOf(order: DcOrder) {
  const loc = order.pendingEdit?.location || order.location || '';
  if (loc) return loc;
  const addr = order.pendingEdit?.address || order.address || '';
  return addr.split(',')[0]?.trim() || '-';
}

function executiveName(order: DcOrder) {
  if (typeof order.assigned_to === 'object' && order.assigned_to?.name) return order.assigned_to.name;
  const requested = order.pendingEdit?.requestedBy;
  if (typeof requested === 'object' && requested?.name) return requested.name;
  const poReq = order.poChangeRequest?.requestedBy;
  if (typeof poReq === 'object' && poReq?.name) return poReq.name;
  return '-';
}

function hasPendingEdit(order: DcOrder) {
  return order.pendingEdit?.status === 'pending';
}

function hasPendingPoChange(order: DcOrder) {
  return order.poChangeRequest?.status === 'PENDING_MANAGER_APPROVAL';
}

function isPendingRequest(order: DcOrder) {
  return hasPendingEdit(order) || hasPendingPoChange(order);
}

function getUploadsBaseUrl(): string {
  return getApiUrl().replace(/\/api\/?$/, '');
}

function buildPdfUrl(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  const base = getUploadsBaseUrl();
  let path: string;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const match = trimmed.match(/^https?:\/\/[^/]+(\/.*)?$/);
    path = match && match[1] ? match[1] : `/${trimmed.split('/').pop() || 'file'}`;
    if (!path.startsWith('/')) path = '/' + path;
  } else {
    path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
  return `${base}${path}`;
}

function belongsToAssigned(order: DcOrder, assignedIds: string[]) {
  if (!assignedIds.length) return true;
  const requestedById = idOf(order.pendingEdit?.requestedBy) || idOf(order.poChangeRequest?.requestedBy);
  const assignedToId = idOf(order.assigned_to);
  const employeeId = idOf(order.employeeId);
  return assignedIds.includes(requestedById) || assignedIds.includes(assignedToId) || assignedIds.includes(employeeId);
}

function ReadField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.readField}>
      <Text style={styles.readLabel}>{label}</Text>
      <View style={styles.readBox}>
        <Text style={styles.readValue}>{value === 0 ? '0' : value ? String(value) : '-'}</Text>
      </View>
    </View>
  );
}

function DateFilter({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value,
      onChange: (e: any) => onChange(e.target.value || ''),
      placeholder,
      style: {
        width: '100%',
        padding: 10,
        borderRadius: 8,
        border: '1px solid #E2E8F0',
        fontSize: 15,
        backgroundColor: '#fff',
        marginBottom: 12,
        color: '#1E293B',
      },
    });
  }
  return <WebInput value={value} onChangeText={onChange} placeholder={placeholder} />;
}

export default function ClientsClosedSalesScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<DcOrder[]>([]);
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [executives, setExecutives] = useState<{ label: string; value: string }[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [query, setQuery] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [successToast, setSuccessToast] = useState<{ title: string; body: string } | null>(null);

  const [actionOpen, setActionOpen] = useState(false);
  const [selected, setSelected] = useState<DcOrder | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadAssigned = useCallback(async () => {
    if (!user?._id) return;
    try {
      const empData = await apiService.get(`/executive-managers/${user._id}/employees`);
      const list = Array.isArray(empData) ? empData : [];
      setAssignedIds(list.map((emp: any) => String(emp._id)));
      setExecutives([
        { label: 'Select Executive', value: '' },
        ...list.map((emp: any) => ({ label: emp.name || 'Executive', value: String(emp._id) })),
      ]);
    } catch {
      setAssignedIds([]);
      setExecutives([{ label: 'Select Executive', value: '' }]);
    }
  }, [user?._id]);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const [ordersRes, poChangesRes] = await Promise.all([
        apiService.get('/dc-orders?limit=10000').catch(() => apiService.get('/dc-orders')),
        apiService.get('/executive-managers/po-change-requests').catch(() => []),
      ]);
      const allArray: DcOrder[] = Array.isArray(ordersRes) ? ordersRes : ordersRes?.data || [];
      const poChanges: DcOrder[] = Array.isArray(poChangesRes) ? poChangesRes : [];

      const byId = new Map<string, DcOrder>();
      for (const raw of allArray) {
        if (!isPendingRequest(raw)) continue;
        if (!belongsToAssigned(raw, assignedIds)) continue;
        byId.set(String(raw._id), raw);
      }
      for (const raw of poChanges) {
        if (!hasPendingPoChange(raw)) continue;
        const id = String(raw._id);
        const existing = byId.get(id);
        byId.set(id, existing ? { ...existing, ...raw, pendingEdit: existing.pendingEdit || raw.pendingEdit } : raw);
      }

      const merged = Array.from(byId.values()).sort((a, b) => {
        const dateA = new Date(
          a.pendingEdit?.requestedAt || a.poChangeRequest?.requestedAt || a.createdAt || a.created_at || 0
        ).getTime();
        const dateB = new Date(
          b.pendingEdit?.requestedAt || b.poChangeRequest?.requestedAt || b.createdAt || b.created_at || 0
        ).getTime();
        return dateB - dateA;
      });
      setItems(merged);
    } catch (e: any) {
      setItems([]);
      setBanner({ type: 'error', message: errMsg(e, 'Failed to load PO edit requests') });
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  }, [assignedIds]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 6000);
    return () => clearTimeout(timer);
  }, [successToast]);

  const filteredItems = useMemo(() => {
    const f = appliedFilters;
    return items.filter((item) => {
      const school = (item.pendingEdit?.school_name || item.school_name || item.schoolName || '').toLowerCase();
      const mobile = String(item.pendingEdit?.contact_mobile || item.contact_mobile || '');
      const zone = (item.pendingEdit?.zone || item.zone || '').toLowerCase();
      const town = townOf(item).toLowerCase();
      const execId = idOf(item.assigned_to) || idOf(item.pendingEdit?.requestedBy) || idOf(item.poChangeRequest?.requestedBy);
      const created = item.pendingEdit?.requestedAt || item.poChangeRequest?.requestedAt || item.createdAt || item.created_at || '';

      if (f.schoolName && !school.includes(f.schoolName.trim().toLowerCase())) return false;
      if (f.mobile && !mobile.includes(f.mobile.trim())) return false;
      if (f.zone && !zone.includes(f.zone.trim().toLowerCase())) return false;
      if (f.town && !town.includes(f.town.trim().toLowerCase())) return false;
      if (f.executive && execId !== f.executive) return false;
      if (f.fromDate) {
        const from = new Date(f.fromDate);
        from.setHours(0, 0, 0, 0);
        if (created && new Date(created) < from) return false;
      }
      if (f.toDate) {
        const to = new Date(f.toDate);
        to.setHours(23, 59, 59, 999);
        if (created && new Date(created) > to) return false;
      }
      const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (words.length) {
        const hay = [
          item.pendingEdit?.school_name, item.school_name, item.schoolName, item.school_code,
          item.pendingEdit?.contact_mobile, item.contact_mobile, item.pendingEdit?.contact_person,
          item.pendingEdit?.zone, item.zone, townOf(item), executiveName(item), productsDisplay(item),
          item.pendingEdit?.school_type, item.school_type,
        ]
          .map((v) => String(v ?? ''))
          .join(' ')
          .toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [items, appliedFilters, query]);

  const zoneOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const z = item.pendingEdit?.zone || item.zone;
      if (z) set.add(z);
    });
    return [{ label: 'Select Zone', value: '' }, ...Array.from(set).sort().map((z) => ({ label: z, value: z }))];
  }, [items]);

  const openPdf = (raw?: string) => {
    const url = buildPdfUrl(raw);
    if (!url) {
      setActionError('No PO document available');
      return;
    }
    Linking.openURL(url).catch(() => setActionError('Could not open the PO document'));
  };

  const openTakeAction = async (order: DcOrder) => {
    setActionError(null);
    setRejectionReason('');
    setActionOpen(true);
    setSelected(order);
    setLoadingDetail(true);
    try {
      const full = await apiService.get(`/dc-orders/${order._id}`);
      setSelected({ ...order, ...full, pendingEdit: full?.pendingEdit || order.pendingEdit, poChangeRequest: full?.poChangeRequest || order.poChangeRequest });
    } catch {
      setSelected(order);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeAction = () => {
    if (acting) return;
    setActionOpen(false);
    setSelected(null);
    setRejectionReason('');
    setActionError(null);
  };

  const handleApprove = async () => {
    if (!selected?._id) return;
    const needsPoRemarks = hasPendingPoChange(selected) && !hasPendingEdit(selected);
    if (needsPoRemarks && !rejectionReason.trim()) {
      setActionError('Remarks are required to approve a PO PDF change.');
      return;
    }
    setActing('approve');
    setActionError(null);
    try {
      if (!hasPendingEdit(selected) && !hasPendingPoChange(selected)) {
        setActionError('This request has already been processed.');
        return;
      }
      if (hasPendingEdit(selected)) {
        await apiService.put(`/dc-orders/${selected._id}/approve-edit`, { action: 'approve' });
      }
      if (hasPendingPoChange(selected)) {
        await apiService.put(`/dc-orders/${selected._id}/approve-po-change`, {
          approved: true,
          managerRemarks: rejectionReason.trim() || 'Approved with PO edit request',
        });
      }
      setActionOpen(false);
      setSelected(null);
      setRejectionReason('');
      setBanner(null);
      setSuccessToast({ title: APPROVE_SUCCESS_TITLE, body: APPROVE_SUCCESS_BODY });
      load();
    } catch (e: any) {
      setActionError(errMsg(e, 'Failed to approve edit request'));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    if (!selected?._id) return;
    if (!rejectionReason.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }
    setActing('reject');
    setActionError(null);
    try {
      if (hasPendingEdit(selected)) {
        await apiService.put(`/dc-orders/${selected._id}/approve-edit`, {
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
        });
      }
      if (hasPendingPoChange(selected)) {
        await apiService.put(`/dc-orders/${selected._id}/approve-po-change`, {
          approved: false,
          managerRemarks: rejectionReason.trim(),
        });
      }
      setActionOpen(false);
      setSelected(null);
      setRejectionReason('');
      setBanner({ type: 'success', message: 'Edit request rejected' });
      load();
    } catch (e: any) {
      setActionError(errMsg(e, 'Failed to reject edit request'));
    } finally {
      setActing(null);
    }
  };

  const pe = selected?.pendingEdit;
  const poReq = selected?.poChangeRequest;
  const currentPo = poReq?.oldPdfUrl || selected?.pod_proof_url;
  const editedPo = (hasPendingEdit(selected || ({} as DcOrder)) ? pe?.pod_proof_url : '') || poReq?.newPdfUrl;

  return (
    <ScreenShell
      title="PO Edit Request"
      subtitle="Review and approve/reject PO edit requests from Executives"
      noScroll
    >
      <View style={styles.pageRoot}>
      {successToast ? (
        <View style={styles.toastOverlay} pointerEvents="box-none">
          <View style={styles.toast}>
            <View style={styles.toastIconWrap}>
              <Text style={styles.toastIcon}>✓</Text>
            </View>
            <Text style={styles.toastText}>
              <Text style={styles.toastTitle}>{successToast.title}</Text>
              {' '}
              {successToast.body}
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={styles.pageScrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadAssigned().then(load);
          }} tintColor={colors.primary} />
        }
      >
      {banner ? (
        <MessageBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
      ) : null}

      <WebInput
        placeholder="Search school, code, mobile, zone, town, executive…"
        value={query}
        onChangeText={setQuery}
      />
      <TouchableOpacity onPress={() => setShowMoreFilters((v) => !v)} style={styles.moreToggle}>
        <Text style={styles.moreToggleText}>{showMoreFilters ? 'Hide filters ⌃' : 'More filters ⌄'}</Text>
      </TouchableOpacity>
      {showMoreFilters ? (
        <PageSection title="Filters">
          <WebLabel>From / To date</WebLabel>
          <DateFilter
            value={draftFilters.fromDate}
            onChange={(fromDate) => setDraftFilters((f) => ({ ...f, fromDate }))}
            placeholder="From date"
          />
          <DateFilter
            value={draftFilters.toDate}
            onChange={(toDate) => setDraftFilters((f) => ({ ...f, toDate }))}
            placeholder="To date"
          />
          <WebSelect
            label="Zone"
            value={draftFilters.zone}
            onValueChange={(zone) => setDraftFilters((f) => ({ ...f, zone }))}
            items={zoneOptions}
            placeholder="Select Zone"
          />
          <WebSelect
            label="Executive"
            value={draftFilters.executive}
            onValueChange={(executive) => setDraftFilters((f) => ({ ...f, executive }))}
            items={executives}
            placeholder="Select Executive"
          />
          <WebButton title="Apply filters" onPress={() => setAppliedFilters(draftFilters)} />
        </PageSection>
      ) : null}

      {listLoading ? (
        <View style={styles.modalLoading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.emptyHint}>Loading...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="📝"
          title="No pending PO edit requests found."
          message="Field changes and edited PO PDFs from executives appear here."
        />
      ) : (
        filteredItems.map((item, index) => (
          <Card key={item._id}>
            <CardTitle
              title={item.pendingEdit?.school_name || item.school_name || item.schoolName || '-'}
              subtitle={`S.No ${index + 1}${item.school_code ? ` · ${item.school_code}` : ''}`}
              badge="Edit Pending"
              tone="warning"
            />
            <InfoRow label="Created On" value={formatDate(item.created_at || item.createdAt)} />
            <InfoRow label="School Type" value={item.pendingEdit?.school_type || item.school_type} />
            <InfoRow label="Zone" value={item.pendingEdit?.zone || item.zone} />
            <InfoRow label="Town" value={townOf(item)} />
            <InfoRow label="Executive" value={executiveName(item)} />
            <InfoRow label="Mobile" value={item.pendingEdit?.contact_mobile || item.contact_mobile} phone />
            <InfoRow label="Products" value={productsDisplay(item)} />
            {hasPendingPoChange(item) || item.pendingEdit?.pod_proof_url ? (
              <InfoRow label="Edited PO" value="PDF attached" />
            ) : null}
            <ActionRow>
              <TouchableOpacity style={styles.takeAction} onPress={() => openTakeAction(item)} activeOpacity={0.85}>
                <Text style={styles.takeActionText}>Take Action</Text>
              </TouchableOpacity>
            </ActionRow>
          </Card>
        ))
      )}
      </ScrollView>

      <Modal visible={actionOpen} animationType="slide" transparent onRequestClose={closeAction}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>PO Edit Request - {selected?.pendingEdit?.school_name || selected?.school_name || 'Client'}</Text>
                <Text style={styles.modalSubtitle}>
                  Review the edited PO from the executive dashboard. Approve or reject the request.
                </Text>
              </View>
              <TouchableOpacity onPress={closeAction} hitSlop={12} disabled={!!acting}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.emptyHint}>Loading request…</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                {actionError ? (
                  <MessageBanner type="error" message={actionError} onDismiss={() => setActionError(null)} />
                ) : null}

                <View style={styles.poBox}>
                  <Text style={styles.poBoxTitle}>Edited PO from Executive</Text>
                  <Text style={styles.poBoxHint}>Current document vs the PO the executive submitted for approval.</Text>
                  <View style={styles.poActions}>
                    <TouchableOpacity
                      style={[styles.pdfBtn, !currentPo && styles.pdfBtnDisabled]}
                      onPress={() => openPdf(currentPo)}
                      disabled={!currentPo}
                    >
                      <Text style={styles.pdfBtnText}>{currentPo ? 'View current PO' : 'No current PO'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pdfBtn, styles.pdfBtnEdited, !editedPo && styles.pdfBtnDisabled]}
                      onPress={() => openPdf(editedPo)}
                      disabled={!editedPo}
                    >
                      <Text style={[styles.pdfBtnText, styles.pdfBtnEditedText]}>
                        {editedPo ? 'View edited PO' : 'No edited PO uploaded'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {poReq?.remarks ? <Text style={styles.poReason}>Reason: {poReq.remarks}</Text> : null}
                </View>

                {pe && hasPendingEdit(selected || ({} as DcOrder)) ? (
                  <>
                    <Text style={styles.sectionTitle}>Requested changes</Text>
                    <ReadField label="School Name" value={pe.school_name} />
                    <ReadField label="Contact Person" value={pe.contact_person} />
                    <ReadField label="Contact Mobile" value={pe.contact_mobile} />
                    <ReadField label="Contact Person 2" value={pe.contact_person2} />
                    <ReadField label="Contact Mobile 2" value={pe.contact_mobile2} />
                    <ReadField label="Email" value={pe.email} />
                    <ReadField label="Zone" value={pe.zone} />
                    <ReadField label="Location" value={pe.location} />
                    <ReadField label="Address" value={pe.address} />
                    <ReadField label="Total Amount" value={pe.total_amount} />
                    <ReadField label="Remarks" value={pe.remarks} />

                    <Text style={styles.sectionTitle}>Delivery and Address</Text>
                    <Text style={styles.savedHint}>Already saved — does not require approval.</Text>
                    <ReadField label="Property Number" value={selected?.property_number} />
                    <ReadField label="Floor" value={selected?.floor} />
                    <ReadField label="Tower/Block" value={selected?.tower_block} />
                    <ReadField label="Nearby Landmark" value={selected?.nearby_landmark} />
                    <ReadField label="Area" value={selected?.area} />
                    <ReadField label="City" value={selected?.city} />
                    <ReadField label="Pincode" value={selected?.pincode} />

                    <Text style={styles.sectionTitle}>Products</Text>
                    {pe.products && pe.products.length > 0 ? (
                      pe.products.map((p, idx) => (
                        <View key={`${p.product_name || 'p'}-${idx}`} style={styles.productCard}>
                          <Text style={styles.productLine}>Product: {p.product_name || p.product || '-'}</Text>
                          <Text style={styles.productLine}>Quantity: {p.quantity ?? '-'}</Text>
                          {p.unit_price != null ? <Text style={styles.productLine}>Unit Price: {p.unit_price}</Text> : null}
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyHint}>No products</Text>
                    )}

                    <Text style={styles.metaLine}>
                      Requested by: {typeof pe.requestedBy === 'object' ? pe.requestedBy?.name || 'Unknown' : 'Unknown'}
                    </Text>
                    <Text style={styles.metaLine}>Requested at: {formatDate(pe.requestedAt)}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.metaLine}>
                      Requested by:{' '}
                      {typeof poReq?.requestedBy === 'object' ? poReq?.requestedBy?.name || 'Unknown' : 'Unknown'}
                    </Text>
                    <Text style={styles.metaLine}>Requested at: {formatDate(poReq?.requestedAt)}</Text>
                  </>
                )}

                <WebLabel>Rejection Reason (if rejecting)</WebLabel>
                <WebInput
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder={
                    hasPendingPoChange(selected || ({} as DcOrder)) && !hasPendingEdit(selected || ({} as DcOrder))
                      ? 'Remarks are required to approve or reject the PO PDF'
                      : 'Enter reason for rejection...'
                  }
                  multiline
                  numberOfLines={3}
                  style={styles.reasonInput}
                />
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <WebButton title="Cancel" variant="outline" onPress={closeAction} disabled={!!acting} />
              <WebButton
                title={acting === 'reject' ? 'Rejecting...' : 'Reject'}
                variant="destructive"
                onPress={handleReject}
                disabled={!!acting || loadingDetail}
                loading={acting === 'reject'}
              />
              <WebButton
                title={acting === 'approve' ? 'Approving...' : 'Approve'}
                onPress={handleApprove}
                disabled={!!acting || loadingDetail}
                loading={acting === 'approve'}
              />
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  pageRoot: { flex: 1, position: 'relative' },
  pageScroll: { flex: 1 },
  pageScrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  toastOverlay: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 50,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  toastIcon: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  toastText: { flex: 1, fontSize: 14, color: '#166534', lineHeight: 20 },
  toastTitle: { fontWeight: '700', color: '#14532D' },
  empty: { fontSize: 15, color: colors.textSecondary },
  emptyHint: { fontSize: 13, color: colors.textMuted, marginTop: 8, lineHeight: 18 },
  card: {
    backgroundColor: '#FFF7ED',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
    padding: spacing.md,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  titleWrap: { flex: 1, minWidth: 0 },
  serial: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  schoolName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, lineHeight: 22 },
  statusBadge: { backgroundColor: '#FFEDD5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusBadgeText: { fontSize: 12, fontWeight: '700', color: '#C2410C' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  infoLabel: { width: 110, fontSize: 13, color: colors.textSecondary, paddingTop: 1 },
  infoValue: { flex: 1, fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  takeAction: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  takeActionText: { fontSize: 14, fontWeight: '700', color: colors.primaryForeground },
  moreToggle: { alignSelf: 'flex-end', paddingVertical: 4, marginTop: -6, marginBottom: 8 },
  moreToggleText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    minHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  modalClose: { fontSize: 20, color: colors.textMuted, paddingHorizontal: 4 },
  modalLoading: { padding: 32, alignItems: 'center' },
  modalScroll: { flex: 1 },
  modalScrollContent: { padding: spacing.md, paddingBottom: 24 },
  poBox: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  poBoxTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  poBoxHint: { fontSize: 12, color: colors.textSecondary, marginTop: 4, marginBottom: 12 },
  poActions: { gap: 8 },
  pdfBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pdfBtnEdited: { borderColor: colors.primaryDark, backgroundColor: colors.accent },
  pdfBtnDisabled: { opacity: 0.55 },
  pdfBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  pdfBtnEditedText: { color: colors.primaryDark },
  poReason: { marginTop: 10, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 8, marginBottom: 10 },
  savedHint: { fontSize: 12, color: colors.success, marginBottom: 8 },
  readField: { marginBottom: 10 },
  readLabel: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 6 },
  readBox: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  readValue: { fontSize: 15, color: colors.textPrimary },
  productCard: {
    backgroundColor: colors.backgroundMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
  },
  productLine: { fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
  metaLine: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
  modalFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
