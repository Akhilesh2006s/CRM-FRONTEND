import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiService } from '../services/api';
import { colors } from '../theme/colors';

export type Overview = {
  lead: Record<string, any>;
  orders: any[];
  dcs: any[];
  payments: any[];
  visits: any[];
  returns: any[];
  trainings: any[];
  services: any[];
  checkIns?: any[];
};

const date = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const money = (n?: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** All of one school's information, shown inside the school's card in My Schools. */
export type OverviewSection = 'details' | 'deals' | 'dcs' | 'payments' | 'returns' | 'trainings' | 'visits';

export default function SchoolOverview({
  leadId,
  onEdit,
  only,
  data: given,
}: {
  leadId: string;
  onEdit?: () => void;
  only?: OverviewSection;
  /** Already-loaded overview (School page); skips the fetch. */
  data?: Overview | null;
}) {
  const show = (key: OverviewSection) => !only || only === key;
  const [loaded, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const data = given || loaded;

  useEffect(() => {
    if (given) return undefined;
    let alive = true;
    apiService
      .get(`/leads/${leadId}/overview`)
      .then((res) => alive && setData(res))
      .catch((e: any) => alive && setError(e?.message || 'Could not load the school'));
    return () => {
      alive = false;
    };
  }, [leadId, given]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!data) return <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />;

  const l = data.lead;
  const details: [string, any][] = [
    ['School code', l.school_code],
    ['School type', l.school_type],
    ['Contact person', l.contact_person],
    ['Contact mobile', l.contact_mobile],
    ['Contact person 2', l.contact_person2],
    ['Contact mobile 2', l.contact_mobile2],
    ['Email', l.email],
    ['Address', l.address],
    ['Location / Town', l.location || l.town],
    ['Pincode', l.pincode],
    ['Zone', l.zone],
    ['Cluster', l.cluster],
    ['Strength', l.strength],
    ['Branches', l.branches],
    ['Average fee', l.average_fee],
    ['Status', l.status],
    ['Priority', l.priority],
    ['Follow-up', l.follow_up_date ? date(l.follow_up_date) : ''],
    ['Created by', l.createdBy?.name],
    ['Managed by', l.managed_by?.name],
    ['Remarks', l.remarks],
  ];

  return (
    <View style={styles.wrap}>
      {show('details') ? (
      <Section title="School details">
        {details
          .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
          .map(([k, v]) => {
            const phone = /mobile/i.test(k);
            return (
              <View key={k} style={styles.row}>
                <Text style={styles.key}>{k}</Text>
                {phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${v}`)} style={{ flex: 1 }}>
                    <Text style={[styles.value, styles.link]}>{String(v)}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.value}>{String(v)}</Text>
                )}
              </View>
            );
          })}
        {onEdit ? (
          <TouchableOpacity onPress={onEdit}>
            <Text style={styles.action}>Edit / Follow up ›</Text>
          </TouchableOpacity>
        ) : null}
      </Section>
      ) : null}

      {show('deals') ? (
      <Section title={`Deals / POs (${data.orders.length})`}>
        {data.orders.map((o) => (
          <Line
            key={o._id}
            main={`${o.dc_code || 'Deal'} · ${o.status || ''}`}
            sub={[(o.products || []).map((p: any) => p.product_name).filter(Boolean).join(', '), date(o.createdAt)].filter(Boolean).join(' · ')}
          />
        ))}
      </Section>
      ) : null}

      {show('dcs') ? (
      <Section title={`DCs / Material & Kits (${data.dcs.length})`}>
        {data.dcs.map((d) => (
          <Line key={d._id} main={`${d.dc_code || 'DC'} · ${d.status || ''}`} sub={date(d.createdAt)} />
        ))}
      </Section>
      ) : null}

      {show('payments') ? (
      <Section title={`Payments (${data.payments.length})`}>
        {data.payments.map((p) => (
          <Line key={p._id} main={`${money(p.amount)} · ${p.status || ''}`} sub={[p.paymentMethod, date(p.paymentDate || p.createdAt)].filter(Boolean).join(' · ')} />
        ))}
      </Section>
      ) : null}

      {show('visits') ? (
      <Section title={`Visits (${data.visits.length})`}>
        {data.visits.map((v) => (
          <Line
            key={v._id}
            main={`${date(v.visitDate)} · ${v.category || 'Visit'}${v.outcome ? ` · ${v.outcome}` : ''}`}
            sub={[v.executiveId?.name, v.remarks].filter(Boolean).join(' · ')}
          />
        ))}
      </Section>
      ) : null}

      {show('returns') ? (
      <Section title={`Returns (${data.returns.length})`}>
        {data.returns.map((r) => (
          <Line key={r._id} main={`Return #${r.returnNumber} · ${r.status || ''}`} sub={date(r.createdAt)} />
        ))}
      </Section>
      ) : null}

      {show('trainings') ? (
      <Section title={`Trainings & Services (${data.trainings.length + data.services.length})`}>
        {data.trainings.map((t) => (
          <Line key={t._id} main={`Training · ${t.subject} · ${t.status}`} sub={[t.term, date(t.trainingDate)].filter(Boolean).join(' · ')} />
        ))}
        {data.services.map((s) => (
          <Line key={s._id} main={`Service · ${s.subject} · ${s.status}`} sub={[s.term, date(s.serviceDate)].filter(Boolean).join(' · ')} />
        ))}
      </Section>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const empty = React.Children.toArray(children).length === 0;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {empty ? <Text style={styles.muted}>None yet</Text> : children}
    </View>
  );
}

function Line({ main, sub }: { main: string; sub?: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineMain}>{main}</Text>
      {sub ? <Text style={styles.muted}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, gap: 12 },
  section: { gap: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginBottom: 2 },
  row: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  key: { width: 120, fontSize: 13, color: colors.textSecondary },
  value: { flex: 1, fontSize: 13, color: colors.textPrimary },
  link: { color: '#2563EB' },
  action: { color: colors.primary, fontWeight: '700', marginTop: 6 },
  line: { paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  lineMain: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  muted: { fontSize: 12, color: colors.textSecondary },
  error: { color: colors.error, marginTop: 8 },
});
