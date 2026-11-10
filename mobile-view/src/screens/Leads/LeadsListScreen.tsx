import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, Badge, InfoRow, EmptyState, toneFor, type Tone } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { confirmLogout } from '../../utils/confirmLogout';
import SchoolOverview from '../../components/SchoolOverview';

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const priorityTone = (priority?: string): Tone => {
    switch (priority?.toLowerCase()) {
      case 'hot':
        return 'error';
      case 'warm':
        return 'warning';
      case 'cold':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visibleLeads = !words.length
    ? leads
    : leads.filter((l) => {
        const hay = [l.school_name, l.contact_person, l.contact_mobile, l.zone, l.location, l.status, l.priority]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return words.every((w) => hay.includes(w));
      });

  return (
    <ScreenShell
      title="My Schools"
      subtitle="Tap a school to see its deals, DCs, payments and visits."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <WebInput placeholder="Search school, contact, mobile, zone…" value={search} onChangeText={setSearch} />

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['all', 'open', 'followup', 'closed'] as const).map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[styles.filterTab, filter === filterType && styles.filterTabActive]}
              onPress={() => setFilter(filterType)}
            >
              <Text style={[styles.filterTabText, filter === filterType && styles.filterTabTextActive]}>
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {visibleLeads.length === 0 ? (
        <EmptyState icon="📋" title="No schools found" />
      ) : (
        visibleLeads.map((lead) => {
          const open = openId === lead._id;
          return (
            <Card key={lead._id} onPress={() => setOpenId(open ? null : lead._id)}>
              <CardTitle
                title={lead.school_name || 'Unnamed School'}
                badge={lead.status || undefined}
                tone={toneFor(lead.status)}
              />
              <InfoRow label="Priority" value={lead.priority ? <Badge label={lead.priority} tone={priorityTone(lead.priority)} /> : undefined} />
              <InfoRow label="Contact" value={lead.contact_person || undefined} />
              <InfoRow label="Mobile" value={lead.contact_mobile || undefined} phone />
              <InfoRow label="Zone" value={lead.zone || undefined} />
              <InfoRow label="Location" value={lead.location || undefined} />
              <InfoRow label="Follow-up" value={lead.follow_up_date ? formatDate(lead.follow_up_date) : undefined} />
              <View style={styles.footer}>
                <Text style={styles.footerDate}>Created: {formatDate(lead.createdAt)}</Text>
                <Text style={styles.footerToggle}>{open ? 'Hide details ⌃' : 'Details ⌄'}</Text>
              </View>
              {open ? (
                <SchoolOverview
                  leadId={lead._id}
                  onEdit={() => navigation.navigate(lead.status === 'Closed' ? 'LeadClose' : 'LeadEdit', { id: lead._id })}
                />
              ) : null}
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filterContainer: { marginBottom: 12 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  filterTabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  filterTabTextActive: { color: colors.textLight },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primaryDark },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: colors.primaryForeground },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEF2F7',
  },
  footerDate: { fontSize: 13, color: colors.textTertiary },
  footerToggle: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
});
