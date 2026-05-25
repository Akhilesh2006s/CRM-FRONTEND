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

const DEAL_PRODUCT_STATUS_ORDER = ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'] as const;
const SCHOOL_LEAD_STATUSES = new Set(['Hot', 'Warm', 'Cold']);
const PRODUCT_LINE_STATUS_OPTIONS = [
  { label: 'Hot', value: 'Hot' },
  { label: 'Warm', value: 'Warm' },
  { label: 'Visit Again', value: 'Visit Again' },
  { label: 'Not Met Management', value: 'Not Met Management' },
  { label: 'Not Interested', value: 'Not Interested' },
];

type ProductInterested = {
  product_name: string;
  term: string;
  status: string;
  strength: string;
  chance: string;
};

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function combineFollowUpDateTime(dateStr: string, timeStr: string): string {
  const [h, m] = (timeStr || '10:00').split(':').map((v) => parseInt(v, 10) || 0);
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function normalizeProductLineStatus(status?: string): string {
  const s = (status || '').trim();
  if (s === 'Management Not Met') return 'Not Met Management';
  return s;
}

function deriveLeadPriorityFromDealProducts(products: { status?: string }[]): string | null {
  let best = '';
  let bestIdx = DEAL_PRODUCT_STATUS_ORDER.length;
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

function leadProductsToInterested(lead: any): ProductInterested[] {
  if (Array.isArray(lead.products) && lead.products.length > 0) {
    return lead.products.map((p: any) => ({
      product_name: p.product_name || p.product || '',
      term: p.term || 'Term 1',
      status: p.status || displayLeadDealPriority(lead) || 'Warm',
      strength:
        Number(p.strength ?? p.quantity ?? 0) > 0
          ? String(Number(p.strength ?? p.quantity ?? 0))
          : '',
      chance: Number(p.chance ?? 0) > 0 ? String(Number(p.chance ?? 0)) : '',
    }));
  }
  if (typeof lead.products === 'string' && lead.products.trim()) {
    return lead.products
      .split(',')
      .map((name: string) => name.trim())
      .filter(Boolean)
      .map((name: string) => ({
        product_name: name,
        term: 'Term 1',
        status: displayLeadDealPriority(lead) || 'Warm',
        strength: '',
        chance: '',
      }));
  }
  return [];
}

function formatProductsSummary(products: any): string {
  if (!products) return '—';
  if (typeof products === 'string' && products.trim()) return products.trim();
  if (Array.isArray(products) && products.length > 0) {
    const text = products
      .map((p: any) => {
        const name = p.product_name || p.product || p.name || '';
        if (!name) return '';
        const parts = [name];
        if (p.term) parts.push(p.term);
        if (Number(p.chance) > 0) parts.push(`${p.chance}%`);
        return parts.join(' · ');
      })
      .filter(Boolean)
      .join(', ');
    return text || '—';
  }
  return '—';
}

export default function LeadFollowupScreen({ navigation }: any) {
  const { user } = useAuth();
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [mobileFilter, setMobileFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFollowUpDatePicker, setShowFollowUpDatePicker] = useState(false);
  const [showFollowUpTimePicker, setShowFollowUpTimePicker] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [historyLead, setHistoryLead] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [productNames, setProductNames] = useState<string[]>([]);
  const [updateForm, setUpdateForm] = useState({
    follow_up_date: '',
    follow_up_time: '10:00',
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
  }, [allLeads, zoneFilter, schoolFilter, mobileFilter]);

  const loadProductCatalog = async () => {
    try {
      let data: any;
      try {
        data = await apiService.get('/products/active');
      } catch {
        data = await apiService.get('/products');
      }
      const list = Array.isArray(data) ? data : data?.data || [];
      const names = list
        .map((p: any) => (typeof p === 'string' ? p : p.name || p.product_name || ''))
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

      const [leadsResponse, dcOrdersResponse] = await Promise.all([
        apiService.get(`/leads?employee=${user._id}`).catch(() => []),
        apiService.get(`/dc-orders?assigned_to=${user._id}`).catch(() => []),
      ]);

      const allData = Array.isArray(leadsResponse) ? leadsResponse : leadsResponse?.data || [];
      const dcOrders = Array.isArray(dcOrdersResponse) ? dcOrdersResponse : dcOrdersResponse?.data || [];

      const activeLeads = (Array.isArray(allData) ? allData : [])
        .filter((lead: any) => {
          const status = lead.status?.toLowerCase();
          return status !== 'saved' && status !== 'completed' && status !== 'closed';
        })
        .map((lead: any) => ({ ...lead }));

      const leadsFromOrders: any[] = dcOrders
        .filter((order: any) => {
          const status = order.status?.toLowerCase();
          return status !== 'saved' && status !== 'completed' && status !== 'closed';
        })
        .map((order: any) => ({
          _id: order._id,
          school_name: order.school_name,
          contact_person: order.contact_person,
          contact_mobile: order.contact_mobile,
          zone: order.zone,
          status: order.status,
          follow_up_date: order.follow_up_date || order.estimated_delivery_date,
          location: order.location,
          strength: order.strength,
          createdAt: order.createdAt,
          remarks: order.remarks,
          school_type: order.school_type,
          products: Array.isArray(order.products) ? order.products : undefined,
          lead_status: order.lead_status,
          priority: order.priority,
        }));

      const combinedLeads = [...activeLeads, ...leadsFromOrders];
      const followUpLeads = combinedLeads.filter((lead: any) => {
        const status = lead.status?.toLowerCase();
        if (status === 'saved' || status === 'completed' || status === 'closed') return false;
        return (
          status === 'pending' ||
          status === 'processing' ||
          (lead.follow_up_date && new Date(lead.follow_up_date) >= new Date())
        );
      });

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
    if (schoolFilter) {
      filtered = filtered.filter((l) =>
        l.school_name?.toLowerCase().includes(schoolFilter.toLowerCase())
      );
    }
    if (mobileFilter) {
      filtered = filtered.filter((l) => l.contact_mobile?.includes(mobileFilter));
    }
    filtered.sort((a, b) => {
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
    const prefilled = leadProductsToInterested(lead);
    setUpdateForm({
      follow_up_date: '',
      follow_up_time: '10:00',
      remarks: '',
      productsInterested: prefilled.length > 0 ? prefilled : [],
    });
    setShowUpdateModal(true);
  };

  const closeUpdateModal = () => {
    setShowUpdateModal(false);
    setSelectedLead(null);
    setModalError(null);
    setUpdateForm({
      follow_up_date: '',
      follow_up_time: '10:00',
      remarks: '',
      productsInterested: [],
    });
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const addInterestedProduct = () => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: [
        ...prev.productsInterested,
        {
          product_name: '',
          term: 'Term 1',
          status: 'Warm',
          strength: '',
          chance: '',
        },
      ],
    }));
  };

  const removeInterestedProduct = (index: number) => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: prev.productsInterested.filter((_, i) => i !== index),
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
    if (!updateForm.follow_up_time?.trim()) {
      setModalError('Follow-up time is required');
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
      setModalError('Add at least one product with Strength and Chance %');
      return;
    }
    const missingStrengthOrChance = selectedProducts.some(
      (p) => (Number(p.strength) || 0) <= 0 || (Number(p.chance) || 0) <= 0
    );
    if (missingStrengthOrChance) {
      setModalError('Each product needs Strength > 0 and Chance % > 0');
      return;
    }

    setUpdating(true);
    try {
      const validProducts = selectedProducts.map((p) => ({
        product_name: p.product_name.trim(),
        term: p.term || 'Term 1',
        status: p.status || 'Warm',
        strength: Number(p.strength) || 0,
        chance: Number(p.chance) || 0,
        important: false,
        quantity: Number(p.strength) || 0,
        unit_price: 0,
      }));

      const derivedPriority = deriveLeadPriorityFromDealProducts(validProducts);
      const schoolLeadStatus = (selectedLead.lead_status || '').trim();
      const payload: any = {
        follow_up_date: combineFollowUpDateTime(
          updateForm.follow_up_date,
          updateForm.follow_up_time
        ),
        remarks: updateForm.remarks.trim(),
        productsInterested: validProducts,
      };
      if (SCHOOL_LEAD_STATUSES.has(schoolLeadStatus)) {
        payload.lead_status = schoolLeadStatus;
        payload.priority = schoolLeadStatus;
      } else {
        payload.priority =
          derivedPriority || selectedLead.priority || displayLeadDealPriority(selectedLead);
      }

      try {
        await apiService.put(`/dc-orders/${selectedLead._id}`, payload);
      } catch {
        await apiService.put(`/leads/${selectedLead._id}`, payload);
      }

      setSuccessMessage('Follow-up created successfully!');
      closeUpdateModal();
      loadLeads();
    } catch (error: any) {
      setModalError(error.message || 'Failed to create follow-up');
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
          productsInterested: leadProductsToInterested(lead),
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
                ? 'Create leads to see them here.'
                : 'No leads match the current filters.'}
            </Text>
          </View>
        ) : (
          leads.map((lead) => {
            const isOverdue =
              lead.follow_up_date && new Date(lead.follow_up_date) < new Date();

            return (
              <View key={lead._id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardHeader}>
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName} numberOfLines={2}>
                        {lead.school_name || 'Unnamed School'}
                      </Text>
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
                    <Text style={styles.dateLabel}>Follow-up date & time: </Text>
                    <Text style={[styles.dateValue, isOverdue && styles.dateValueOverdue]}>
                      {formatDateTime(lead.follow_up_date)}
                    </Text>
                  </View>

                  <View style={styles.productsRow}>
                    <Text style={styles.productsLabel}>Products interested: </Text>
                    <Text style={styles.productsValue}>
                      {formatProductsSummary(lead.products)}
                    </Text>
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
                    onPress={() =>
                      Alert.alert('Close Lead', 'Close this lead?', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Close',
                          onPress: () => navigation.navigate('LeadClose', { id: lead._id }),
                        },
                      ])
                    }
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

                  {showFollowUpDatePicker && (
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
                              ? new Date(updateForm.follow_up_date)
                              : new Date()
                          }
                          mode="date"
                          minimumDate={new Date()}
                          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
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
                            if (Platform.OS === 'android') setShowFollowUpDatePicker(false);
                          }}
                        />
                      </View>
                    </Modal>
                  )}

                  <Text style={styles.modalLabel}>Follow-up Time *</Text>
                  <TouchableOpacity
                    style={styles.dateTouchable}
                    onPress={() => setShowFollowUpTimePicker(true)}
                  >
                    <Text style={styles.dateText}>
                      {updateForm.follow_up_time || '10:00'}
                    </Text>
                    <Text>🕐</Text>
                  </TouchableOpacity>
                  {showFollowUpTimePicker && (
                    <Modal visible transparent animationType="slide">
                      <TouchableOpacity
                        style={styles.dateOverlay}
                        activeOpacity={1}
                        onPress={() => setShowFollowUpTimePicker(false)}
                      />
                      <View style={styles.datePickerBox}>
                        <View style={styles.datePickerHeader}>
                          <Text style={styles.datePickerTitle}>Follow-up time</Text>
                          <TouchableOpacity onPress={() => setShowFollowUpTimePicker(false)}>
                            <Text style={styles.doneText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={new Date(`1970-01-01T${updateForm.follow_up_time || '10:00'}:00`)}
                          mode="time"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={(_, d) => {
                            if (d) {
                              const h = String(d.getHours()).padStart(2, '0');
                              const min = String(d.getMinutes()).padStart(2, '0');
                              setUpdateForm((f) => ({
                                ...f,
                                follow_up_time: `${h}:${min}`,
                              }));
                            }
                            if (Platform.OS === 'android') setShowFollowUpTimePicker(false);
                          }}
                        />
                      </View>
                    </Modal>
                  )}

                  <View style={styles.productsSectionHeader}>
                    <Text style={styles.modalLabel}>Products Interested *</Text>
                    <TouchableOpacity onPress={addInterestedProduct}>
                      <Text style={styles.addProductLink}>+ Add Product</Text>
                    </TouchableOpacity>
                  </View>

                  {updateForm.productsInterested.length === 0 ? (
                    <Text style={styles.hint}>No products added yet.</Text>
                  ) : (
                    updateForm.productsInterested.map((product, index) => (
                      <View key={`pi-${index}`} style={styles.productRowCard}>
                        <WebSelect
                          label="Product"
                          value={product.product_name}
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
                        <WebSelect
                          label="Status"
                          value={product.status}
                          onValueChange={(v) => updateInterestedProduct(index, 'status', v)}
                          items={PRODUCT_LINE_STATUS_OPTIONS}
                        />
                        <WebInput
                          style={styles.input}
                          placeholder="Strength (qty)"
                          value={product.strength}
                          onChangeText={(t) => updateInterestedProduct(index, 'strength', t)}
                          keyboardType="number-pad"
                        />
                        <WebInput
                          style={styles.input}
                          placeholder="Chance %"
                          value={product.chance}
                          onChangeText={(t) => updateInterestedProduct(index, 'chance', t)}
                          keyboardType="number-pad"
                        />
                        <TouchableOpacity onPress={() => removeInterestedProduct(index)}>
                          <Text style={styles.removeLink}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}

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
                        Next follow-up: {formatDateTime(item.follow_up_date)}
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
  productsRow: { marginBottom: 8 },
  productsLabel: { ...typography.body.small, color: colors.textSecondary },
  productsValue: { ...typography.body.medium, color: colors.textPrimary, marginTop: 4 },
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
