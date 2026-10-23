import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import MessageBanner from '../../components/MessageBanner';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect } from '../../ui/WebPrimitives';
import { navigateRoot } from '../../navigation/navigationRef';
import {
  DROPPED_LINE_STATUSES,
  PRICED_LINE_STATUSES,
  isFollowUpProductLineComplete,
  leadProductsToInterestedRows,
  lineDetailLabel,
  normalizeLeadProductLineStatus,
  type LeadProductInterestedRow,
} from '../../lib/crm/leadProductsInterested';

const DEAL_PRODUCT_STATUS_ORDER = ['Hot', 'Warm', 'Visit Again', 'Yet to Visit', 'Not Interested'] as const;
const SCHOOL_LEAD_STATUSES = new Set(['Hot', 'Warm', 'Cold']);
const ALL_FOLLOWUP_STATUSES = ['Hot', 'Warm', 'Visit Again', 'Yet to Visit', 'Not Interested'] as const;
/** Last year's product on a renewal: renewed, not renewed, or still being discussed. */
const RENEWAL_LINE_STATUSES = ['Renewed', 'Not Renewed', 'Hot', 'Warm', 'Visit Again'] as const;

type ProductInterested = LeadProductInterestedRow & {
  /** Status already saved on the lead. Follow-up choices are based on this, not the value being edited. */
  savedStatus: string;
};

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Align product-line enums across Lead/DcOrder schemas (same as web follow-up page). */
function normalizeProductLineStatus(status?: string): string {
  const s = (status || '').trim();
  if (s === 'Management Not Met' || s === 'Not Met Management') return 'Yet to Visit';
  // For deal priority a renewed product counts as Hot, a not-renewed one as Not Interested.
  if (s === 'Renewed') return 'Hot';
  if (s === 'Not Renewed') return 'Not Interested';
  return s;
}

function followUpStatusOptions(savedStatus?: string, saleType?: string): string[] {
  if (saleType === 'renewal') return [...RENEWAL_LINE_STATUSES];
  const status = normalizeProductLineStatus(savedStatus);
  if (status === 'Hot') return ['Hot', 'Not Interested'];
  if (status === 'Warm') return ['Warm', 'Hot', 'Not Interested'];
  return [...ALL_FOLLOWUP_STATUSES];
}

function deriveLeadPriorityFromDealProducts(products: { status?: string }[]): string | null {
  let best = '';
  let bestIdx: number = DEAL_PRODUCT_STATUS_ORDER.length;
  for (const p of products) {
    const st = normalizeProductLineStatus(p.status);
    const i = (DEAL_PRODUCT_STATUS_ORDER as readonly string[]).indexOf(st);
    if (i !== -1 && i < bestIdx) {
      bestIdx = i;
      best = st;
    }
  }
  return best || null;
}

function displayLeadDealPriority(lead: {
  priority?: string;
  lead_status?: string;
  products?: { status?: string }[];
}): string {
  const schoolLeadStatus = (lead.lead_status || '').trim();
  if (schoolLeadStatus) return schoolLeadStatus;
  const schoolPriority = (lead.priority || '').trim();
  if (schoolPriority) return schoolPriority;
  if (Array.isArray(lead.products) && lead.products.length > 0) {
    const derived = deriveLeadPriorityFromDealProducts(lead.products);
    if (derived) return derived;
  }
  return 'Warm';
}

function assigneeFromRecord(record: any): { id: string; name: string } {
  const candidates = [record?.assigned_to, record?.managed_by, record?.createdBy];
  for (const value of candidates) {
    if (!value) continue;
    if (typeof value === 'string' && value.trim()) return { id: value.trim(), name: '' };
    if (typeof value === 'object' && value._id) {
      return { id: String(value._id), name: String(value.name || '').trim() };
    }
  }
  return { id: '', name: '' };
}

/** Statuses that mean the school is already a client / in DC flow — not open follow-up leads (web list). */
const CONVERTED_OR_CLOSED_STATUSES = new Set([
  'saved', 'completed', 'closed', 'converted', 'client',
  'in_transit', 'dc_requested', 'dc_accepted', 'dc_approved', 'dc_sent_to_senior',
]);

function isOpenFollowUpLead(lead: any): boolean {
  const status = String(lead?.status || '').trim().toLowerCase();
  if (!status) return true;
  if (CONVERTED_OR_CLOSED_STATUSES.has(status)) return false;
  return status === 'pending' || status === 'processing';
}

function formatDateOnly(dateString?: string) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function followUpDateToIso(dateStr: string): string {
  // Noon local avoids UTC midnight showing as 5:30 AM IST
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toISOString();
}

function isFollowUpDateOverdue(dateString?: string): boolean {
  if (!dateString) return false;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dayOnly.getTime() < todayOnly.getTime();
  } catch {
    return false;
  }
}

export default function LeadFollowupScreen({ navigation }: any) {
  const { user } = useAuth();
  const seesAllFollowups =
    user?.role === 'Super Admin' || Boolean((user as any)?.isSuperAdmin);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [schoolCodeFilter, setSchoolCodeFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [bdeOptions, setBdeOptions] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [historyLead, setHistoryLead] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [updateForm, setUpdateForm] = useState({
    follow_up_date: '',
    remarks: '',
    productsInterested: [] as ProductInterested[],
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
    loadProductCatalog();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allLeads, zoneFilter, schoolFilter, schoolCodeFilter, mobileFilter, employeeFilter]);

  useEffect(() => {
    if (!seesAllFollowups) return;
    const roles = ['Executive', 'Sales BDE', 'Employee', 'BDE'];
    Promise.all(
      roles.map((role) =>
        apiService.get(`/employees?isActive=true&role=${encodeURIComponent(role)}`).catch(() => []),
      ),
    ).then((batches) => {
      const seen = new Set<string>();
      const list: { _id: string; name: string }[] = [];
      for (const batch of batches) {
        const rows = Array.isArray(batch) ? batch : batch?.data || [];
        for (const u of Array.isArray(rows) ? rows : []) {
          const id = String(u?._id || u?.id || '');
          const name = String(u?.name || '').trim();
          if (!id || !name || seen.has(id)) continue;
          seen.add(id);
          list.push({ _id: id, name });
        }
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setBdeOptions(list);
    });
  }, [seesAllFollowups]);

  const loadProductCatalog = async () => {
    try {
      const data = await apiService.get('/products/active');
      const list = Array.isArray(data) ? data : data?.data || [];
      const names: string[] = list
        .map((p: any) => (typeof p === 'string' ? p : p.productName || ''))
        .map((n: string) => String(n).trim())
        .filter(Boolean);
      setProductNames([...new Set(names)]);
    } catch {
      setProductNames([]);
    }
  };

  const loadLeads = async () => {
    try {
      setLoading(true);
      if (!user?._id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      const leadsQuery = seesAllFollowups
        ? '/leads?pipeline=followup&limit=500'
        : `/leads?employee=${user._id}&pipeline=followup&limit=500`;
      const ordersQuery = seesAllFollowups
        ? '/dc-orders?pipeline=followup&limit=500'
        : `/dc-orders?assigned_to=${user._id}&pipeline=followup&limit=500`;
      const [leadsResponse, dcOrdersResponse] = await Promise.all([
        apiService.get(leadsQuery).catch(() => []),
        apiService.get(ordersQuery).catch(() => []),
      ]);

      const allData = Array.isArray(leadsResponse) ? leadsResponse : leadsResponse?.data || [];
      const dcOrders: any[] = Array.isArray(dcOrdersResponse)
        ? dcOrdersResponse
        : dcOrdersResponse?.data || [];

      const activeLeads = (Array.isArray(allData) ? allData : [])
        .filter((lead: any) => isOpenFollowUpLead(lead))
        .map((lead: any) => {
          // School code from the lead, else from the matching DcOrder (same school + mobile).
          let schoolCode = lead.school_code || lead.schoolCode;
          if (!schoolCode && dcOrders.length > 0) {
            const match = dcOrders.find((order: any) => {
              const schoolMatch =
                (order.school_name || '').toLowerCase().trim() ===
                (lead.school_name || '').toLowerCase().trim();
              const mobileMatch =
                (order.contact_mobile || '').trim() === (lead.contact_mobile || '').trim();
              return schoolMatch && mobileMatch && (order.school_code || order.dc_code);
            });
            if (match) schoolCode = match.school_code || match.dc_code;
          }
          const assignee = assigneeFromRecord(lead);
          return {
            ...lead,
            school_code: schoolCode,
            assignedToId: assignee.id,
            assignedToName: assignee.name,
          };
        });

      const leadsFromOrders: any[] = dcOrders
        .filter((order: any) => isOpenFollowUpLead(order))
        .map((order: any) => {
          const assignee = assigneeFromRecord(order);
          return {
            _id: order._id,
            school_name: order.school_name,
            school_code: order.school_code,
            contact_person: order.contact_person,
            contact_mobile: order.contact_mobile,
            zone: order.zone,
            status: order.status,
            follow_up_date: order.follow_up_date || order.estimated_delivery_date,
            location: order.location,
            city: order.city,
            area: order.area,
            strength: order.strength,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            remarks: order.remarks,
            school_type: order.school_type,
            products: Array.isArray(order.products) ? order.products : undefined,
            lead_status: order.lead_status,
            priority: order.priority,
            isChain: order.isChain === true,
            assignedToId: assignee.id,
            assignedToName: assignee.name,
            sourceType: 'dc-order',
          };
        });

      const combinedLeads = [...activeLeads, ...leadsFromOrders];
      const followUpLeads = combinedLeads.filter((lead: any) => isOpenFollowUpLead(lead));

      const uniqueLeads = followUpLeads.filter(
        (lead, index, self) => index === self.findIndex((l) => l._id === lead._id)
      );

      setAllLeads(uniqueLeads);
      const uniqueZones = Array.from(
        new Set(uniqueLeads.map((l) => l.zone).filter(Boolean))
      ) as string[];
      setZones(uniqueZones.sort());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load follow-up leads');
      setAllLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allLeads];
    if (zoneFilter && zoneFilter !== 'all') {
      filtered = filtered.filter((l) =>
        l.zone?.toLowerCase().includes(zoneFilter.toLowerCase())
      );
    }
    if (mobileFilter) {
      filtered = filtered.filter((l) => l.contact_mobile?.includes(mobileFilter));
    }
    if (schoolFilter) {
      filtered = filtered.filter((l) =>
        l.school_name?.toLowerCase().includes(schoolFilter.toLowerCase())
      );
    }
    if (schoolCodeFilter.trim()) {
      const code = schoolCodeFilter.trim().toLowerCase();
      filtered = filtered.filter((l) => String(l.school_code || '').toLowerCase().includes(code));
    }
    if (employeeFilter) {
      filtered = filtered.filter((l) => l.assignedToId === employeeFilter);
    }
    filtered.sort((a, b) => {
      // Newest leads first everywhere
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    setLeads(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  const openUpdateModal = (lead: any) => {
    setSelectedLead(lead);
    setModalError(null);
    setUpdateForm({
      follow_up_date: '',
      remarks: '',
      productsInterested: leadProductsToInterestedRows(lead).map((row) => {
        const savedStatus =
          row.sale_type === 'renewal'
            ? row.status || 'Warm'
            : normalizeProductLineStatus(row.status) || row.status || 'Warm';
        return { ...row, status: savedStatus, savedStatus };
      }),
    });
    setShowUpdateModal(true);
  };

  const closeUpdateModal = () => {
    setShowUpdateModal(false);
    setSelectedLead(null);
    setModalError(null);
    setUpdateForm({
      follow_up_date: '',
      remarks: '',
      productsInterested: [],
    });
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  /** Renewal schools: add a product the school did not buy last year (Cross-Sale). */
  const addCrossSaleProduct = () => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: [
        ...prev.productsInterested,
        {
          product_name: '',
          term: 'Term 1',
          status: 'Warm',
          savedStatus: '',
          strength: '',
          unit_price: '',
          chance: '',
          not_interested_reason: '',
          sale_type: 'cross_sale',
        },
      ],
    }));
  };

  const updateInterestedProduct = (
    index: number,
    field: keyof ProductInterested,
    value: string | number | boolean
  ) => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: prev.productsInterested.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  /** Status change clears fields that do not apply (same rules as the web follow-up). */
  const changeInterestedStatus = (index: number, v: string) => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: prev.productsInterested.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, status: v };
        if (!PRICED_LINE_STATUSES.has(v)) {
          next.strength = '';
          next.unit_price = '';
          next.chance = DROPPED_LINE_STATUSES.has(v) ? '0' : '';
        } else if (v === 'Renewed') {
          next.chance = '100';
        } else if (next.chance === '0') {
          next.chance = '';
        }
        if (!DROPPED_LINE_STATUSES.has(v)) next.not_interested_reason = '';
        return next;
      }),
    }));
  };

  const handleUpdateFollowup = async () => {
    if (!selectedLead) return;
    setModalError(null);

    if (!updateForm.follow_up_date?.trim()) {
      setModalError('Next Follow-up Date is required');
      return;
    }
    if (updateForm.follow_up_date < todayDateString()) {
      setModalError('Follow-up date cannot be in the past');
      return;
    }
    if (!updateForm.remarks?.trim()) {
      setModalError('Remarks is required');
      return;
    }

    const selectedProducts = updateForm.productsInterested.filter(
      (p) => p.product_name && p.product_name.trim()
    );
    if (selectedProducts.length === 0) {
      setModalError('Add at least one product in Products Interested');
      return;
    }
    const illegalMove = selectedProducts.find((p) => {
      const next = normalizeProductLineStatus(p.status) || p.status;
      if (p.sale_type === 'renewal' || (p.sale_type === 'cross_sale' && !p.savedStatus)) return false;
      return !followUpStatusOptions(p.savedStatus).includes(next);
    });
    if (illegalMove) {
      const from = normalizeProductLineStatus(illegalMove.savedStatus) || illegalMove.savedStatus;
      setModalError(
        from === 'Hot'
          ? `"${illegalMove.product_name}" is Hot. It can only stay Hot or become Not Interested.`
          : `"${illegalMove.product_name}" is Warm. It can stay Warm, become Hot, or become Not Interested.`
      );
      return;
    }
    const incomplete = selectedProducts.find((p) => !isFollowUpProductLineComplete(p));
    if (incomplete) {
      if (incomplete.status === 'Not Interested') {
        setModalError(`Enter a reason why the school is not interested in "${incomplete.product_name}"`);
      } else if (incomplete.status === 'Not Renewed') {
        setModalError(`Enter a reason why "${incomplete.product_name}" was not renewed`);
      } else if ((Number(incomplete.unit_price) || 0) <= 0) {
        setModalError(`Enter Unit Price for "${incomplete.product_name}"`);
      } else if (
        (incomplete.status === 'Hot' || incomplete.status === 'Warm') &&
        ((Number(incomplete.strength) || 0) <= 0 || (Number(incomplete.chance) || 0) <= 0)
      ) {
        setModalError(
          `Enter Strength and Chance % for "${incomplete.product_name}" (required for Hot/Warm)`
        );
      } else if (incomplete.status === 'Hot' && Number(incomplete.chance) < 80) {
        setModalError(`Chance % for "${incomplete.product_name}" must be at least 80 when status is Hot`);
      } else if (incomplete.status === 'Warm' && Number(incomplete.chance) < 20) {
        setModalError(`Chance % for "${incomplete.product_name}" must be at least 20 when status is Warm`);
      } else {
        setModalError('Complete product details for each row');
      }
      return;
    }

    setUpdating(true);
    try {
      const validProducts = selectedProducts.map((p) => {
        const priced = PRICED_LINE_STATUSES.has(p.status);
        return {
          product_name: p.product_name.trim(),
          term: p.term || 'Term 1',
          status: normalizeLeadProductLineStatus(p.status) || p.status || 'Warm',
          strength: priced ? Number(p.strength) || 0 : 0,
          chance: p.status === 'Renewed' ? 100 : priced ? Number(p.chance) || 0 : 0,
          important: false,
          quantity: priced ? Number(p.strength) || 1 : 1,
          unit_price: priced ? Number(p.unit_price) || 0 : 0,
          not_interested_reason: DROPPED_LINE_STATUSES.has(p.status)
            ? String(p.not_interested_reason || '').trim()
            : '',
          // Keep class / series / level and Renewal vs Cross-Sale on the line.
          class: p.class,
          productCategory: p.productCategory,
          specs: p.specs,
          level: p.level,
          subject: p.subject,
          section: p.section,
          program: p.program,
          stream: p.stream,
          sale_type: p.sale_type,
        };
      });

      const derivedPriority = deriveLeadPriorityFromDealProducts(validProducts);
      const schoolLeadStatus = (selectedLead.lead_status || '').trim();
      const payload: any = {
        follow_up_date: followUpDateToIso(updateForm.follow_up_date),
        remarks: updateForm.remarks,
      };
      if (SCHOOL_LEAD_STATUSES.has(schoolLeadStatus)) {
        payload.lead_status = schoolLeadStatus;
        payload.priority = schoolLeadStatus;
      } else {
        payload.priority = derivedPriority || selectedLead.priority || displayLeadDealPriority(selectedLead) || 'Warm';
      }
      payload.productsInterested = validProducts;

      // Use the endpoint that owns the record; a lead id falls back to dc-orders (legacy records).
      const updateDcOrder = selectedLead.sourceType === 'dc-order';
      try {
        await apiService.put(
          updateDcOrder ? `/dc-orders/${selectedLead._id}` : `/leads/${selectedLead._id}`,
          payload,
        );
      } catch (err) {
        if (updateDcOrder) throw err;
        await apiService.put(`/dc-orders/${selectedLead._id}`, payload);
      }

      setSuccessMessage('Follow-up created successfully!');
      closeUpdateModal();
      loadLeads();
    } catch (error: any) {
      setModalError(error.message || 'Failed to update lead');
    } finally {
      setUpdating(false);
    }
  };

  const openHistoryModal = async (lead: any) => {
    setHistoryLead(lead);
    setShowHistoryModal(true);
    setHistory([]);
    setHistoryLoading(true);
    try {
      let historyData: any[] = [];
      try {
        const apiHistory = await apiService.get(`/dc-orders/${lead._id}/history`);
        if (Array.isArray(apiHistory)) historyData = apiHistory;
      } catch {
        /* leads API has no history */
      }
      try {
        const full = await apiService.get(`/dc-orders/${lead._id}`);
        if (full?.updateHistory && Array.isArray(full.updateHistory)) {
          const existing = new Set(historyData.map((h) => new Date(h.updatedAt).getTime()));
          full.updateHistory.forEach((entry: any) => {
            const t = new Date(entry.updatedAt).getTime();
            if (!existing.has(t)) {
              historyData.push(entry);
              existing.add(t);
            }
          });
        }
        if (full) setHistoryLead({ ...lead, ...full });
      } catch {
        /* ignore */
      }
      if (historyData.length === 0 && lead.createdAt) {
        historyData.push({
          follow_up_date: lead.follow_up_date || null,
          remarks: lead.remarks || 'Lead created',
          priority: lead.lead_status || displayLeadDealPriority(lead),
          productsInterested: leadProductsToInterestedRows(lead),
          updatedAt: lead.createdAt,
          updatedBy: { name: 'System' },
        });
      }
      historyData.sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
      setHistory(historyData);
    } catch {
      if (lead.createdAt) {
        setHistory([
          {
            follow_up_date: lead.follow_up_date || null,
            remarks: lead.remarks || 'Lead created',
            priority: displayLeadDealPriority(lead),
            updatedAt: lead.createdAt,
          },
        ]);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  const zoneItems = [
    { label: 'All Zones', value: 'all' },
    ...zones.map((z) => ({ label: z, value: z })),
  ];

  const productSelectItems = productNames.map((n) => ({ label: n, value: n }));

  return (
    <ScreenShell
      title="Follow-up Leads"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {successMessage && (
          <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}

        <View style={styles.filtersCard}>
          {seesAllFollowups && (
            <WebSelect
              label="BDE"
              value={employeeFilter || 'all'}
              onValueChange={(v) => setEmployeeFilter(v === 'all' ? '' : v)}
              items={[
                { label: 'All BDEs', value: 'all' },
                ...bdeOptions.map((e) => ({ label: e.name, value: e._id })),
              ]}
              placeholder="All BDEs"
            />
          )}
          {zones.length > 0 && (
            <WebSelect
              label="Zone"
              value={zoneFilter || 'all'}
              onValueChange={(v) => setZoneFilter(v === 'all' ? '' : v)}
              items={zoneItems}
              placeholder="All Zones"
            />
          )}
          <Text style={styles.filterLabel}>School Name</Text>
          <WebInput
            style={styles.filterInput}
            placeholder="Search school..."
            value={schoolFilter}
            onChangeText={setSchoolFilter}
          />
          <Text style={styles.filterLabel}>School Code</Text>
          <WebInput
            style={styles.filterInput}
            placeholder="Search code..."
            value={schoolCodeFilter}
            onChangeText={setSchoolCodeFilter}
            autoCapitalize="characters"
          />
          <Text style={styles.filterLabel}>Contact Mobile</Text>
          <WebInput
            style={styles.filterInput}
            placeholder="Search mobile..."
            value={mobileFilter}
            onChangeText={setMobileFilter}
            keyboardType="phone-pad"
          />
          <WebButton title="Refresh" onPress={loadLeads} variant="outline" />
        </View>

        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📞</Text>
            <Text style={styles.emptyTitle}>No Follow-up Leads</Text>
            <Text style={styles.emptySubtitle}>
              {allLeads.length === 0
                ? 'Only open leads (not yet converted to clients) appear here.'
                : 'No leads match the current filters.'}
            </Text>
          </View>
        ) : (
          leads.map((lead) => {
            const isOverdue = isFollowUpDateOverdue(lead.follow_up_date);
            const productRows = leadProductsToInterestedRows(lead);

            return (
              <View key={lead._id} style={[styles.card, lead.isChain && styles.cardChain]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardHeader}>
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName} numberOfLines={2}>
                        {lead.school_name || 'Unnamed School'}
                      </Text>
                      {lead.school_code || lead.location || lead.city || lead.area ? (
                        <View style={styles.schoolTagRow}>
                          {lead.school_code ? (
                            <Text style={styles.schoolCodeBadge}>{lead.school_code}</Text>
                          ) : null}
                          {/* Town / area next to the code, so schools with similar names are easy to tell apart. */}
                          {lead.location || lead.city || lead.area ? (
                            <Text style={styles.schoolTownBadge}>{lead.location || lead.city || lead.area}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      {seesAllFollowups && (lead.assignedToName || lead.assignedToId) ? (
                        <Text style={styles.locationText}>
                          BDE:{' '}
                          {lead.assignedToName ||
                            bdeOptions.find((e) => e._id === lead.assignedToId)?.name ||
                            'Assigned'}
                        </Text>
                      ) : null}
                      {lead.location ? (
                        <View style={styles.locationRow}>
                          <Text style={styles.locationIcon}>📍</Text>
                          <Text style={styles.locationText}>{lead.location}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.cardBody}>
                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Contact</Text>
                      <Text style={styles.infoValue}>{lead.contact_person || '—'}</Text>
                    </View>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Mobile</Text>
                      <Text style={styles.infoValue}>{lead.contact_mobile || '—'}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.dateContainer,
                      isOverdue && styles.dateContainerOverdue,
                    ]}
                  >
                    <Text style={styles.dateLabel}>Follow-up date: </Text>
                    <Text style={[styles.dateValue, isOverdue && styles.dateValueOverdue]}>
                      {formatDateOnly(lead.follow_up_date)}
                    </Text>
                  </View>

                  <View style={styles.productsBlock}>
                    <Text style={styles.productsLabel}>Products interested</Text>
                    {productRows.length === 0 ? (
                      <Text style={styles.productsEmpty}>—</Text>
                    ) : (
                      productRows.map((p, pi) => (
                        <View key={`${p.product_name}-${pi}`} style={styles.productLine}>
                          <Text style={styles.productLineName}>{p.product_name}</Text>
                          <Text style={styles.productLineMeta}>
                            {[
                              p.status,
                              Number(p.strength) > 0 ? `Str ${p.strength}` : null,
                              Number(p.chance) > 0 ? `${p.chance}%` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>

                  {lead.remarks ? (
                    <View style={styles.remarksContainer}>
                      <Text style={styles.remarksLabel}>Remarks:</Text>
                      <Text style={styles.remarksText} numberOfLines={3}>
                        {lead.remarks}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => navigation.navigate('LeadEdit', { id: lead._id })}
                  >
                    <Text style={styles.actionButtonText}>Edit Lead</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.updateButton]}
                    onPress={() => openUpdateModal(lead)}
                  >
                    <Text style={styles.actionButtonText}>Create Follow-up</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.historyButton]}
                    onPress={() => openHistoryModal(lead)}
                  >
                    <Text style={styles.actionButtonText}>View History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.closeButton]}
                    onPress={() => {
                      const id = lead?._id ? String(lead._id) : '';
                      if (!id) {
                        setErrorMessage('This lead has no id, so it cannot be closed.');
                        return;
                      }
                      if (!navigateRoot('LeadClose', { id })) {
                        navigation.navigate('LeadClose', { id });
                      }
                    }}
                  >
                    <Text style={styles.actionButtonText}>Close Lead</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create Follow-up Modal */}
      <Modal visible={showUpdateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Follow-up</Text>
              <TouchableOpacity onPress={closeUpdateModal}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {modalError && (
                <MessageBanner type="error" message={modalError} onDismiss={() => setModalError(null)} />
              )}
              {selectedLead && (
                <>
                  <Text style={styles.modalSchool}>{selectedLead.school_name || 'Unknown'}</Text>

                  <Text style={styles.modalLabel}>Next Follow-up Date *</Text>
                  {Platform.OS === 'web' ? (
                    React.createElement('input', {
                      type: 'date',
                      value: updateForm.follow_up_date || '',
                      min: todayDateString(),
                      onChange: (e: any) =>
                        setUpdateForm((f) => ({
                          ...f,
                          follow_up_date: e.target.value || '',
                        })),
                      style: {
                        width: '100%',
                        padding: 14,
                        borderRadius: 12,
                        border: '1px solid #E2E8F0',
                        fontSize: 16,
                        backgroundColor: '#fff',
                        color: '#1E293B',
                        boxSizing: 'border-box',
                        marginBottom: 12,
                      },
                    })
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.dateTouchable}
                        onPress={() => setShowFollowUpDatePicker(true)}
                      >
                        <Text
                          style={[
                            styles.dateText,
                            !updateForm.follow_up_date && styles.datePlaceholder,
                          ]}
                        >
                          {updateForm.follow_up_date || 'Tap to pick date'}
                        </Text>
                        <Text>📅</Text>
                      </TouchableOpacity>

                      {showFollowUpDatePicker && Platform.OS === 'android' ? (
                        <DateTimePicker
                          value={
                            updateForm.follow_up_date
                              ? new Date(updateForm.follow_up_date + 'T12:00:00')
                              : new Date()
                          }
                          mode="date"
                          minimumDate={new Date()}
                          display="default"
                          onChange={(event, d) => {
                            setShowFollowUpDatePicker(false);
                            if (event.type === 'set' && d) {
                              const y = d.getFullYear();
                              const m = String(d.getMonth() + 1).padStart(2, '0');
                              const day = String(d.getDate()).padStart(2, '0');
                              setUpdateForm((f) => ({
                                ...f,
                                follow_up_date: `${y}-${m}-${day}`,
                              }));
                            }
                          }}
                        />
                      ) : null}

                      {showFollowUpDatePicker && Platform.OS === 'ios' ? (
                        <Modal visible transparent animationType="slide">
                          <TouchableOpacity
                            style={styles.dateOverlay}
                            activeOpacity={1}
                            onPress={() => setShowFollowUpDatePicker(false)}
                          />
                          <View style={styles.datePickerBox}>
                            <View style={styles.datePickerHeader}>
                              <Text style={styles.datePickerTitle}>Follow-up date</Text>
                              <TouchableOpacity onPress={() => setShowFollowUpDatePicker(false)}>
                                <Text style={styles.doneText}>Done</Text>
                              </TouchableOpacity>
                            </View>
                            <DateTimePicker
                              value={
                                updateForm.follow_up_date
                                  ? new Date(updateForm.follow_up_date + 'T12:00:00')
                                  : new Date()
                              }
                              mode="date"
                              minimumDate={new Date()}
                              display="spinner"
                              onChange={(_, d) => {
                                if (d) {
                                  const y = d.getFullYear();
                                  const m = String(d.getMonth() + 1).padStart(2, '0');
                                  const day = String(d.getDate()).padStart(2, '0');
                                  setUpdateForm((f) => ({
                                    ...f,
                                    follow_up_date: `${y}-${m}-${day}`,
                                  }));
                                }
                              }}
                            />
                          </View>
                        </Modal>
                      ) : null}
                    </>
                  )}

                  <View style={styles.productsSectionHeader}>
                    <Text style={styles.modalLabel}>Products Interested *</Text>
                  </View>

                  {updateForm.productsInterested.length === 0 ? (
                    <Text style={styles.hint}>No products added yet.</Text>
                  ) : (
                    updateForm.productsInterested.map((product, index) => {
                      const priced = PRICED_LINE_STATUSES.has(product.status);
                      const isNewCrossSale = product.sale_type === 'cross_sale' && !product.savedStatus;
                      const statusOptions = isNewCrossSale
                        ? [...ALL_FOLLOWUP_STATUSES]
                        : followUpStatusOptions(product.savedStatus || product.status, product.sale_type);
                      const detail = lineDetailLabel(product);
                      return (
                        <View key={`pi-${index}`} style={styles.productRowCard}>
                          <WebSelect
                            label="Product"
                            value={product.product_name}
                            disabled={!isNewCrossSale}
                            onValueChange={(v) =>
                              updateInterestedProduct(index, 'product_name', v)
                            }
                            items={
                              product.product_name &&
                              !productNames.includes(product.product_name)
                                ? [
                                    ...productSelectItems,
                                    { label: product.product_name, value: product.product_name },
                                  ]
                                : productSelectItems
                            }
                            placeholder="Select product"
                          />
                          {product.sale_type ? (
                            <View style={styles.saleTypeRow}>
                              <Text
                                style={[
                                  styles.saleTypeBadge,
                                  product.sale_type === 'renewal'
                                    ? styles.saleTypeRenewal
                                    : styles.saleTypeCrossSale,
                                ]}
                              >
                                {product.sale_type === 'renewal' ? 'Renewal' : 'Cross-Sale'}
                              </Text>
                              {detail ? (
                                <Text style={styles.lineDetailText} numberOfLines={2}>
                                  {detail}
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                          <WebSelect
                            label="Status"
                            value={product.status}
                            onValueChange={(v) => changeInterestedStatus(index, v)}
                            items={statusOptions.map((st) => ({ label: st, value: st }))}
                          />
                          <View style={styles.numbersRow}>
                            <View style={styles.numberCell}>
                              <Text style={styles.numberLabel}>Strength</Text>
                              <WebInput
                                style={[styles.input, !priced && styles.inputDisabled]}
                                placeholder="Qty"
                                value={product.strength}
                                editable={priced}
                                onChangeText={(t) => updateInterestedProduct(index, 'strength', t)}
                                keyboardType="number-pad"
                              />
                            </View>
                            <View style={styles.numberCell}>
                              <Text style={styles.numberLabel}>Unit Price</Text>
                              <WebInput
                                style={[styles.input, !priced && styles.inputDisabled]}
                                placeholder="₹"
                                value={product.unit_price}
                                editable={priced}
                                onChangeText={(t) => updateInterestedProduct(index, 'unit_price', t)}
                                keyboardType="decimal-pad"
                              />
                            </View>
                            <View style={styles.numberCell}>
                              <Text style={styles.numberLabel}>Chance %</Text>
                              <WebInput
                                style={[styles.input, !priced && styles.inputDisabled]}
                                placeholder="%"
                                value={product.chance}
                                editable={priced}
                                onChangeText={(t) => updateInterestedProduct(index, 'chance', t)}
                                keyboardType="number-pad"
                              />
                            </View>
                          </View>
                          {DROPPED_LINE_STATUSES.has(product.status) ? (
                            <WebInput
                              style={styles.input}
                              placeholder={
                                product.status === 'Not Renewed'
                                  ? 'Reason not renewed *'
                                  : 'Reason not interested *'
                              }
                              value={product.not_interested_reason}
                              onChangeText={(t) =>
                                updateInterestedProduct(index, 'not_interested_reason', t)
                              }
                            />
                          ) : null}
                        </View>
                      );
                    })
                  )}
                  {selectedLead?.lead_type === 'renewal' ? (
                    <TouchableOpacity onPress={addCrossSaleProduct} style={styles.addCrossSaleBtn}>
                      <Text style={styles.addProductLink}>+ Add cross-sale product</Text>
                    </TouchableOpacity>
                  ) : null}
                  <Text style={styles.hint}>
                    {selectedLead?.lead_type === 'renewal'
                      ? "Mark each of last year's products Renewed (continues) or Not Renewed (stopped, with a reason). New products added here are Cross-Sale and follow the same rules as a new school."
                      : 'Products are locked. Hot can only stay Hot or become Not Interested. Warm can stay Warm, become Hot, or become Not Interested. Yet to Visit can change to any status.'}
                  </Text>

                  <Text style={styles.modalLabel}>Remarks *</Text>
                  <WebInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Enter remarks for this follow-up"
                    value={updateForm.remarks}
                    onChangeText={(text) => setUpdateForm({ ...updateForm, remarks: text })}
                    multiline
                    numberOfLines={4}
                  />
                </>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={closeUpdateModal}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleUpdateFollowup}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color={colors.textLight} />
                ) : (
                  <Text style={styles.modalButtonTextSubmit}>Create Follow-up</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={showHistoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Follow-up History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {historyLead && (
                <Text style={styles.modalSchool}>{historyLead.school_name}</Text>
              )}
              {historyLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
              ) : history.length === 0 ? (
                <Text style={styles.hint}>No history entries yet.</Text>
              ) : (
                history.map((item, idx) => (
                  <View key={idx} style={styles.historyCard}>
                    <Text style={styles.historyDate}>{formatDateTime(item.updatedAt)}</Text>
                    <Text style={styles.historyMeta}>
                      Status: {item.priority || displayLeadDealPriority(historyLead || {})}
                    </Text>
                    {item.follow_up_date ? (
                      <Text style={styles.historyMeta}>
                        Next follow-up: {formatDateOnly(item.follow_up_date)}
                      </Text>
                    ) : null}
                    {item.remarks ? (
                      <Text style={styles.historyRemarks}>{item.remarks}</Text>
                    ) : null}
                    {Array.isArray(item.productsInterested) &&
                    item.productsInterested.length > 0 ? (
                      <Text style={styles.historyProducts}>
                        Products:{' '}
                        {item.productsInterested
                          .map((p: any) => {
                            const name = p.product_name || '';
                            if (!name) return '';
                            const bits = [name];
                            if (p.term) bits.push(p.term);
                            if (Number(p.chance) > 0) bits.push(`${p.chance}%`);
                            return bits.join(' · ');
                          })
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  filtersCard: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterLabel: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  filterInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  emptyContainer: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { ...typography.heading.h2, color: colors.textPrimary, marginBottom: 8 },
  emptySubtitle: {
    ...typography.body.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardTop: { padding: 16, paddingBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  schoolInfo: { flex: 1, marginRight: 12 },
  schoolName: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationIcon: { fontSize: 14, marginRight: 4 },
  locationText: { ...typography.body.small, color: colors.textSecondary },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  priorityText: { ...typography.body.small, fontWeight: '600', fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  cardBody: { padding: 16, paddingTop: 12 },
  infoGrid: { flexDirection: 'row', marginBottom: 12 },
  infoItem: { flex: 1, marginRight: 8 },
  infoLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 2 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '500' },
  dateContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: 10,
    backgroundColor: colors.info + '08',
    borderRadius: 8,
    marginBottom: 10,
  },
  dateContainerOverdue: { backgroundColor: colors.error + '08' },
  dateLabel: { ...typography.body.small, color: colors.textSecondary },
  dateValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '500' },
  dateValueOverdue: { color: colors.error, fontWeight: '600' },
  productsBlock: { marginBottom: 10 },
  productsLabel: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  productsEmpty: { ...typography.body.medium, color: colors.textSecondary },
  productLine: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    backgroundColor: colors.backgroundLight,
  },
  productLineName: {
    ...typography.body.medium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  productLineMeta: {
    ...typography.body.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  remarksContainer: { marginTop: 4 },
  remarksLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  remarksText: { ...typography.body.medium, color: colors.textPrimary },
  cardFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    minWidth: '47%',
    alignItems: 'center',
  },
  updateButton: { backgroundColor: colors.primary },
  editButton: { backgroundColor: '#7c3aed' },
  historyButton: { backgroundColor: colors.info },
  closeButton: { backgroundColor: colors.success },
  actionButtonText: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalBody: { padding: 20, maxHeight: 480 },
  modalSchool: { ...typography.body.medium, color: colors.textSecondary, marginBottom: 16 },
  modalLabel: {
    ...typography.body.medium,
    color: colors.textPrimary,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  dateText: { ...typography.body.medium, color: colors.textPrimary },
  datePlaceholder: { color: colors.textSecondary },
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
  cardChain: { borderWidth: 1, borderColor: '#93C5FD', backgroundColor: '#DBEAFE' },
  schoolTagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  schoolTownBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    color: '#404040',
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  schoolCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  saleTypeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: -4, marginBottom: 8 },
  saleTypeBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  saleTypeRenewal: { backgroundColor: '#D1FAE5', color: '#065F46' },
  saleTypeCrossSale: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  lineDetailText: { fontSize: 11, color: colors.textSecondary, flexShrink: 1 },
  numbersRow: { flexDirection: 'row', gap: 8 },
  numberCell: { flex: 1 },
  numberLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  inputDisabled: { backgroundColor: colors.backgroundMuted, color: colors.textMuted },
  addCrossSaleBtn: { paddingVertical: 8 },
  productsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addProductLink: { color: colors.primary, fontWeight: '600' },
  productRowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.background,
  },
  importantToggle: { marginBottom: 8 },
  starOn: { color: '#eab308', fontWeight: '600' },
  starOff: { color: colors.textSecondary },
  removeLink: { color: colors.error, fontSize: 13 },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  modalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonSubmit: { backgroundColor: colors.primary },
  modalButtonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  modalButtonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  historyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: colors.background,
  },
  historyDate: { ...typography.body.medium, fontWeight: '600', color: colors.textPrimary },
  historyMeta: { ...typography.body.small, color: colors.textSecondary, marginTop: 4 },
  historyRemarks: { ...typography.body.medium, color: colors.textPrimary, marginTop: 8 },
  historyProducts: { ...typography.body.small, color: colors.textSecondary, marginTop: 6 },
});
