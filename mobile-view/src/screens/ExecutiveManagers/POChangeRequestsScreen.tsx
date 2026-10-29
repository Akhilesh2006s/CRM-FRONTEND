/**
 * Executive Manager: list of pending PO change requests (assigned to this manager only). Tap card → Detail to Approve/Reject.
 */
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
import { apiService, getApiUrl } from '../../services/api';

export default function POChangeRequestsScreen({ navigation }: any) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const endpoint = '/executive-managers/po-change-requests';
    const fullUrl = `${getApiUrl()}${endpoint}`;
    try {
      setLoading(true);
      const data = await apiService.get(endpoint);
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to load PO change requests';
      Alert.alert('Error', `${msg}\n\nURL: ${fullUrl}`);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <ScreenShell
      title="PO Change Requests"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
<ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No pending PO change requests from your team</Text>
            <Text style={styles.emptySubtext}>Requests are routed only to the Executive Manager assigned to each Executive.</Text>
          </View>
        ) : (
          list.map((order) => {
            const req = order.poChangeRequest;
            const requestedAt = req?.requestedAt ? new Date(req.requestedAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
            const executiveName = req?.requestedBy?.name || req?.requestedBy?.email || 'Executive';
            return (
              <TouchableOpacity
                key={order._id}
                style={styles.card}
                onPress={() => navigation.navigate('POChangeRequestDetail', { orderId: order._id })}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{order.school_name}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>Pending</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>Executive: {executiveName}</Text>
                <Text style={styles.cardMeta}>Request date: {requestedAt}</Text>
                {req?.remarks ? <Text style={styles.cardRemarks} numberOfLines={2}>Reason: {req.remarks}</Text> : null}
                <Text style={styles.cardTap}>Tap to open → Approve / Reject</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h3, color: colors.textLight, flex: 1, textAlign: 'center' },
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  emptySubtext: { ...typography.body.small, color: colors.textSecondary, textAlign: 'center' },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { ...typography.heading.h4, color: colors.textPrimary, flex: 1 },
  statusBadge: { backgroundColor: colors.warning + '25', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { ...typography.body.small, fontWeight: '600', color: colors.textPrimary },
  cardMeta: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  cardRemarks: { ...typography.body.small, color: colors.textPrimary, marginTop: 8 },
  cardTap: { ...typography.body.small, color: colors.primary, marginTop: 12, fontWeight: '600' },
});
