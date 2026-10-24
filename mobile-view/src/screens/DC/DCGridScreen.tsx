/**
 * Create DC / Main DCs (Grid DC) — the web DcGridWorkspace (components/dc/DcGridWorkspace.tsx,
 * route /dashboard/dc/grid?dc=&action=). A Main DC for a new school, or the next DC worked out from
 * an existing DC through the distribution grid (progression / renewal, delivery choice, scenario),
 * plus Sub DC adjustments (Excess / Shortage / Exchange) and Request DC with the purchase order.
 *
 * Route params: { dcId?: string; action?: 'new' | 'sub' } — same as the web ?dc=&action=.
 * Backend: /dc/grid/catalog, /dc/grid, /dc/grid/preview, /dc/:id/grid, /dc/:id/grid/request, /dc/:id/sub-dc.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, radii, spacing } from '../../theme/colors';
import { showAlert } from '../../utils/showAlert';
import { abacusStudentStrength, defaultMasterAbacusQuantity } from '../../lib/crm/abacusMaterials';

type Choice = 'term1' | 'both';
type EditType = 'Excess' | 'Shortage' | 'Exchange';
type Allocation = { id: string; program: string; class: string; books: string[]; model: string; fromClass?: string; fromBooks?: string[]; quantities?: number[] };
type Mapping = { id: string; program: string; model: string; scenario: string; fromClass: string; fromBooks: string[]; toClass: string; toBooks: string[] };
type Catalog = { mappings: Mapping[]; unmappedRows?: Allocation[]; initial: Record<Choice, Allocation[]>; books: Record<string, string[]> };
type Row = { lineId: string; product: string; productName?: string; class: string; productCategory?: string; category?: string; level?: string; quantity: number; strength?: number };
type Change = { lineId: string; before: Row; after: Row; quantityDifference: number };
type Adjustment = { reference: string; editType: EditType; createdAt: string; createdByName?: string; status: string; remarks?: string; changes: Change[] };
type Main = {
  _id: string; dc_code?: string; customerName: string; customerPhone?: string; customerAddress?: string; status: string; poPhotoUrl?: string;
  dcOrderId?: { school_name?: string; school_code?: string; year?: string };
  grid?: { academicYear: string; deliveryChoice: Choice; scenario: string; sourceDcId?: string; revision: number; adjustments: Adjustment[] };
  originalRows?: Row[]; currentRows?: Row[]; linkedDcs?: Main[];
  abacusMaterials?: { studentAbacusQuantity: number; masterAbacusQuantity: number; flashCardSetsQuantity: number; masterAbacusUnitPrice: number; masterAbacusCharge: number };
};
type Selection = { allocationId: string; quantities: string[]; prices: string[] };
type Preview = { scenario: string; academicYear: string; allocations: Allocation[]; unavailable: { program: string; class: string; message: string }[] };
type Screen = 'home' | 'new' | 'sub' | 'detail';
type CreationType = '' | 'new_school' | 'existing_dc';

const modelLabel: Record<string, string> = { single: 'Single level per year', two: 'Two levels per year', both: 'Both levels together' };
const scenarioLabel: Record<string, string> = { initial: 'First allocation', same_year: 'Same Year', next_year: 'Next Year' };
const YEAR_PATTERN = /^\d{4}(?:-\d{2}(?:\d{2})?)?$/;
const EMPTY_SCHOOL = { school_name: '', school_code: '', contact_mobile: '', address: '', pincode: '', state: '', zone: '', cluster: '' };
const ASSIGN_ROLES = ['Super Admin', 'Admin', 'Coordinator', 'Senior Coordinator', 'Manager'];
const statusText = (s?: string) => String(s || '').replace(/_/g, ' ');
const asArray = (data: any) => (Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);

export default function DCGridScreen({ navigation, route }: any) {
  const initialDcId: string | undefined = route?.params?.dcId || undefined;
  const initialAction: string | undefined = route?.params?.action || undefined;
  const { user } = useAuth();
  const canAssign = Boolean((user as any)?.isSuperAdmin || ASSIGN_ROLES.includes(user?.role || ''));

  const [screen, setScreen] = useState<Screen>(initialDcId ? (initialAction === 'sub' ? 'sub' : initialAction === 'new' ? 'new' : 'detail') : 'home');
  const [creationType, setCreationType] = useState<CreationType>(initialAction === 'new' ? 'existing_dc' : '');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [mains, setMains] = useState<Main[]>([]);
  const [sourceId, setSourceId] = useState(initialDcId || '');
  const [main, setMain] = useState<Main | null>(null);
  const [mainLoading, setMainLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [year, setYear] = useState('');
  const [sourceAcademicYear, setSourceAcademicYear] = useState('');
  const [choice, setChoice] = useState<Choice>('term1');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [selections, setSelections] = useState<Selection[]>([]);
  const [masterQuantityOverride, setMasterQuantityOverride] = useState<string | null>(null);
  const [masterUnitPrice, setMasterUnitPrice] = useState('');
  const [allocationId, setAllocationId] = useState('');
  const [school, setSchool] = useState(EMPTY_SCHOOL);
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [remarks, setRemarks] = useState('');
  const [editType, setEditType] = useState<EditType>('Excess');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showReference, setShowReference] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [poUrl, setPoUrl] = useState('');
  const [poName, setPoName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Catalog (grid rules) and the Main DC list.
  useEffect(() => {
    let active = true;
    Promise.all([apiService.get('/dc/grid/catalog'), apiService.get('/dc/grid')])
      .then(([rules, records]) => {
        if (!active) return;
        setCatalog(rules);
        setMains(asArray(records));
      })
      .catch((e: any) => active && setError(e?.message || 'Unable to load DCs.'))
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  // Selected Main DC.
  useEffect(() => {
    let active = true;
    setMain(null);
    setEdits({});
    setSourceAcademicYear('');
    if (!sourceId) {
      setMainLoading(false);
      return;
    }
    setMainLoading(true);
    apiService
      .get(`/dc/${sourceId}/grid`)
      .then((record: Main) => {
        if (!active) return;
        setMain(record);
        setSourceAcademicYear(record.grid?.academicYear || record.dcOrderId?.year || '');
        setChoice(record.grid?.deliveryChoice || 'term1');
        setPoUrl(record.poPhotoUrl || '');
        setPoName('');
      })
      .catch((e: any) => active && setError(e?.message || 'Unable to load Main DC.'))
      .finally(() => active && setMainLoading(false));
    return () => {
      active = false;
    };
  }, [sourceId, reload]);

  // Active employees for the assigned-employee picker (new school, managers and coordinators only).
  useEffect(() => {
    if (!canAssign || creationType !== 'new_school') return;
    let active = true;
    apiService
      .get('/employees?isActive=true')
      .then((data: any) => {
        if (!active) return;
        setEmployees(asArray(data).filter((e: any) => e?._id && e.isActive !== false));
      })
      .catch((e: any) => active && setError(e?.message || 'Unable to load employees.'));
    return () => {
      active = false;
    };
  }, [canAssign, creationType]);

  // Grid preview for a DC against an existing DC (next year / same year).
  useEffect(() => {
    let active = true;
    setPreview(null);
    setSelections([]);
    setAllocationId('');
    setPreviewError('');
    setPreviewLoading(false);
    if (screen !== 'new' || creationType !== 'existing_dc' || !main || !sourceAcademicYear || !YEAR_PATTERN.test(year)) return;
    setPreviewLoading(true);
    apiService
      .post('/dc/grid/preview', { sourceDcId: main._id, sourceAcademicYear, academicYear: year, deliveryChoice: choice })
      .then((result: Preview) => {
        if (!active) return;
        setPreview(result);
        setSelections(
          (result.allocations || []).map((a) => ({
            allocationId: a.id,
            quantities: a.books.map((_, i) => String(a.quantities?.[i] || '')),
            prices: a.books.map(() => ''),
          }))
        );
      })
      .catch((e: any) => active && setPreviewError(e?.message || 'Unable to apply the grid.'))
      .finally(() => active && setPreviewLoading(false));
    return () => {
      active = false;
    };
  }, [screen, creationType, main, sourceAcademicYear, year, choice]);

  const allocations: Allocation[] = creationType === 'existing_dc' ? preview?.allocations || [] : catalog?.initial?.[choice] || [];
  const abacusStrength = abacusStudentStrength(
    selections.flatMap((selection) => {
      const allocation = allocations.find((item) => item.id === selection.allocationId);
      return allocation?.program === 'Abacus'
        ? selection.quantities.map((quantity) => ({ product: 'Abacus', class: allocation.class, strength: Number(quantity) || 0 }))
        : [];
    })
  );
  const masterQuantity = masterQuantityOverride === null ? defaultMasterAbacusQuantity(abacusStrength) : Number(masterQuantityOverride) || 0;

  const bookOptions = (row: Row) => {
    const key = (row.product || row.productName || '').toLowerCase().replace(/[\s_-]/g, '');
    const program =
      key === 'abacus' ? 'Abacus' : ['vedicmath', 'vedicmaths', 'vedhmath'].includes(key) ? 'Vedic Maths' : ['spellingbee', 'newspellingbee'].includes(key) ? 'Spelling Bee' : '';
    return catalog?.books?.[program] || [];
  };

  function startNew(type: CreationType = '') {
    setScreen('new');
    setCreationType(type);
    setSelections([]);
    setRemarks('');
    setError('');
    setYear('');
    setMasterQuantityOverride(null);
    setMasterUnitPrice('');
    if (type !== 'existing_dc') setSourceId('');
  }

  function openRecord(id: string, action: 'detail' | 'sub' = 'detail') {
    setSourceId(id);
    setScreen(action);
    setError('');
    setEdits({});
    setRemarks('');
  }

  async function saveMain() {
    setSaving(true);
    setError('');
    try {
      const result: Main = await apiService.post('/dc/grid', {
        creationType,
        sourceDcId: sourceId,
        sourceAcademicYear,
        academicYear: year,
        deliveryChoice: choice,
        selections,
        school,
        employeeId,
        remarks,
        ...(creationType === 'new_school' && abacusStrength > 0
          ? { abacusMaterials: { masterAbacusQuantity: masterQuantity, masterAbacusUnitPrice: Number(masterUnitPrice) || 0 } }
          : {}),
      });
      setSourceId(result._id);
      setScreen('detail');
      setReload((n) => n + 1);
      showAlert('Saved', 'Main DC created');
    } catch (e: any) {
      setError(e?.message || 'Unable to create DC.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSub() {
    if (!main) return;
    setSaving(true);
    setError('');
    try {
      await apiService.post(`/dc/${main._id}/sub-dc`, {
        editType,
        revision: main.grid?.revision || 0,
        academicYear: sourceAcademicYear,
        deliveryChoice: choice,
        remarks,
        edits: Object.entries(edits).map(([lineId, value]) => (editType === 'Exchange' ? { lineId, book: value } : { lineId, quantity: value })),
      });
      setScreen('detail');
      setEdits({});
      setReload((n) => n + 1);
      showAlert('Saved', 'Sub DC applied');
    } catch (e: any) {
      setError(e?.message || 'Unable to create Sub DC.');
    } finally {
      setSaving(false);
    }
  }

  async function pickPo() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      setUploading(true);
      setError('');
      const data = new FormData();
      data.append('poPhoto', { uri: file.uri, type: file.mimeType || 'application/pdf', name: file.name || 'po.pdf' } as any);
      const uploaded = await apiService.upload('/dc/upload-po', data);
      if (!uploaded?.poPhotoUrl) throw new Error(uploaded?.message || 'Unable to upload PO.');
      setPoUrl(uploaded.poPhotoUrl);
      setPoName(file.name || '');
    } catch (e: any) {
      setError(e?.message || 'Unable to upload PO.');
    } finally {
      setUploading(false);
    }
  }

  async function requestDc() {
    if (!main) return;
    setSaving(true);
    setError('');
    try {
      await apiService.post(`/dc/${main._id}/grid/request`, { poPhotoUrl: poUrl });
      setReload((n) => n + 1);
      showAlert('Requested', 'DC sent to Closed Sales for review');
    } catch (e: any) {
      setError(e?.message || 'Unable to request DC.');
    } finally {
      setSaving(false);
    }
  }

  const updateSelection = (index: number, field: 'quantities' | 'prices', bookIndex: number, value: string) =>
    setSelections((list) =>
      list.map((s, i) => (i === index ? { ...s, [field]: s[field].map((v, j) => (j === bookIndex ? value : v)) } : s))
    );

  const addAllocation = () => {
    const a = allocations.find((item) => item.id === allocationId);
    if (!a) return;
    const duplicate = selections.some((s) => {
      const other = allocations.find((item) => item.id === s.allocationId);
      return other?.program === a.program && other.class === a.class;
    });
    if (duplicate) {
      setError('Choose one allocation per product and class.');
      return;
    }
    setSelections([...selections, { allocationId, quantities: a.books.map(() => ''), prices: a.books.map(() => '') }]);
    setAllocationId('');
    setError('');
  };

  const toggleEdit = (row: Row) =>
    setEdits((previous) => {
      const next = { ...previous };
      if (row.lineId in next) delete next[row.lineId];
      else next[row.lineId] = editType === 'Exchange' ? '' : String(row.quantity);
      return next;
    });

  const mainYear = (dc: Main) => dc.grid?.academicYear || dc.dcOrderId?.year || '';

  const sourceSelector = (
    <WebSelect
      label="Main DC"
      value={sourceId}
      placeholder="Select a Main DC"
      onValueChange={(v) => {
        setSourceId(v);
        setError('');
      }}
      items={mains.map((dc) => ({
        value: dc._id,
        label: `${dc.dc_code || dc._id} · ${dc.customerName} · ${mainYear(dc) || 'Year not set'}`,
      }))}
    />
  );

  const title = screen === 'detail' ? 'Main DC Details' : screen === 'sub' ? 'Create Sub DC' : 'Create DC';
  const createDisabled =
    saving || loading || previewLoading || mainLoading || !year || !selections.length || (creationType === 'existing_dc' && !preview);

  return (
    <ScreenShell
      title={title}
      subtitle="School book allocations and DC adjustment history"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setReload((n) => n + 1);
      }}
    >
      <View style={styles.topActions}>
        <View style={styles.flex}>
          <WebButton title={showReference ? 'Hide grids' : 'View grids'} variant="outline" onPress={() => setShowReference(!showReference)} />
        </View>
        {screen !== 'home' ? (
          <View style={styles.flex}>
            <WebButton
              title="All Main DCs"
              variant="outline"
              disabled={saving}
              onPress={() => {
                setScreen('home');
                setError('');
              }}
            />
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {showReference && catalog ? (
        <Card title="Grid.docx — listed mappings">
          {(catalog.mappings || []).map((m) => (
            <View key={m.id} style={styles.refRow}>
              <Text style={styles.strong}>
                {m.program} · {modelLabel[m.model] || m.model}
              </Text>
              <Text style={styles.meta}>
                Class {m.fromClass}: {m.fromBooks.join(' + ') || '0'} → Class {m.toClass}: {m.toBooks.join(' + ')}
              </Text>
            </View>
          ))}
          {(catalog.unmappedRows || []).map((row) => (
            <View key={row.id} style={styles.refRow}>
              <Text style={styles.strong}>
                {row.program} · {modelLabel[row.model] || row.model}
              </Text>
              <Text style={styles.meta}>
                Class {row.class}: {row.books.join(' + ')} → No next-year destination listed
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {screen === 'home' ? (
        <>
          <Card title="New DC" description="Create a Main DC for a new school or a new transaction against an existing DC.">
            <WebButton title="New DC" disabled={!catalog} onPress={() => startNew()} />
          </Card>
          <Card title="Sub DC" description="Apply Excess, Shortage or Exchange to an existing Main DC.">
            <WebButton
              title="Sub DC"
              disabled={!catalog}
              onPress={() => {
                setScreen('sub');
                setSourceId('');
                setEdits({});
                setRemarks('');
                setError('');
              }}
            />
          </Card>
          <Card title="Main DCs">
            {!loading && !mains.length ? <Text style={styles.meta}>No Main DCs yet.</Text> : null}
            {mains.map((dc) => (
              <View key={dc._id} style={styles.listRow}>
                <View style={styles.flex}>
                  <Text style={styles.strong}>{dc.dc_code || dc._id}</Text>
                  <Text style={styles.meta}>{dc.customerName}</Text>
                  <Text style={styles.meta}>
                    {mainYear(dc) || '—'} · {statusText(dc.status)}
                  </Text>
                </View>
                <WebButton title="Details / Sub DC" variant="outline" onPress={() => openRecord(dc._id)} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {screen === 'new' ? (
        <Card>
          <View style={styles.segment}>
            <Segment label="New School" active={creationType === 'new_school'} onPress={() => { setCreationType('new_school'); setSourceId(''); }} />
            <Segment label="Against Existing DC" active={creationType === 'existing_dc'} onPress={() => setCreationType('existing_dc')} />
          </View>

          {creationType ? (
            <>
              {creationType === 'new_school' ? (
                <>
                  <Field label="School name" value={school.school_name} onChangeText={(t) => setSchool({ ...school, school_name: t })} />
                  <WebLabel>School code</WebLabel>
                  <Text style={styles.readonly}>Assigned automatically from the pincode, zone, and cluster</Text>
                  <Field
                    label="Pincode"
                    value={school.pincode}
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(t) => setSchool({ ...school, pincode: t.replace(/\D/g, '').slice(0, 6) })}
                  />
                  <Field label="State" value={school.state} onChangeText={(t) => setSchool({ ...school, state: t })} />
                  <Field label="Zone" value={school.zone} onChangeText={(t) => setSchool({ ...school, zone: t })} />
                  <Field label="Cluster" value={school.cluster} onChangeText={(t) => setSchool({ ...school, cluster: t })} />
                  <Field
                    label="Contact mobile"
                    value={school.contact_mobile}
                    keyboardType="number-pad"
                    maxLength={15}
                    onChangeText={(t) => setSchool({ ...school, contact_mobile: t.replace(/\D/g, '').slice(0, 15) })}
                  />
                  <Field label="School address" value={school.address} onChangeText={(t) => setSchool({ ...school, address: t })} />
                  {canAssign ? (
                    <WebSelect
                      label="Assigned employee"
                      value={employeeId}
                      placeholder="Select employee"
                      onValueChange={setEmployeeId}
                      items={employees.map((e) => ({ value: e._id, label: e.name || e._id }))}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  {sourceSelector}
                  <Text style={styles.meta}>This creates a new DC transaction linked to the selected DC.</Text>
                </>
              )}

              <WebSelect
                label="Delivery choice"
                value={choice}
                onValueChange={(v) => setChoice((v as Choice) || 'term1')}
                items={[
                  { value: 'term1', label: 'Term 1' },
                  { value: 'both', label: 'Both Levels' },
                ]}
              />
              {creationType === 'existing_dc' ? (
                <Field
                  label="Original academic year"
                  placeholder="2026-27"
                  value={sourceAcademicYear}
                  editable={!(main?.grid?.academicYear || main?.dcOrderId?.year)}
                  onChangeText={setSourceAcademicYear}
                />
              ) : null}
              <Field label="DC academic year" placeholder="2026-27" value={year} onChangeText={setYear} />

              {mainLoading && creationType === 'existing_dc' ? <Text style={styles.status}>Loading original allocation…</Text> : null}
              {previewLoading ? <Text style={styles.status}>Applying the distribution grid…</Text> : null}
              {previewError ? <Text style={styles.errorText}>{previewError}</Text> : null}
              {preview ? (
                <View style={styles.block}>
                  <Text style={styles.strong}>Distribution: {scenarioLabel[preview.scenario] || preview.scenario}</Text>
                  {(preview.unavailable || []).map((item, i) => (
                    <Text key={i} style={styles.warn}>
                      {item.program}, Class {item.class}: {item.message}
                    </Text>
                  ))}
                </View>
              ) : null}

              {creationType === 'new_school' ? (
                <>
                  <WebSelect
                    label="Class / category / level allocation"
                    value={allocationId}
                    placeholder="Select a listed allocation"
                    onValueChange={setAllocationId}
                    items={allocations.map((a) => ({ value: a.id, label: `${a.program} · Class ${a.class} · ${a.books.join(' + ')}` }))}
                  />
                  <WebButton title="Add class" disabled={!allocationId} onPress={addAllocation} />
                  <View style={{ height: 12 }} />
                </>
              ) : null}

              {selections.map((selection, index) => {
                const allocation = allocations.find((a) => a.id === selection.allocationId);
                if (!allocation) return null;
                return (
                  <View key={selection.allocationId} style={styles.selection}>
                    <View style={styles.rowBetween}>
                      <View style={styles.flex}>
                        <Text style={styles.strong}>
                          {allocation.program} · Class {allocation.class}
                        </Text>
                        <Text style={styles.meta}>
                          {modelLabel[allocation.model] || allocation.model}
                          {allocation.fromBooks ? ` · From Class ${allocation.fromClass}: ${allocation.fromBooks.join(' + ')}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelections(selections.filter((_, i) => i !== index))} hitSlop={8}>
                        <Text style={styles.remove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                    {allocation.books.map((book, bookIndex) => (
                      <View key={book} style={styles.bookRow}>
                        <Text style={styles.bookName}>{book}</Text>
                        <View style={styles.inline}>
                          <View style={styles.flex}>
                            <Field
                              label="Quantity"
                              keyboardType="number-pad"
                              value={selection.quantities[bookIndex]}
                              onChangeText={(t) => updateSelection(index, 'quantities', bookIndex, t.replace(/\D/g, ''))}
                            />
                          </View>
                          <View style={styles.flex}>
                            <Field
                              label="Unit price"
                              keyboardType="decimal-pad"
                              value={selection.prices[bookIndex]}
                              onChangeText={(t) => updateSelection(index, 'prices', bookIndex, t.replace(/[^\d.]/g, ''))}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })}

              {creationType === 'new_school' && abacusStrength > 0 ? (
                <View style={styles.selection}>
                  <Text style={styles.strong}>First DC · Abacus materials</Text>
                  <Text style={styles.body}>
                    Student Abacus: {abacusStrength} (one per student). Flash Card sets: {masterQuantity} (one per Master Abacus).
                  </Text>
                  <Text style={styles.meta}>
                    Default Master Abacus: {defaultMasterAbacusQuantity(abacusStrength)}. You can add or remove units. Below 100 students,
                    adding Master Abacus requires a price.
                  </Text>
                  <Field
                    label="Master Abacus quantity"
                    keyboardType="number-pad"
                    value={masterQuantityOverride ?? String(masterQuantity)}
                    onChangeText={(t) => setMasterQuantityOverride(t.replace(/\D/g, ''))}
                  />
                  <Field
                    label="Master Abacus unit price (₹, if charged)"
                    keyboardType="decimal-pad"
                    value={masterUnitPrice}
                    onChangeText={(t) => setMasterUnitPrice(t.replace(/[^\d.]/g, ''))}
                  />
                </View>
              ) : null}

              <Field label="Remarks" value={remarks} maxLength={2000} multiline onChangeText={setRemarks} />
              <WebButton title={saving ? 'Creating…' : 'Create Main DC'} loading={saving} disabled={createDisabled} onPress={() => void saveMain()} />
            </>
          ) : null}
        </Card>
      ) : null}

      {screen === 'detail' || screen === 'sub' ? (
        <>
          {sourceSelector}
          {mainLoading ? <Text style={styles.status}>Loading Main DC…</Text> : null}
          {main ? (
            <>
              <Card>
                <Info label="Main DC reference" value={main.dc_code || main._id} />
                <Info
                  label="School"
                  value={`${main.customerName}${main.dcOrderId?.school_code ? ` (${main.dcOrderId.school_code})` : ''}`}
                />
                <Info label="Academic year" value={mainYear(main) || 'Not set'} />
                <Info
                  label="Distribution"
                  value={
                    main.grid
                      ? `${scenarioLabel[main.grid.scenario] || main.grid.scenario} · ${main.grid.deliveryChoice === 'both' ? 'Both Levels' : 'Term 1'}`
                      : 'Original allocation'
                  }
                />
                <Info label="Status" value={statusText(main.status)} />
                {main.grid?.sourceDcId ? (
                  <TouchableOpacity onPress={() => openRecord(String(main.grid?.sourceDcId))}>
                    <Text style={styles.link}>Created against: Previous Main DC</Text>
                  </TouchableOpacity>
                ) : null}

                <Text style={[styles.strong, styles.sectionGap]}>Current allocation</Text>
                <RowsList rows={main.currentRows || []} original={main.originalRows} />

                {main.abacusMaterials ? (
                  <Text style={styles.note}>
                    Abacus materials: Student Abacus {main.abacusMaterials.studentAbacusQuantity} · Master Abacus{' '}
                    {main.abacusMaterials.masterAbacusQuantity} · Flash Card sets {main.abacusMaterials.flashCardSetsQuantity}
                    {main.abacusMaterials.masterAbacusCharge > 0 ? ` · Master charge ₹${main.abacusMaterials.masterAbacusCharge}` : ''}
                  </Text>
                ) : null}

                <TouchableOpacity style={styles.disclosure} onPress={() => setShowOriginal(!showOriginal)}>
                  <Ionicons name={showOriginal ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textPrimary} />
                  <Text style={styles.strong}>Original allocation</Text>
                </TouchableOpacity>
                {showOriginal ? <RowsList rows={main.originalRows || []} /> : null}

                <View style={styles.stack}>
                  <WebButton
                    title="Create Sub DC"
                    disabled={saving}
                    onPress={() => {
                      setScreen('sub');
                      setEdits({});
                      setRemarks('');
                      setError('');
                    }}
                  />
                  <WebButton title="Create New DC" variant="outline" disabled={saving} onPress={() => startNew('existing_dc')} />
                  <WebButton title="Client requests" variant="outline" onPress={() => navigation.navigate('DCClient')} />
                </View>
              </Card>

              {screen === 'detail' && main.grid && main.status === 'created' ? (
                <Card title="Request DC" description="Attach the purchase order and send this allocation to Closed Sales for review.">
                  <WebButton
                    title={uploading ? 'Uploading…' : poUrl ? 'Replace purchase order (PDF or image)' : 'Attach purchase order (PDF or image)'}
                    variant="outline"
                    loading={uploading}
                    disabled={uploading || saving}
                    onPress={() => void pickPo()}
                  />
                  {poUrl ? <Text style={styles.ok}>Purchase order attached{poName ? `: ${poName}` : ''}.</Text> : null}
                  <View style={{ height: 8 }} />
                  <WebButton
                    title={saving ? 'Submitting…' : 'Request DC'}
                    loading={saving}
                    disabled={saving || uploading || !poUrl}
                    onPress={() => void requestDc()}
                  />
                </Card>
              ) : null}

              {screen === 'sub' ? (
                <Card title="Sub DC adjustment">
                  {!main.grid?.academicYear && !main.dcOrderId?.year ? (
                    <Field label="Main DC academic year" placeholder="2026-27" value={sourceAcademicYear} onChangeText={setSourceAcademicYear} />
                  ) : null}
                  <WebSelect
                    label="Edit type"
                    value={editType}
                    onValueChange={(v) => {
                      setEditType((v as EditType) || 'Excess');
                      setEdits({});
                    }}
                    items={['Excess', 'Shortage', 'Exchange'].map((t) => ({ value: t, label: t }))}
                  />
                  <Text style={styles.meta}>
                    {editType === 'Exchange'
                      ? 'Select the replacement category / level. Quantity remains unchanged.'
                      : `Enter the revised requirement for selected rows. ${editType === 'Excess' ? 'Excess increases' : 'Shortage decreases'} quantity.`}
                  </Text>
                  {!['created', 'po_submitted', 'pending_dc', 'scheduled_for_later'].includes(main.status) ? (
                    <Text style={styles.warn}>
                      This updates the school’s requirement. Warehouse processing and recorded deliveries remain in their existing workflow.
                    </Text>
                  ) : null}
                  {(main.currentRows || []).map((row) => {
                    const on = row.lineId in edits;
                    const label = `${row.product} · Class ${row.class} · ${row.productCategory || row.level || ''}`;
                    const revised = edits[row.lineId];
                    return (
                      <View key={row.lineId} style={[styles.editRow, on && styles.editRowOn]}>
                        <TouchableOpacity
                          style={styles.editHead}
                          onPress={() => toggleEdit(row)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={`Adjust ${label}`}
                        >
                          <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.textMuted} />
                          <View style={styles.flex}>
                            <Text style={styles.strong}>{label}</Text>
                            <Text style={styles.meta}>Current quantity: {row.quantity}</Text>
                          </View>
                        </TouchableOpacity>
                        {on ? (
                          editType === 'Exchange' ? (
                            <WebSelect
                              value={revised || ''}
                              placeholder="Select replacement"
                              onValueChange={(v) => setEdits({ ...edits, [row.lineId]: v })}
                              items={bookOptions(row)
                                .filter((book) => book !== row.productCategory)
                                .map((book) => ({ value: book, label: book }))}
                            />
                          ) : (
                            <>
                              <WebInput
                                accessibilityLabel="Revised quantity"
                                keyboardType="number-pad"
                                value={revised ?? ''}
                                onChangeText={(t) => setEdits({ ...edits, [row.lineId]: t.replace(/\D/g, '') })}
                              />
                              {revised !== undefined && revised !== '' ? (
                                <Text style={styles.meta}>
                                  Difference: {Number(revised) - row.quantity > 0 ? '+' : ''}
                                  {Number(revised) - row.quantity}
                                </Text>
                              ) : null}
                            </>
                          )
                        ) : null}
                      </View>
                    );
                  })}
                  <Field label="Remarks" value={remarks} maxLength={2000} multiline onChangeText={setRemarks} />
                  <WebButton
                    title={saving ? 'Applying…' : 'Create Sub DC'}
                    loading={saving}
                    disabled={saving || !Object.keys(edits).length}
                    onPress={() => void saveSub()}
                  />
                </Card>
              ) : null}

              <Card title="Sub DC History">
                {!main.grid?.adjustments?.length ? (
                  <Text style={styles.meta}>No adjustments yet. Sub DC actions are available from Main DC creation.</Text>
                ) : null}
                {(main.grid?.adjustments || []).map((a) => (
                  <View key={a.reference} style={styles.history}>
                    <View style={styles.rowBetween}>
                      <Text style={[styles.strong, styles.flex]}>
                        {a.editType} · {a.reference}
                      </Text>
                      <Text style={styles.meta}>{a.status}</Text>
                    </View>
                    <Text style={styles.small}>
                      Main DC: {main.dc_code || main._id} · {new Date(a.createdAt).toLocaleString()} · {a.createdByName || '—'}
                    </Text>
                    {(a.changes || []).map((change) => (
                      <Text key={change.lineId} style={styles.body}>
                        {change.before.product}, Class {change.before.class}:{' '}
                        {a.editType === 'Exchange'
                          ? `${change.before.productCategory || change.before.level} → ${change.after.productCategory || change.after.level}`
                          : `${change.before.quantity} → ${change.after.quantity} (${change.quantityDifference > 0 ? '+' : ''}${change.quantityDifference})`}
                      </Text>
                    ))}
                    {a.remarks ? <Text style={styles.meta}>{a.remarks}</Text> : null}
                  </View>
                ))}
              </Card>

              {main.linkedDcs?.length ? (
                <Card title="New DCs against this Main DC">
                  {main.linkedDcs.map((dc) => (
                    <TouchableOpacity key={dc._id} onPress={() => openRecord(dc._id)}>
                      <Text style={styles.link}>
                        {dc.dc_code || dc._id} · {dc.grid?.academicYear} · {statusText(dc.status)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </ScreenShell>
  );
}

function Card({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {description ? <Text style={styles.cardDesc}>{description}</Text> : null}
      {children}
    </View>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof WebInput>) {
  return (
    <View>
      <WebLabel>{label}</WebLabel>
      <WebInput {...props} style={[props.multiline ? styles.multiline : null, props.editable === false ? styles.disabledInput : null]} />
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.segmentBtn, active && styles.segmentBtnOn]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.segmentText, active && styles.segmentTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RowsList({ rows, original }: { rows: Row[]; original?: Row[] }) {
  if (!rows.length) return <Text style={styles.meta}>No rows.</Text>;
  return (
    <View>
      {rows.map((row) => {
        const before = original?.find((r) => r.lineId === row.lineId)?.quantity;
        return (
          <View key={row.lineId} style={styles.rowItem}>
            <View style={styles.flex}>
              <Text style={styles.strong}>
                {row.product || row.productName} · Class {row.class}
              </Text>
              <Text style={styles.meta}>
                {row.productCategory || row.category || '—'}
                {row.level ? ` · Level ${row.level}` : ''}
              </Text>
            </View>
            <View style={styles.qty}>
              {original ? <Text style={styles.small}>Original: {before ?? '—'}</Text> : null}
              <Text style={styles.strong}>
                {original ? 'Current: ' : 'Qty: '}
                {row.quantity}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topActions: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  errorBox: { backgroundColor: colors.errorLight, borderColor: '#FECACA', borderWidth: 1, borderRadius: radii.md, padding: 12, marginBottom: spacing.md },
  errorText: { color: '#991B1B', fontSize: 13, marginBottom: 6 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  cardDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  refRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderLight },
  strong: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textPrimary, marginTop: 4 },
  meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 4 },
  small: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  warn: { fontSize: 13, color: '#92400E', marginTop: 4, marginBottom: 4 },
  ok: { fontSize: 13, color: colors.success, marginTop: 8 },
  status: { fontSize: 13, color: colors.textSecondary, marginBottom: 8 },
  note: { fontSize: 13, color: colors.textPrimary, backgroundColor: colors.backgroundMuted, borderRadius: radii.md, padding: 10, marginTop: 10 },
  link: { fontSize: 14, color: colors.primaryDark, textDecorationLine: 'underline', paddingVertical: 6 },
  readonly: {
    fontSize: 14,
    color: colors.textSecondary,
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  disabledInput: { backgroundColor: colors.backgroundMuted, color: colors.textSecondary },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  segment: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },
  segmentBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  segmentTextOn: { color: colors.primaryForeground },
  block: { marginBottom: 12 },
  selection: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 12, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  remove: { color: colors.error, fontWeight: '600', fontSize: 13 },
  bookRow: { marginTop: 10 },
  bookName: { fontSize: 14, color: colors.textPrimary, marginBottom: 6, fontWeight: '500' },
  inline: { flexDirection: 'row', gap: 10 },
  info: { marginBottom: 10 },
  infoLabel: { fontSize: 12, color: colors.textSecondary },
  infoValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  sectionGap: { marginTop: 10, marginBottom: 6 },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderLight },
  qty: { alignItems: 'flex-end' },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  stack: { gap: 8, marginTop: 8 },
  editRow: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10, marginTop: 10 },
  editRowOn: { borderColor: colors.primary },
  editHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  history: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10, marginBottom: 10 },
});
