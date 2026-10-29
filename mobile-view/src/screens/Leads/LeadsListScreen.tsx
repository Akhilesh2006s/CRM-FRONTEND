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
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, DataTable, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { confirmLogout } from '../../utils/confirmLogout';

interface Lead {
  _id: string;
  school_name?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  status?: string;
  priority?: string;
  follow_up_date?: string;
  location?: string;
  createdAt?: string;
}

export default function LeadsListScreen({ navigation }: any) {
  const { logout } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'followup' | 'closed'>('all');

  const handleLogout = () => {
    confirmLogout(logout);
  };

  useEffect(() => {
    loadLeads();
  }, [filter]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      let endpoint = '/leads';
      
      if (filter === 'open') {
        endpoint += '?status=Pending';
      } else if (filter === 'followup') {
        endpoint += '?status=Follow-up';
      } else if (filter === 'closed') {
        endpoint += '?status=Closed';
      }
      
      const response = await apiService.get(endpoint);
      const data = Array.isArray(response) ? response : (response?.data || []);
      data.sort((a: Lead, b: Lead) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      setLeads(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '-';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'closed':
        return colors.success;
      case 'follow-up':
        return colors.warning;
      case 'open':
        return colors.info;
      default:
        return colors.textSecondary;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'hot':
        return '#ef4444';
      case 'warm':
        return '#f97316';
      case 'cold':
        return '#3b82f6';
      default:
        return colors.textSecondary;
    }
  };

  return (
    <ScreenShell
      title="Leads"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
{/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', 'open', 'followup', 'closed'] as const).map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterTab,
                filter === filterType && styles.filterTabActive,
              ]}
              onPress={() => setFilter(filterType)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === filterType && styles.filterTabTextActive,
                ]}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No leads found</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigation.navigate('LeadAdd')}
            >
              <Text style={styles.emptyButtonText}>Add Lead</Text>
            </TouchableOpacity>
          </View>
        ) : (
          leads.map((lead) => (
            <TouchableOpacity
              key={lead._id}
              style={styles.leadCard}
              onPress={() => {
                if (lead.status === 'Closed') {
                  navigation.navigate('LeadClose', { id: lead._id });
                } else {
                  navigation.navigate('LeadEdit', { id: lead._id });
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.leadCardHeader}>
                <View style={styles.leadCardHeaderLeft}>
                  <Text style={styles.leadSchoolName}>
                    {lead.school_name || 'Unnamed School'}
                  </Text>
                  <View style={styles.leadBadges}>
                    {lead.status && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: getStatusColor(lead.status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: getStatusColor(lead.status) },
                          ]}
                        >
                          {lead.status}
                        </Text>
                      </View>
                    )}
                    {lead.priority && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: getPriorityColor(lead.priority) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: getPriorityColor(lead.priority) },
                          ]}
                        >
                          {lead.priority}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.leadCardBody}>
                <View style={styles.leadInfoRow}>
                  <Text style={styles.leadInfoLabel}>Contact:</Text>
                  <Text style={styles.leadInfoValue}>
                    {lead.contact_person || '-'}
                  </Text>
                </View>
                <View style={styles.leadInfoRow}>
                  <Text style={styles.leadInfoLabel}>Mobile:</Text>
                  <Text style={styles.leadInfoValue}>
                    {lead.contact_mobile || '-'}
                  </Text>
                </View>
                <View style={styles.leadInfoRow}>
                  <Text style={styles.leadInfoLabel}>Zone:</Text>
                  <Text style={styles.leadInfoValue}>{lead.zone || '-'}</Text>
                </View>
                {lead.location && (
                  <View style={styles.leadInfoRow}>
                    <Text style={styles.leadInfoLabel}>Location:</Text>
                    <Text style={styles.leadInfoValue}>{lead.location}</Text>
                  </View>
                )}
                {lead.follow_up_date && (
                  <View style={styles.leadInfoRow}>
                    <Text style={styles.leadInfoLabel}>Follow-up:</Text>
                    <Text style={styles.leadInfoValue}>
                      {formatDate(lead.follow_up_date)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.leadCardFooter}>
                <Text style={styles.leadDate}>
                  Created: {formatDate(lead.createdAt)}
                </Text>
                <Text style={styles.leadArrow}>›</Text>
              </View>
            </TouchableOpacity>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    fontSize: 24,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    fontSize: 20,
  },
  filterContainer: {
    backgroundColor: colors.backgroundLight,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    ...typography.label.medium,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.textLight,
    fontWeight: '600',
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
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  emptyButtonText: {
    ...typography.label.medium,
    color: colors.textLight,
    fontWeight: '600',
  },
  leadCard: {
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
  leadCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadCardHeaderLeft: {
    flex: 1,
  },
  leadSchoolName: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  leadBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    ...typography.label.small,
    fontWeight: '600',
  },
  leadCardBody: {
    marginBottom: 12,
  },
  leadInfoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  leadInfoLabel: {
    ...typography.body.medium,
    color: colors.textSecondary,
    width: 80,
  },
  leadInfoValue: {
    ...typography.body.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  leadCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  leadDate: {
    ...typography.body.small,
    color: colors.textSecondary,
  },
  leadArrow: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: 'bold',
  },
});

