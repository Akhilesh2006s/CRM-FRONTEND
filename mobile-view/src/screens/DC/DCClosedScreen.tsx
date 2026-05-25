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
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';

interface DcOrder {
  _id: string;
  school_name?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  school_type?: string;
  location?: string;
  assigned_to?: { name?: string; _id?: string };
  created_at?: string;
  createdAt?: string;
  status?: string;
  pod_proof_url?: string;
  isLead?: boolean;
}

export default function DCClosedScreen({ navigation }: any) {
  const [items, setItems] = useState<DcOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch DcOrders with various statuses
      const [completedRes, savedRes, dcRequestedRes, dcAcceptedRes] = await Promise.all([
        apiService.get('/dc-orders?status=completed').catch(() => ({ data: [] })),
        apiService.get('/dc-orders?status=saved').catch(() => ({ data: [] })),
        apiService.get('/dc-orders?status=dc_requested').catch(() => ({ data: [] })),
        apiService.get('/dc-orders?status=dc_accepted').catch(() => ({ data: [] })),
      ]);

      const completedArray = Array.isArray(completedRes) ? completedRes : (completedRes?.data || []);
      const savedArray = Array.isArray(savedRes) ? savedRes : (savedRes?.data || []);
      const dcRequestedArray = Array.isArray(dcRequestedRes) ? dcRequestedRes : (dcRequestedRes?.data || []);
      const dcAcceptedArray = Array.isArray(dcAcceptedRes) ? dcAcceptedRes : (dcAcceptedRes?.data || []);

      let data = [...completedArray, ...savedArray, ...dcRequestedArray, ...dcAcceptedArray].filter(
        (d: any) => d.status !== 'dc_approved' && d.status !== 'dc_sent_to_senior'
      );

      // Fetch closed leads
      try {
        const closedLeadsRes = await apiService.get('/leads?status=Closed&limit=1000');
        const closedLeadsArray = Array.isArray(closedLeadsRes) ? closedLeadsRes : (closedLeadsRes?.data || []);
        
        const closedLeadsAsDeals: DcOrder[] = closedLeadsArray.map((lead: any) => ({
          _id: lead._id,
          school_name: lead.school_name || '',
          contact_person: lead.contact_person || '',
          contact_mobile: lead.contact_mobile || '',
          zone: lead.zone || '',
          school_type: lead.school_type || '',
          location: lead.location || lead.address || '',
          assigned_to: lead.managed_by || lead.assigned_by || lead.createdBy || undefined,
          created_at: lead.createdAt,
          createdAt: lead.createdAt,
          status: 'Closed',
          isLead: true,
        }));

        // Filter out closed leads that have matching DcOrders with dc_requested/dc_accepted
        const filteredClosedLeads = closedLeadsAsDeals.filter((lead: DcOrder) => {
          const hasMatchingDcOrder = data.some((dcOrder: any) => {
            const schoolNameMatch = (dcOrder.school_name || '').toLowerCase().trim() === (lead.school_name || '').toLowerCase().trim();
            const mobileMatch = (dcOrder.contact_mobile || '').trim() === (lead.contact_mobile || '').trim();
            const isDcRequested = dcOrder.status === 'dc_requested' || dcOrder.status === 'dc_accepted';
            return schoolNameMatch && mobileMatch && isDcRequested;
          });
          return !hasMatchingDcOrder;
        });

        data = [...data, ...filteredClosedLeads];
      } catch (e) {
        console.warn('Failed to load closed leads:', e);
      }

      // Sort by creation date (most recent first)
      data.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setItems(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load closed sales');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const getStatusButtonText = (status?: string) => {
    if (status === 'dc_requested' || status === 'dc_accepted') {
      return 'Raise DC';
    }
    if (status === 'dc_accepted') {
      return 'Update DC';
    }
    return 'Raise DC';
  };

  return (
    <ScreenShell
      title="Closed Sales"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>No closed sales found</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.schoolName}>
                  {item.school_name || 'Unnamed School'}
                </Text>
                {item.status && (
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          item.status === 'dc_requested' || item.status === 'dc_accepted'
                            ? colors.primary + '20'
                            : colors.success + '20',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            item.status === 'dc_requested' || item.status === 'dc_accepted'
                              ? colors.primary
                              : colors.success,
                        },
                      ]}
                    >
                      {item.status === 'dc_requested' || item.status === 'dc_accepted'
                        ? 'DC Requested'
                        : item.status}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Executive:</Text>
                  <Text style={styles.infoValue}>
                    {item.assigned_to?.name || '-'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mobile:</Text>
                  <Text style={styles.infoValue}>
                    {item.contact_mobile || '-'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Zone:</Text>
                  <Text style={styles.infoValue}>{item.zone || '-'}</Text>
                </View>
                {item.location && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Location:</Text>
                    <Text style={styles.infoValue}>{item.location}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Created:</Text>
                  <Text style={styles.infoValue}>
                    {formatDateTime(item.created_at || item.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    // Navigate to DC create/edit screen
                    navigation.navigate('DCCreate', { dealId: item._id });
                  }}
                >
                  <Text style={styles.actionButtonText}>
                    {getStatusButtonText(item.status)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.viewLocationButton}
                  onPress={() => {
                    Alert.alert('Location', item.location || 'No location available');
                  }}
                >
                  <Text style={styles.viewLocationButtonText}>
                    View Location
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 12,
    ...typography.body.medium,
    color: colors.textSecondary,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  headerTitle: {
    ...typography.heading.h1,
    color: colors.textLight,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    ...typography.heading.h3,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  schoolName: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusBadgeText: {
    ...typography.label.small,
    fontWeight: '600',
  },
  cardBody: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    ...typography.body.medium,
    color: colors.textSecondary,
    width: 90,
  },
  infoValue: {
    ...typography.body.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  actionButtonText: {
    ...typography.label.medium,
    color: colors.textLight,
    fontWeight: '600',
  },
  viewLocationButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  viewLocationButtonText: {
    ...typography.label.medium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});


