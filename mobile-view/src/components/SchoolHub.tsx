import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
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
type TileKey =
  | 'info' | 'dc' | 'raise' | 'returns' | 'payments' | 'visits' | 'renewal' | 'training' | 'ticket'
  | 'editpo' | 'addproduct' | 'target' | 'subdc';
type Tile = { key: TileKey; label: string; icon: IonName; color: string };

/** My Orders (PO uploaded, DC not completed yet). */
const ORDER_TILES: Tile[] = [
  { key: 'info', label: 'Full Info of School', icon: 'information-circle-outline', color: '#2563EB' },
  { key: 'editpo', label: 'Edit PO / PO Upload', icon: 'create-outline', color: '#0891B2' },
  { key: 'addproduct', label: 'Add Product', icon: 'add-circle-outline', color: '#16A34A' },
  { key: 'raise', label: 'Request DC & Raise DC', icon: 'paper-plane-outline', color: '#7C3AED' },
];

/** My Clients (DC completed at the warehouse). */
const CLIENT_TILES: Tile[] = [
  { key: 'dc', label: 'DC Info', icon: 'document-text-outline', color: '#0891B2' },
  { key: 'returns', label: 'Return', icon: 'return-down-back-outline', color: '#EA580C' },
  { key: 'info', label: 'View Info', icon: 'information-circle-outline', color: '#2563EB' },
  { key: 'payments', label: 'Payments', icon: 'card-outline', color: '#16A34A' },
  { key: 'visits', label: 'Visits', icon: 'location-outline', color: '#DC2626' },
  { key: 'training', label: 'Training & Service', icon: 'school-outline', color: '#0D9488' },
  { key: 'ticket', label: 'Raise Ticket', icon: 'help-buoy-outline', color: '#BE185D' },
  { key: 'target', label: 'Payment Target Month Wise', icon: 'calendar-outline', color: '#4F46E5' },
  { key: 'subdc', label: 'Sub DC', icon: 'git-branch-outline', color: '#7C3AED' },
  { key: 'renewal', label: 'Renewal / Cross-Sale', icon: 'repeat-outline', color: '#D97706' },
];

/** Where a My Orders DC is, in the BDE's words (from the server's workflow stage). */
export const ORDER_STEPS = ['DC Pending', 'DC at Coordinator', 'DC at Senior Coordinator', 'DC at Warehouse', 'DC Completed'];
export function orderStepOf(stage?: string): number {
  switch (stage) {
    case 'dc_review':
      return 1;
    case 'dc_approval':
      return 2;
    case 'warehouse_receipt':
    case 'warehouse_processing':
    case 'dispatch_approval':
      return 3;
    case 'delivery_confirmation':
    case 'billing':
    case 'claim':
      return 4;
    default:
      return 0;
  }
}

const money = (n?: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

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
const yearOf = (start: number) => `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
const currentYearStart = () => {
  const d = new Date(Date.now() + 330 * 60000);
  return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
};

/** Move this school's deal to another academic year (e.g. back to the previous year). */
function AcademicYearChange({ orderId, year, onChanged }: { orderId: string; year?: string; onChanged: (year: string) => void }) {
  const [busy, setBusy] = useState(false);
  const now = currentYearStart();
  const options = [now - 2, now - 1, now, now + 1].map(yearOf).filter((y) => y !== year);
  const move = (to: string) =>
    Alert.alert('Change academic year', `Move this school from ${year || 'its current year'} to ${to}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move',
        onPress: async () => {
          setBusy(true);
          try {
            await apiService.put(`/dc-orders/${orderId}/academic-year`, { academicYear: to });
            Alert.alert('Academic year changed', `This school is now under ${to}.`);
            onChanged(to);
          } catch (e: any) {
            Alert.alert('Could not change the year', e?.response?.data?.message || e?.message || 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.sectionTitle}>Academic year</Text>
      <Text style={styles.help}>Currently {year || '—'}. Move the school to another academic year:</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((y) => (
          <WebButton key={y} title={y} variant="outline" disabled={busy} onPress={() => move(y)} />
        ))}
      </View>
    </View>
  );
}

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
  nextStep,
  mode = 'client',
  stage,
  fieldDay,
  actions,
  onYearChanged,
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
  /** DC workflow, as on the web Client DC page: who acts next and what to do. */
  nextStep?: string;
  /** order = My Orders (PO uploaded, DC on its way); client = My Clients (DC completed). */
  mode?: 'order' | 'client';
  /** Server workflow stage of the DC (for the My Orders tracker). */
  stage?: string;
  fieldDay: { day: FieldDayState; reload: () => Promise<void> };
  actions: SchoolHubActions;
  /** Called after the school is moved to another academic year (reload the list). */
  onYearChanged?: (year: string) => void;
}) {
  const TILES = mode === 'order' ? ORDER_TILES : CLIENT_TILES;
  const [tile, setTile] = useState<TileKey>(TILES[0].key);
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
    setTile(TILES[0].key);
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
            {orderId ? <AcademicYearChange orderId={orderId} year={year} onChanged={(y) => { onClose(); onYearChanged?.(y); }} /> : null}
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
      case 'editpo':
        return (
          <>
            <Text style={styles.help}>Update the PO details or upload the PO document again.</Text>
            <Buttons>
              {actions.editPO ? <WebButton title="Edit PO / PO Upload" onPress={() => { onClose(); actions.editPO?.(); }} /> : <Text style={styles.muted}>No PO to edit yet.</Text>}
            </Buttons>
          </>
        );
      case 'addproduct':
        return (
          <>
            <Text style={styles.help}>Add products to this order. The price of products already in the PO cannot be changed at this stage.</Text>
            <Buttons>
              {orderId ? <WebButton title="Add Product" onPress={() => go('ClientEditPO', { orderId, dcId, addProduct: true })} /> : <Text style={styles.muted}>No order yet.</Text>}
            </Buttons>
          </>
        );
      case 'raise': {
        const order = data.orders[0] || {};
        const products = (order.products || []).map((p: any) => p.product_name).filter(Boolean).join(', ');
        return (
          <>
            <Text style={styles.help}>Check the products, student strength and transport, then Raise DC to send it to the internal team.</Text>
            <InfoRow label="Products" value={products || '—'} />
            <InfoRow label="Student strength" value={String(order.strength ?? data.lead?.strength ?? '—')} />
            <InfoRow label="Transport" value="Check transport details in the DC form" />
            <InfoRow label="Status" value={status} />
            <Buttons>
              {orderId ? <WebButton title="Raise DC" onPress={() => go('DCCreate', { dealId: orderId })} /> : null}
              {orderId ? <WebButton title="Update DC" variant="outline" onPress={() => go('DCCreate', { dealId: orderId, mode: 'update' })} /> : null}
              {actions.requestDC ? (
                <WebButton
                  title={actions.requestDC.label}
                  variant="outline"
                  disabled={actions.requestDC.disabled}
                  onPress={() => { onClose(); actions.requestDC?.onPress(); }}
                />
              ) : null}
            </Buttons>
          </>
        );
      }
      case 'target': {
        const order = data.orders[0] || {};
        const total = Number(order.total_amount) || 0;
        const yearStart = Number(String(order.year || year || '').slice(0, 4)) || new Date().getFullYear();
        const byMonth = new Map<string, number>();
        let received = 0;
        for (const p of data.payments) {
          if (String(p.status || '').toLowerCase() === 'rejected') continue;
          const d = new Date(p.paymentDate || p.createdAt);
          if (Number.isNaN(d.getTime())) continue;
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          byMonth.set(key, (byMonth.get(key) || 0) + (Number(p.amount) || 0));
          received += Number(p.amount) || 0;
        }
        return (
          <>
            <InfoRow label="Order value" value={money(total)} />
            <InfoRow label="Received" value={money(received)} />
            <InfoRow label="Balance" value={money(Math.max(total - received, 0))} />
            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Month wise ({yearStart}-{String(yearStart + 1).slice(2)})</Text>
            {MONTHS.map((m, i) => {
              const y = i < 9 ? yearStart : yearStart + 1;
              const month = (i + 3) % 12;
              const got = byMonth.get(`${y}-${month}`) || 0;
              return (
                <View key={m} style={styles.line}>
                  <Text style={[styles.lineMain, { flex: 1 }]}>{m} {y}</Text>
                  <Text style={[styles.lineMain, got ? { color: colors.success } : { color: colors.textMuted }]}>{money(got)}</Text>
                </View>
              );
            })}
            <Buttons>
              <WebButton title="+ Add Payment" onPress={() => go('PaymentAdd', { schoolCode: code })} />
            </Buttons>
          </>
        );
      }
      case 'subdc': {
        const subs = data.dcs.filter((d: any) => d.parentDcId || d.dcType === 'shortage');
        return (
          <>
            <Text style={styles.help}>Sub DCs are extra delivery challans for this school when a shipment is split or short.</Text>
            {subs.length === 0 ? <Text style={styles.muted}>No sub DCs.</Text> : null}
            {subs.map((d: any) => (
              <View key={d._id} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineMain}>{d.dc_code || 'Sub DC'}</Text>
                  <Text style={styles.muted}>
                    {[date(d.createdAt), d.requestedQuantity ? `Qty ${d.requestedQuantity}` : '', d.fulfillmentStatus].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Badge label={String(d.status || '—').replace(/_/g, ' ')} />
              </View>
            ))}
          </>
        );
      }
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
          {mode === 'order' ? (
            <View style={styles.tracker}>
              {ORDER_STEPS.map((s, i) => {
                const at = orderStepOf(stage);
                const done = i < at;
                const now = i === at;
                return (
                  <View key={s} style={styles.trackStep}>
                    <Ionicons
                      name={done ? 'checkmark-circle' : now ? 'radio-button-on' : 'ellipse-outline'}
                      size={18}
                      color={done ? colors.success : now ? colors.primaryDark : colors.textMuted}
                    />
                    <Text style={[styles.trackText, now && { color: colors.primaryDark, fontWeight: '700' }, done && { color: colors.success }]}>{s}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {nextStep ? (
            <View style={styles.nextStep}>
              <Ionicons name="arrow-forward-circle-outline" size={18} color={colors.primaryDark} />
              <Text style={styles.nextStepText}>{nextStep}</Text>
            </View>
          ) : null}
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
  tracker: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F7', padding: 12, marginBottom: 12, gap: 6 },
  trackStep: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackText: { fontSize: 13, color: colors.textSecondary },
  nextStep: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10, marginBottom: 12 },
  nextStepText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
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
