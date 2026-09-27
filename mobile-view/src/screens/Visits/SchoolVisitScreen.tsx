import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { getCurrentLocation } from '../../services/location';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebButton, WebSelect, WebLabel } from '../../ui/WebPrimitives';
import MessageBanner from '../../components/MessageBanner';

type Visit = {
  _id: string;
  schoolName?: string;
  schoolCode?: string;
  category?: string;
  outcome?: string;
  remarks?: string;
  visitDate?: string;
  nextVisitDate?: string;
  trainingDate?: string;
  latitude?: number;
  longitude?: number;
  operations?: {
    deliveryStatus?: string;
    booksDistributed?: string;
    programsStarted?: string;
    programsStartedDate?: string;
    pagesCompleted?: { program: string; pages: number }[];
  };
};

type PageRow = { program: string; pages: string };

type ClientProgram = {
  id: string;
  schoolName: string;
  dcOrderId?: string;
  programs: string[];
};

const OPERATIONS = 'OPERATIONS';

function clientsFromMyDcs(rows: any[]): ClientProgram[] {
  const bySchool = new Map<string, ClientProgram>();
  for (const dc of Array.isArray(rows) ? rows : []) {
    const order = dc?.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null;
    const schoolName = String(order?.school_name || dc?.customerName || dc?.school_name || '').trim();
    if (!schoolName) continue;
    const names = new Set<string>();
    for (const row of dc?.productDetails || []) {
      const name = String(row?.product || row?.product_name || '').trim();
      if (name) names.add(name);
    }
    for (const row of order?.products || []) {
      const name = String(row?.product_name || row?.product || '').trim();
      if (name) names.add(name);
    }
    const key = schoolName.toLowerCase();
    const existing = bySchool.get(key);
    if (existing) {
      existing.programs = [...new Set([...existing.programs, ...names])];
      if (!existing.dcOrderId && order?._id) existing.dcOrderId = String(order._id);
      continue;
    }
    bySchool.set(key, {
      id: String(order?._id || dc?._id || schoolName),
      schoolName,
      dcOrderId: order?._id ? String(order._id) : undefined,
      programs: [...names],
    });
  }
  return [...bySchool.values()].sort((a, b) => a.schoolName.localeCompare(b.schoolName));
}

const emptyForm = {
  schoolName: '',
  category: '',
  remarks: '',
  nextVisitDate: '',
  trainingDate: '',
  outcome: '',
  clientId: '',
  dcOrderId: '',
  booksDistributed: '',
  programsStarted: '',
  programsStartedDate: '',
  pagesCompleted: [] as PageRow[],
};

export default function SchoolVisitScreen({ navigation, route }: any) {
  const leadId: string | undefined = route?.params?.leadId;
  const schoolNameHint: string | undefined = route?.params?.schoolName;

  const [visits, setVisits] = useState<Visit[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    schoolName: schoolNameHint || '',
  });
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [clients, setClients] = useState<ClientProgram[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const loadVisits = useCallback(async () => {
    try {
      const data = await apiService.get('/visits/my');
      setVisits(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setVisits([]);
      setErrorMessage(err?.message || 'Failed to load visits');
    }
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const data = await apiService.get('/visits/categories');
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
      setOutcomes(Array.isArray(data?.outcomes) ? data.outcomes : []);
    } catch {
      setCategories([]);
      setOutcomes([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    clearMessages();
    await Promise.all([loadVisits(), loadMeta()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadVisits, loadMeta]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (form.category !== OPERATIONS || clientsLoaded) return;
    apiService
      .get('/dc/employee/my?limit=500')
      .then((data) => {
        setClients(clientsFromMyDcs(Array.isArray(data) ? data : []));
        setClientsLoaded(true);
      })
      .catch(() => setClientsLoaded(true));
  }, [form.category, clientsLoaded]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  const captureGps = async () => {
    setCapturingGps(true);
    clearMessages();
    try {
      const loc = await getCurrentLocation();
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Location permission denied or unavailable');
    } finally {
      setCapturingGps(false);
    }
  };

  const handleSubmit = async () => {
    clearMessages();
    if (!form.schoolName?.trim()) {
      setErrorMessage('School name is required');
      return;
    }
    if (!form.category?.trim()) {
      setErrorMessage('Visit category is required');
      return;
    }
    if (form.category === OPERATIONS) {
      if (form.booksDistributed !== 'Yes' && form.booksDistributed !== 'No') {
        setErrorMessage('Books distributed to students must be Yes or No');
        return;
      }
      if (form.programsStarted !== 'Yes' && form.programsStarted !== 'No') {
        setErrorMessage('Programs started must be Yes or No');
        return;
      }
      if (form.programsStarted === 'Yes' && !form.programsStartedDate.trim()) {
        setErrorMessage('Enter the date programs started');
        return;
      }
      const filled = form.pagesCompleted.filter((row) => row.program.trim() || row.pages.trim());
      if (filled.length === 0) {
        setErrorMessage('Enter pages completed for at least one program');
        return;
      }
      for (const row of filled) {
        if (!row.program.trim()) {
          setErrorMessage('Each pages row needs a program name');
          return;
        }
        if (!/^\d+$/.test(row.pages.trim())) {
          setErrorMessage(`Pages completed for ${row.program.trim()} must be a whole number`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      let lat = coords?.latitude;
      let lng = coords?.longitude;
      if (lat == null || lng == null) {
        try {
          const loc = await getCurrentLocation();
          lat = loc.latitude;
          lng = loc.longitude;
          setCoords({ latitude: lat, longitude: lng });
        } catch {
          // GPS optional if denied — still allow create with school name
        }
      }

      const payload: Record<string, unknown> = {
        schoolName: form.schoolName.trim(),
        category: form.category,
        remarks: form.remarks?.trim() || '',
      };
      if (form.outcome) payload.outcome = form.outcome;
      if (form.nextVisitDate.trim()) payload.nextVisitDate = form.nextVisitDate.trim();
      if (form.trainingDate.trim()) payload.trainingDate = form.trainingDate.trim();
      if (leadId) payload.leadId = leadId;
      if (form.dcOrderId) payload.dcOrderId = form.dcOrderId;
      if (form.category === OPERATIONS) {
        payload.operations = {
          deliveryStatus: 'DELIVERED',
          booksDistributed: form.booksDistributed,
          programsStarted: form.programsStarted,
          programsStartedDate: form.programsStarted === 'Yes' ? form.programsStartedDate.trim() : undefined,
          pagesCompleted: form.pagesCompleted
            .filter((row) => row.program.trim())
            .map((row) => ({ program: row.program.trim(), pages: Number(row.pages) })),
        };
      }
      if (typeof lat === 'number' && typeof lng === 'number') {
        payload.latitude = lat;
        payload.longitude = lng;
      }

      await apiService.post('/visits', payload);
      setSuccessMessage('Visit recorded successfully.');
      setForm({ ...emptyForm });
      setCoords(null);
      setShowForm(false);
      await loadVisits();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create visit');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString('en-IN');
    } catch {
      return '—';
    }
  };

  return (
    <ScreenShell
      noScroll
      title="School Visits"
      subtitle={leadId ? 'Linked to lead' : 'Log field visits with GPS'}
      loading={loading && !refreshing}
      headerRight={
        <TouchableOpacity onPress={() => { clearMessages(); setShowForm((v) => !v); }}>
          <Text style={styles.headerLink}>{showForm ? 'List' : '+ New'}</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {successMessage ? (
          <MessageBanner type="success" message={successMessage} onDismiss={clearMessages} />
        ) : null}
        {errorMessage ? (
          <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
        ) : null}

        {showForm ? (
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>New visit</Text>

            <WebInput
              style={styles.input}
              value={form.schoolName}
              onChangeText={(t) => setForm((f) => ({ ...f, schoolName: t }))}
              placeholder="School name *"
            />

            <WebSelect
              label="Category *"
              value={form.category}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  category: v,
                  pagesCompleted:
                    v === OPERATIONS && f.pagesCompleted.length === 0
                      ? [{ program: '', pages: '' }]
                      : f.pagesCompleted,
                }))
              }
              items={categories.map((c) => ({ label: c, value: c }))}
              placeholder="Select category"
            />

            {form.category === OPERATIONS ? (
              <View style={styles.opsBox}>
                <Text style={styles.sectionTitle}>Operations</Text>
                <WebSelect
                  label="Client"
                  value={form.clientId}
                  onValueChange={(clientId) => {
                    const client = clients.find((c) => c.id === clientId);
                    setForm((f) => {
                      if (!client) {
                        return { ...f, clientId: '', dcOrderId: '' };
                      }
                      const previous = new Map(f.pagesCompleted.map((row) => [row.program, row.pages]));
                      return {
                        ...f,
                        clientId: client.id,
                        dcOrderId: client.dcOrderId || '',
                        schoolName: client.schoolName,
                        pagesCompleted:
                          client.programs.length > 0
                            ? client.programs.map((program) => ({
                                program,
                                pages: previous.get(program) || '',
                              }))
                            : [{ program: '', pages: '' }],
                      };
                    });
                  }}
                  items={clients.map((c) => ({ label: c.schoolName, value: c.id }))}
                  placeholder="Select a client to load programs"
                />
                <WebLabel>Delivery status</WebLabel>
                <Text style={styles.opsLocked}>DELIVERED</Text>
                <WebSelect
                  label="Books distributed to students *"
                  value={form.booksDistributed}
                  onValueChange={(v) => setForm((f) => ({ ...f, booksDistributed: v }))}
                  items={[
                    { label: 'Yes', value: 'Yes' },
                    { label: 'No', value: 'No' },
                  ]}
                  placeholder="Yes or No"
                />
                <WebSelect
                  label="Programs started *"
                  value={form.programsStarted}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      programsStarted: v,
                      programsStartedDate: v === 'Yes' ? f.programsStartedDate : '',
                    }))
                  }
                  items={[
                    { label: 'Yes', value: 'Yes' },
                    { label: 'No', value: 'No' },
                  ]}
                  placeholder="Yes or No"
                />
                {form.programsStarted === 'Yes' ? (
                  <WebInput
                    style={styles.input}
                    value={form.programsStartedDate}
                    onChangeText={(t) => setForm((f) => ({ ...f, programsStartedDate: t }))}
                    placeholder="Programs started date (YYYY-MM-DD) *"
                  />
                ) : null}
                <WebLabel>Pages completed (program wise) *</WebLabel>
                {form.pagesCompleted.map((row, idx) => (
                  <View key={idx} style={styles.pageRow}>
                    <WebInput
                      style={[styles.input, styles.pageProgram]}
                      value={row.program}
                      onChangeText={(t) =>
                        setForm((f) => {
                          const pagesCompleted = [...f.pagesCompleted];
                          pagesCompleted[idx] = { ...pagesCompleted[idx], program: t };
                          return { ...f, pagesCompleted };
                        })
                      }
                      placeholder="Program"
                    />
                    <WebInput
                      style={[styles.input, styles.pageCount]}
                      value={row.pages}
                      keyboardType="number-pad"
                      onChangeText={(t) =>
                        setForm((f) => {
                          const pagesCompleted = [...f.pagesCompleted];
                          pagesCompleted[idx] = {
                            ...pagesCompleted[idx],
                            pages: t.replace(/\D/g, ''),
                          };
                          return { ...f, pagesCompleted };
                        })
                      }
                      placeholder="Pages"
                    />
                  </View>
                ))}
                <WebButton
                  title="Add program"
                  variant="outline"
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      pagesCompleted: [...f.pagesCompleted, { program: '', pages: '' }],
                    }))
                  }
                />
              </View>
            ) : null}

            <WebSelect
              label="Outcome"
              value={form.outcome}
              onValueChange={(v) => setForm((f) => ({ ...f, outcome: v }))}
              items={[
                { label: '— None —', value: '' },
                ...outcomes.map((o) => ({ label: o, value: o })),
              ]}
              placeholder="Select outcome"
            />

            <WebInput
              style={[styles.input, styles.textArea]}
              value={form.remarks}
              onChangeText={(t) => setForm((f) => ({ ...f, remarks: t }))}
              placeholder="Remarks"
              multiline
              numberOfLines={3}
            />

            <WebInput
              style={styles.input}
              value={form.nextVisitDate}
              onChangeText={(t) => setForm((f) => ({ ...f, nextVisitDate: t }))}
              placeholder="Next visit date (YYYY-MM-DD)"
            />

            <WebInput
              style={styles.input}
              value={form.trainingDate}
              onChangeText={(t) => setForm((f) => ({ ...f, trainingDate: t }))}
              placeholder="Training date (YYYY-MM-DD)"
            />

            <View style={styles.gpsRow}>
              <TouchableOpacity
                style={styles.gpsBtn}
                onPress={captureGps}
                disabled={capturingGps}
              >
                {capturingGps ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.gpsBtnText}>
                    {coords ? 'Refresh GPS' : 'Capture GPS'}
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={styles.gpsMeta}>
                {coords
                  ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                  : 'Location not captured yet'}
              </Text>
            </View>

            <WebButton
              title={submitting ? 'Saving…' : 'Save visit'}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
            />
            <WebButton
              title="Cancel"
              onPress={() => setShowForm(false)}
              variant="outline"
            />
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>My visits ({visits.length})</Text>
            {visits.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No visits yet. Tap + New to log one.</Text>
              </View>
            ) : (
              visits.map((v) => (
                <View key={v._id} style={styles.card}>
                  <Text style={styles.cardTitle}>{v.schoolName || '—'}</Text>
                  <Text style={styles.cardMeta}>
                    {v.category || '—'}
                    {v.outcome ? ` · ${v.outcome}` : ''}
                  </Text>
                  <Text style={styles.cardMeta}>Visited {formatDate(v.visitDate)}</Text>
                  {v.nextVisitDate ? (
                    <Text style={styles.cardMeta}>Next: {formatDate(v.nextVisitDate)}</Text>
                  ) : null}
                  {v.category === OPERATIONS && v.operations ? (
                    <Text style={styles.remarks} numberOfLines={3}>
                      {v.operations.deliveryStatus || 'DELIVERED'}
                      {v.operations.booksDistributed ? ` · Books: ${v.operations.booksDistributed}` : ''}
                      {v.operations.programsStarted ? ` · Started: ${v.operations.programsStarted}` : ''}
                      {(v.operations.pagesCompleted || []).length
                        ? ` · ${(v.operations.pagesCompleted || []).map((row) => `${row.program}: ${row.pages}`).join(', ')}`
                        : ''}
                    </Text>
                  ) : null}
                  {v.remarks ? <Text style={styles.remarks} numberOfLines={2}>{v.remarks}</Text> : null}
                  {typeof v.latitude === 'number' && typeof v.longitude === 'number' ? (
                    <Text style={styles.gpsTag}>GPS ✓</Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  headerLink: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  formCard: {
    gap: 4,
  },
  input: {
    marginBottom: 10,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  gpsRow: {
    marginVertical: 12,
    gap: 8,
  },
  gpsBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.accent,
    minWidth: 120,
    alignItems: 'center',
  },
  gpsBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  gpsMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  opsBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.backgroundLight,
  },
  opsLocked: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  pageRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pageProgram: {
    flex: 1,
  },
  pageCount: {
    width: 90,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  remarks: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 6,
  },
  gpsTag: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
});
