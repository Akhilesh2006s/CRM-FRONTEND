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
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import MessageBanner from '../../components/MessageBanner';
import LogoutButton from '../../components/LogoutButton';

const DEAL_PRODUCT_STATUS_ORDER = ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'] as const;

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
  return 'Hot';
}

export default function LeadFollowupScreen({ navigation }: any) {
  const { user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [updateForm, setUpdateForm] = useState({
    follow_up_date: '',
    priority: 'Hot',
    remarks: '',
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      setLoading(true);
      
      if (!user?._id) {
        Alert.alert('Error', 'User not found');
        setLoading(false);
        return;
      }

      // Fetch leads and dc-orders assigned to current employee (like web app)
      const [leadsResponse, dcOrdersResponse] = await Promise.all([
        apiService.get(`/leads?employee=${user._id}`).catch(() => []),
        apiService.get(`/dc-orders?assigned_to=${user._id}`).catch(() => [])
      ]);

      const allData = Array.isArray(leadsResponse) ? leadsResponse : (leadsResponse?.data || []);
      const dcOrders = Array.isArray(dcOrdersResponse) ? dcOrdersResponse : (dcOrdersResponse?.data || []);

      // Filter out closed/saved/completed leads
      const activeLeads = (Array.isArray(allData) ? allData : [])
        .filter((lead: any) => {
        const status = lead.status?.toLowerCase();
        return status !== 'saved' && status !== 'completed' && status !== 'closed';
      })
        .map((lead: any) => ({ ...lead }));

      // Convert dc-orders to lead format and exclude closed/saved leads
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

      // Combine and filter follow-up leads
      const combinedLeads = [...activeLeads, ...leadsFromOrders];

      // Filter leads that need follow-up - exclude closed/saved/completed leads
      const followUpLeads = combinedLeads.filter((lead: any) => {
        const status = lead.status?.toLowerCase();
        // Exclude closed/saved/completed leads
        if (status === 'saved' || status === 'completed' || status === 'closed') {
          return false;
        }
        // Include pending/processing leads or leads with future follow-up dates
        return (
          status === 'pending' ||
          status === 'processing' ||
          (lead.follow_up_date && new Date(lead.follow_up_date) >= new Date())
        );
      });

      // Remove duplicates by _id
      const uniqueLeads = followUpLeads.filter((lead, index, self) =>
        index === self.findIndex((l) => l._id === lead._id)
      );

      setLeads(uniqueLeads);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load follow-up leads');
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  const openUpdateModal = (lead: any) => {
    setSelectedLead(lead);
    setUpdateForm({
      follow_up_date: '',
      priority: displayLeadDealPriority(lead),
      remarks: '',
    });
    setShowUpdateModal(true);
  };

  const closeUpdateModal = () => {
    setShowUpdateModal(false);
    setSelectedLead(null);
    setUpdateForm({ follow_up_date: '', priority: 'Hot', remarks: '' });
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleUpdateFollowup = async () => {
    if (!selectedLead) return;
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!updateForm.follow_up_date || !updateForm.follow_up_date.trim()) {
      setErrorMessage('Next Follow-up Date is required');
      return;
    }
    if (!updateForm.remarks || !updateForm.remarks.trim()) {
      setErrorMessage('Remarks is required');
      return;
    }

    setUpdating(true);
    try {
      const payload: any = {
        follow_up_date: new Date(updateForm.follow_up_date).toISOString(),
        priority: updateForm.priority,
        remarks: updateForm.remarks,
      };

      try {
        await apiService.put(`/dc-orders/${selectedLead._id}`, payload);
      } catch (err: any) {
        await apiService.put(`/leads/${selectedLead._id}`, payload);
      }

      setSuccessMessage('Follow-up created successfully!');
      closeUpdateModal();
      loadLeads();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update follow-up');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditLead = (lead: any) => {
    navigation.navigate('LeadEdit', { id: lead._id });
  };

  const handleCloseLead = (lead: any) => {
    Alert.alert(
      'Close Lead',
      'Are you sure you want to close this lead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () => navigation.navigate('LeadClose', { id: lead._id }),
        },
      ]
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'hot':
        return { bg: colors.error + '15', text: colors.error, border: colors.error + '30' };
      case 'warm':
        return { bg: colors.warning + '15', text: colors.warning, border: colors.warning + '30' };
      case 'cold':
        return { bg: colors.info + '15', text: colors.info, border: colors.info + '30' };
      case 'visit again':
        return { bg: '#fbbf24' + '15', text: '#fbbf24', border: '#fbbf24' + '30' };
      default:
        return { bg: colors.textSecondary + '15', text: colors.textSecondary, border: colors.textSecondary + '30' };
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading follow-up leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.primary as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Follow-up Leads</Text>
            <Text style={styles.headerSubtitle}>{leads.length} {leads.length === 1 ? 'lead' : 'leads'} pending</Text>
          </View>
          <LogoutButton />
        </View>
      </LinearGradient>
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {successMessage && (
          <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
        )}
        {errorMessage && (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        )}
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>📞</Text>
            </View>
            <Text style={styles.emptyTitle}>No Follow-up Leads</Text>
            <Text style={styles.emptySubtitle}>All your leads are up to date or there are no pending follow-ups</Text>
          </View>
        ) : (
          leads.map((lead) => {
            const dealPriority = displayLeadDealPriority(lead);
            const priorityColors = getPriorityColor(dealPriority);
            const isOverdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date();
            
            return (
              <TouchableOpacity 
                key={lead._id} 
                style={styles.card} 
                onPress={() => navigation.navigate('LeadEdit', { id: lead._id })} 
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardHeader}>
                    <View style={styles.schoolInfo}>
                      <Text style={styles.schoolName} numberOfLines={2}>
                        {lead.school_name || 'Unnamed School'}
                      </Text>
                      {lead.location && (
                        <View style={styles.locationRow}>
                          <Text style={styles.locationIcon}>📍</Text>
                          <Text style={styles.locationText}>{lead.location}</Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityColors.bg, borderColor: priorityColors.border }]}>
                      <Text style={[styles.priorityText, { color: priorityColors.text }]}>
                        {dealPriority}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.cardBody}>
                  <View style={styles.infoGrid}>
                    <View style={styles.infoItem}>
                      <Text style={styles.infoIcon}>👤</Text>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Contact</Text>
                        <Text style={styles.infoValue} numberOfLines={1}>
                          {lead.contact_person || '-'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.infoItem}>
                      <Text style={styles.infoIcon}>📱</Text>
                      <View style={styles.infoContent}>
                        <Text style={styles.infoLabel}>Mobile</Text>
                        <Text style={styles.infoValue}>
                          {lead.contact_mobile || '-'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {lead.follow_up_date && (
                    <View style={[styles.dateContainer, isOverdue && styles.dateContainerOverdue]}>
                      <Text style={styles.dateIcon}>📅</Text>
                      <Text style={styles.dateLabel}>Follow-up: </Text>
                      <Text style={[styles.dateValue, isOverdue && styles.dateValueOverdue]}>
                        {formatDateTime(lead.follow_up_date)}
                      </Text>
                    </View>
                  )}
                  
                  {lead.remarks && (
                    <View style={styles.remarksContainer}>
                      <Text style={styles.remarksLabel}>Remarks:</Text>
                      <Text style={styles.remarksText} numberOfLines={2}>
                        {lead.remarks}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.cardFooter}>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.updateButton]}
                      onPress={() => openUpdateModal(lead)}
                    >
                      <Text style={styles.actionButtonText}>📅 Follow-up</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => handleEditLead(lead)}
                    >
                      <Text style={styles.actionButtonText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.closeButton, { marginRight: 0 }]}
                      onPress={() => handleCloseLead(lead)}
                    >
                      <Text style={[styles.actionButtonText, styles.closeButtonText]}>✅ Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Update Follow-up Modal */}
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
              {errorMessage && (
                <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
              )}
              {selectedLead && (
                <>
                  <Text style={styles.modalLabel}>School: {selectedLead.school_name || 'Unknown'}</Text>
                  
                  <Text style={styles.modalLabel}>Next Follow-up Date *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    value={updateForm.follow_up_date}
                    onChangeText={(text) => setUpdateForm({ ...updateForm, follow_up_date: text })}
                  />
                  <Text style={styles.inputHint}>Format: YYYY-MM-DD (e.g., 2024-12-25)</Text>

                  <Text style={styles.modalLabel}>Priority *</Text>
                  <View style={styles.priorityContainer}>
                    {['Hot', 'Warm', 'Cold', 'Visit Again'].map((priority) => (
                      <TouchableOpacity
                        key={priority}
                        style={[
                          styles.priorityButton,
                          updateForm.priority === priority && styles.priorityButtonActive,
                        ]}
                        onPress={() => setUpdateForm({ ...updateForm, priority })}
                      >
                        <Text
                          style={[
                            styles.priorityButtonText,
                            updateForm.priority === priority && styles.priorityButtonTextActive,
                          ]}
                        >
                          {priority}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modalLabel}>Remarks *</Text>
                  <TextInput
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
                style={[styles.modalButton, styles.modalButtonCancel, { marginRight: 12 }]}
                onPress={closeUpdateModal}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit, { marginRight: 0 }]}
                onPress={handleUpdateFollowup}
                disabled={updating || !updateForm.follow_up_date || !updateForm.remarks}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, marginBottom: 4 },
  headerSubtitle: { ...typography.body.small, color: colors.textLight + 'CC' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyIconContainer: { marginBottom: 16 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { ...typography.heading.h2, color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 },
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
  schoolName: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationIcon: { fontSize: 14, marginRight: 4 },
  locationText: { ...typography.body.small, color: colors.textSecondary },
  priorityBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12, 
    borderWidth: 1,
  },
  priorityText: { ...typography.body.small, fontWeight: '600', fontSize: 11 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  cardBody: { padding: 16, paddingTop: 12 },
  infoGrid: { flexDirection: 'row', marginBottom: 12 },
  infoItem: { flex: 1, flexDirection: 'row', marginRight: 16 },
  infoIcon: { fontSize: 18, marginRight: 8, marginTop: 2 },
  infoContent: { flex: 1 },
  infoLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  infoValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '500' },
  dateContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    backgroundColor: colors.info + '08', 
    borderRadius: 8, 
    marginBottom: 12,
  },
  dateContainerOverdue: { backgroundColor: colors.error + '08' },
  dateIcon: { fontSize: 16, marginRight: 8 },
  dateLabel: { ...typography.body.small, color: colors.textSecondary },
  dateValue: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '500' },
  dateValueOverdue: { color: colors.error, fontWeight: '600' },
  remarksContainer: { marginTop: 8 },
  remarksLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  remarksText: { ...typography.body.medium, color: colors.textPrimary },
  cardFooter: { 
    padding: 16, 
    paddingTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: colors.border,
    backgroundColor: colors.background + '50',
  },
  actionButtons: { flexDirection: 'row' },
  actionButton: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', marginRight: 8 },
  updateButton: { backgroundColor: colors.primary },
  editButton: { backgroundColor: colors.info },
  closeButton: { backgroundColor: colors.success },
  actionButtonText: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  closeButtonText: { color: colors.textLight },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalBody: { padding: 20 },
  modalLabel: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: colors.background, borderRadius: 12, padding: 12, ...typography.body.medium, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  inputHint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  priorityContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  priorityButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, marginRight: 8, marginBottom: 8 },
  priorityButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  priorityButtonText: { ...typography.body.small, color: colors.textPrimary },
  priorityButtonTextActive: { color: colors.textLight, fontWeight: '600' },
  modalFooter: { flexDirection: 'row', padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  modalButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  modalButtonSubmit: { backgroundColor: colors.primary },
  modalButtonTextCancel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  modalButtonTextSubmit: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});

