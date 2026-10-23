/**
 * View Tickets — web components/tickets/TicketsInbox.tsx (All / Solved / Pending).
 * Coordinator inbox (Admin, Super Admin, Coordinator roles with complaints.inbox): mark tickets solved with a note.
 * Optional route param `view`: 'all' | 'solved' | 'pending'.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/colors';
import { apiService } from '../../services/api';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';
import { fmtTicketDate, personDesignation, personName, ticketStatusLabel, type Ticket } from './ticketHelpers';

export type TicketsView = 'all' | 'solved' | 'pending';

const VIEWS: { view: TicketsView; label: string; status?: Ticket['status'] }[] = [
  { view: 'all', label: 'All Tickets' },
  { view: 'solved', label: 'Solved Tickets', status: 'Resolved' },
  { view: 'pending', label: 'Pending Tickets', status: 'Open' },
];

export default function ViewTicketsScreen({ route }: any) {
  const initial = (route?.params?.view as TicketsView) || 'all';
  const [view, setView] = useState<TicketsView>(VIEWS.some((v) => v.view === initial) ? initial : 'all');
  const current = VIEWS.find((v) => v.view === view) || VIEWS[0];
  const [items, setItems] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get(`/complaints${current.status ? `?status=${current.status}` : ''}`);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.response?.data?.message || e?.message || 'Failed to load tickets' });
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [current.status]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const confirmResolve = async () => {
    if (!resolveId) return;
    setActing(true);
    try {
      await apiService.put(`/complaints/${resolveId}/resolve`, { resolutionNote });
      setMessage({ type: 'success', text: 'Ticket marked solved' });
      setResolveId(null);
      setResolutionNote('');
      load();
    } catch (e: any) {
      setMessage({ type: 'error', text: e?.message || 'Failed to solve ticket' });
    } finally {
      setActing(false);
    }
  };

  return (
    <ScreenShell
      title="View Tickets"
      subtitle="Tickets raised by employees of every designation."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <View style={styles.tabs}>
        {VIEWS.map((v) => {
          const active = v.view === view;
          return (
            <TouchableOpacity key={v.view} style={[styles.tab, active && styles.tabActive]} onPress={() => setView(v.view)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{v.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {message ? <MessageBanner type={message.type} message={message.text} onDismiss={() => setMessage(null)} /> : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>No {current.label.toLowerCase()}</Text>
      ) : (
        items.map((item) => {
          const solved = item.status === 'Resolved';
          return (
            <View key={item._id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.raiser}>{personName(item.raisedBy)}</Text>
                  <Text style={styles.designation}>{personDesignation(item.raisedBy)}</Text>
                </View>
                <View style={[styles.badge, solved ? styles.badgeSolved : styles.badgePending]}>
                  <Text style={[styles.badgeText, { color: solved ? colors.success : colors.warning }]}>
                    {ticketStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.subject}>{item.subject}</Text>
              <Text style={styles.desc}>{item.description}</Text>
              {item.resolutionNote ? <Text style={styles.note}>Note: {item.resolutionNote}</Text> : null}
              <Text style={styles.meta}>
                {item.schoolName || '—'}
                {item.schoolCode ? ` (${item.schoolCode})` : ''} · Raised {fmtTicketDate(item.createdAt)}
              </Text>
              {item.status === 'Open' ? (
                <View style={{ marginTop: 8 }}>
                  <WebButton
                    title="Mark solved"
                    disabled={acting}
                    onPress={() => {
                      setResolveId(item._id);
                      setResolutionNote('');
                    }}
                  />
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Modal visible={Boolean(resolveId)} transparent animationType="fade" onRequestClose={() => setResolveId(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mark ticket solved</Text>
            <WebLabel>Note</WebLabel>
            <WebInput
              value={resolutionNote}
              onChangeText={setResolutionNote}
              placeholder="Optional note for the person who raised the ticket"
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />
            <View style={styles.modalBtns}>
              <View style={{ flex: 1 }}>
                <WebButton title="Cancel" variant="outline" onPress={() => setResolveId(null)} />
              </View>
              <View style={{ flex: 1 }}>
                {acting ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <WebButton title="Mark solved" onPress={confirmResolve} disabled={acting} />
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundLight },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  tabTextActive: { color: colors.primaryForeground },
  empty: { textAlign: 'center', color: colors.textSecondary, paddingVertical: 24 },
  card: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  raiser: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  designation: { fontSize: 12, color: colors.textTertiary },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeSolved: { backgroundColor: colors.successLight },
  badgePending: { backgroundColor: colors.warningLight },
  badgeText: { fontSize: 12, fontWeight: '600' },
  subject: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  desc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  note: { fontSize: 12, color: colors.textTertiary, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textTertiary, marginTop: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: colors.backgroundLight, borderRadius: 14, padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
