import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { navigateRoot } from '../navigation/navigationRef';
import { colors } from '../theme/colors';
import { Badge, toneFor, InfoRow } from '../ui/Kit';
import { WebButton } from '../ui/WebPrimitives';
import SchoolOverview, { type Overview } from './SchoolOverview';
import SchoolVisitActions, { type FieldDayState, sameSchool } from './SchoolVisitActions';
import SchoolVisitForm, { VisitHistory, type VisitRecord } from './SchoolVisitForm';
import SchoolTicket from './SchoolTicket';

type IonName = React.ComponentProps<typeof Ionicons>['name'];
type TileKey = 'info' | 'dc' | 'raise' | 'request' | 'returns' | 'payments' | 'visits' | 'renewal' | 'training' | 'ticket';

const TILES: { key: TileKey; label: string; icon: IonName; color: string }[] = [
  { key: 'info', label: 'View Info', icon: 'information-circle-outline', color: '#2563EB' },
  { key: 'dc', label: 'DC Info', icon: 'document-text-outline', color: '#0891B2' },
  { key: 'raise', label: 'Raise DC', icon: 'add-circle-outline', color: '#7C3AED' },
  { key: 'request', label: 'Request DC', icon: 'paper-plane-outline', color: '#4F46E5' },
  { key: 'returns', label: 'Returns', icon: 'return-down-back-outline', color: '#EA580C' },
  { key: 'payments', label: 'Payments', icon: 'card-outline', color: '#16A34A' },
  { key: 'visits', label: 'Visits', icon: 'location-outline', color: '#DC2626' },
  { key: 'renewal', label: 'Renewal / Cross-Sale', icon: 'repeat-outline', color: '#D97706' },
  { key: 'training', label: 'Training & Service', icon: 'school-outline', color: '#0D9488' },
  { key: 'ticket', label: 'Raise Ticket', icon: 'help-buoy-outline', color: '#BE185D' },
];

const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const time = (v?: string) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');

export type SchoolHubActions = {
  editPO?: () => void;
  viewInvoice?: () => void;
  newYearPO?: () => void;
  requestDC?: { label: string; disabled?: boolean; onPress: () => void };
};

/**
 * One school's page (My Clients → school): everything about the school under nine tiles.
 * A tile shows its records right here, with buttons to add or edit — no hunting through menus.
 */
export default function SchoolHub({
  visible,
  onClose,
  id,
  orderId,
  dcId,
  schoolName,
  schoolCode,
  year,
  status,
  fieldDay,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  /** Deal / DC / lead id for the overview. */
  id: string;
  orderId?: string;
  dcId?: string;
  schoolName: string;
  schoolCode?: string;
  year?: string;
  status?: string;
  fieldDay: { day: FieldDayState; reload: () => Promise<void> };
  actions: SchoolHubActions;
}) {
  const [tile, setTile] = useState<TileKey>('info');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await apiService.get(`/leads/${id}/overview`));
    } catch (e: any) {
      setError(e?.message || 'Could not load the school');
    }
  }, [id]);

  useEffect(() => {
    if (!visible) return;
    setTile('info');
    setData(null);
    void load();
  }, [visible, load]);

  /** Leave the school page and open an entry screen (the page reloads when it is opened again). */
  const go = (screen: string, params?: object) => {
    onClose();
    navigateRoot(screen, params);
  };

  const code = schoolCode && schoolCode !== '-' ? schoolCode : undefined;
  const leadId = data?.lead?._id ? String(data.lead._id) : undefined;

  const section = () => {
    if (error) return <Text style={styles.error}>{error}</Text>;
    if (!data) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />;
    switch (tile) {
      case 'info':
        return (
          <>
            <SchoolOverview leadId={id} data={data} only="details" />
            <Buttons>
              {orderId ? <WebButton title="Edit school info / PO" variant="outline" onPress={() => go('ClientEditPO', { orderId, dcId })} /> : null}
            </Buttons>
          </>
        );
      case 'dc':
        return (
          <>
            <SchoolOverview leadId={id} data={data} only="dcs" />
            <SchoolOverview leadId={id} data={data} only="deals" />
            <Buttons>
              {actions.editPO ? <WebButton title="Edit PO" variant="outline" onPress={() => { onClose(); actions.editPO?.(); }} /> : null}
              {actions.viewInvoice ? <WebButton title="View Invoice" variant="outline" onPress={() => { onClose(); actions.viewInvoice?.(); }} /> : null}
            </Buttons>
          </>
        );
      case 'raise':
        return (
          <>
            <Text style={styles.help}>Create the Delivery Challan for this school's PO, or update one already raised.</Text>
            <SchoolOverview leadId={id} data={data} only="dcs" />
            <Buttons>
              {orderId ? <WebButton title="Raise DC" onPress={() => go('DCCreate', { dealId: orderId })} /> : null}
              {orderId ? <WebButton title="Update DC" variant="outline" onPress={() => go('DCCreate', { dealId: orderId, mode: 'update' })} /> : null}
            </Buttons>
          </>
        );
      case 'request':
        return (
          <>
            <Text style={styles.help}>Send this school's PO for a DC. You can follow its status under DC Info.</Text>
            <InfoRow label="Status" value={status} />
            <Buttons>
              {actions.requestDC ? (
                <WebButton
                  title={actions.requestDC.label}
                  disabled={actions.requestDC.disabled}
                  onPress={() => { onClose(); actions.requestDC?.onPress(); }}
                />
              ) : (
                <Text style={styles.help}>A DC has already been requested for this PO.</Text>
              )}
            </Buttons>
          </>
        );
      case 'returns':
        return (
          <>
            <Text style={styles.sectionTitle}>Returns ({data.returns.length})</Text>
            {data.returns.length === 0 ? <Text style={styles.muted}>None yet</Text> : null}
            {data.returns.map((r) => (
              <TouchableOpacity key={r._id} style={styles.line} onPress={() => go('StockReturnAdd', { returnId: r._id })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineMain}>Return #{r.returnNumber || '—'}</Text>
                  <Text style={styles.muted}>{date(r.createdAt)}</Text>
                </View>
                <Badge label={r.status || '—'} />
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
            <Buttons>
              <WebButton title="+ New Return" onPress={() => go('StockReturnAdd', { schoolCode: code, orderId })} />
            </Buttons>
          </>
        );
      case 'payments':
        return (
          <>
            <SchoolOverview leadId={id} data={data} only="payments" />
            <Buttons>
              <WebButton title="+ Add Payment" onPress={() => go('PaymentAdd', { schoolCode: code })} />
              <WebButton title="All payments" variant="outline" onPress={() => go('PaymentList')} />
            </Buttons>
          </>
        );
      case 'visits': {
        const history = (data.checkIns || []) as VisitRecord[];
        const open = fieldDay.day?.openVisit;
        const openHere = open && sameSchool(open, { schoolName, schoolCode: code, leadId }) ? open : null;
        const refresh = async () => {
          await fieldDay.reload();
          await load();
        };
        return (
          <>
            {openHere ? (
              <View style={styles.inside}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.insideText}>
                  Checked in{(() => { const v = history.find((h) => h._id === openHere._id); return v?.entryAt ? ` at ${time(v.entryAt)}` : ''; })()}. Fill the visit details and submit.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.muted}>Step 1: Check in at the school. The visit form opens after check-in.</Text>
                <View style={{ height: 8 }} />
                <SchoolVisitActions day={fieldDay.day} reload={refresh} school={{ schoolName, schoolCode: code, leadId }} />
              </>
            )}
            {openHere ? <SchoolVisitForm visitId={openHere._id} schoolName={schoolName} history={history} onDone={refresh} /> : null}
            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Visit history ({history.length})</Text>
            <VisitHistory history={history} />
            {data.visits?.length ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Earlier visit notes</Text>
                <SchoolOverview leadId={id} data={data} only="visits" />
              </>
            ) : null}
          </>
        );
      }
      case 'renewal':
        return (
          <>
            <Text style={styles.sectionTitle}>Products by year</Text>
            {data.orders.length === 0 ? <Text style={styles.muted}>None yet</Text> : null}
            {data.orders.map((o) => (
              <View key={o._id} style={styles.yearCard}>
                <Text style={styles.lineMain}>{o.year || date(o.createdAt)} · {o.dc_code || 'PO'}</Text>
                {(o.products || []).map((p: any, i: number) => (
                  <View key={`${p.product_name}-${i}`} style={styles.productRow}>
                    <Text style={styles.productName}>{p.product_name}</Text>
                    <Badge
                      label={p.sale_type === 'renewal' ? 'Renewed' : p.sale_type === 'cross_sale' ? 'Cross sale' : 'New'}
                      tone={p.sale_type === 'renewal' ? 'success' : p.sale_type === 'cross_sale' ? 'info' : 'neutral'}
                    />
                  </View>
                ))}
                {(o.not_renewed_products || []).map((name: string) => (
                  <View key={`nr-${name}`} style={styles.productRow}>
                    <Text style={styles.productName}>{name}</Text>
                    <Badge label="Not renewed" tone="error" />
                  </View>
                ))}
              </View>
            ))}
            <Buttons>
              {actions.newYearPO ? <WebButton title="+ New Year PO (renewal)" onPress={() => { onClose(); actions.newYearPO?.(); }} /> : null}
              {orderId ? <WebButton title="Add cross-sale product / Edit PO" variant="outline" onPress={() => go('ClientEditPO', { orderId, dcId })} /> : null}
            </Buttons>
          </>
        );
      case 'training':
        return (
          <>
            <SchoolOverview leadId={id} data={data} only="trainings" />
            <Buttons>
              <WebButton title="+ Request Training / Service" onPress={() => go('TrainingRequest', { schoolCode: code })} />
            </Buttons>
          </>
        );
      case 'ticket': {
        const l: any = data.lead || {};
        return <SchoolTicket schoolCode={code || l.school_code} schoolName={l.school_name || schoolName} town={l.location || l.town || l.area} />;
      }
      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {schoolName}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {[code, year].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {status ? <Badge label={status} tone={toneFor(status)} /> : null}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.grid}>
            {TILES.map((t) => {
              const on = tile === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tile, on && { borderColor: t.color, backgroundColor: t.color + '12' }]}
                  onPress={() => setTile(t.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={t.icon} size={24} color={t.color} />
                  <Text style={[styles.tileLabel, on && { color: t.color }]} numberOfLines={2}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{TILES.find((t) => t.key === tile)?.label}</Text>
            {section()}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Buttons({ children }: { children: React.ReactNode }) {
  return <View style={styles.buttons}>{children}</View>;
}

const styles = StyleSheet.create({
  inside: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, marginBottom: 12 },
  insideText: { flex: 1, fontSize: 13, color: '#065F46', fontWeight: '600' },
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 8,
    paddingRight: 16,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '31.5%',
    minHeight: 86,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 10,
  },
  tileLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginTop: 6 },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
    marginTop: 4,
  },
  panelTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  help: { fontSize: 13, color: colors.textTertiary, marginBottom: 8 },
  muted: { fontSize: 12, color: colors.textSecondary },
  error: { color: colors.error, marginVertical: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  lineMain: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  yearCard: { borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 10, padding: 10, marginTop: 8 },
  productRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  productName: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  buttons: { marginTop: 12, gap: 4 },
});
