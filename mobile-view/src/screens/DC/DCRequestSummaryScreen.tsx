/**
 * DC Request (My Clients flow) — mirrors web app/dashboard/dc/client-dc Request DC dialog.
 * Shows this DC's lines (Term 1 and Term 2), per-row category, related items rebuilt from the
 * catalogue, specimen copies, abacus materials; on mixed terms the user picks the routing.
 * Params: orderId (DcOrder id), optional client (preloaded item from My Clients), optional dcId.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { colors, radii } from '../../theme/colors';
import { typography } from '../../theme/typography';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebLabel } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { isTransportComplete, TRANSPORT_REQUIRED_MESSAGE } from '../../utils/dcTransport';
import { showAlert, showConfirm } from '../../utils/showAlert';
import { navigateRoot } from '../../navigation/navigationRef';
import { useAuth } from '../../context/AuthContext';
import { useDcCatalog } from '../../hooks/useDcCatalog';
import { DcCategoryPicker } from '../../components/dc/DcCategoryPicker';
import {
  SpecimenProductPicker,
  specimenCandidateProducts,
  specimenChoiceFromRows,
} from '../../components/dc/SpecimenProductPicker';
import { AbacusMaterialsFields } from '../../components/dc/AbacusMaterials';
import {
  buildClientDCProductRows,
  collapseEmptyLevelDuplicateLines,
  dedupeSavedPoRows,
  ensureProductLineId,
  keepMyClientsOwnedProductRows,
  orderProductToClientDcDetail,
  productLineIdentityKey,
  requestDcRowQuantity,
  resolveClientDCRowTerm,
  type ResolveClientDCRowOpts,
} from '../../lib/crm/clientDcProductRows';
import {
  buildRelatedItemRows,
  buildSpecimenRows,
  dcRowCategoryOrDefault,
  isMarkerSpecs,
  isRelatedItemRow,
  isSpecimenRow,
  specimenCopiesValue,
  specimenRowQuantity,
  specimenSetsOfRow,
  type SpecimenItemChoice,
} from '../../lib/crm/dcRowCategory';
import { abacusStudentStrength, defaultMasterAbacusQuantity } from '../../lib/crm/abacusMaterials';

/** How to route Term 1 + Term 2 products (web lib/clientDcTermPartition.ts). */
type RequestDcTermRouting = 'term1_only' | 'both_terms';

function partitionRowsByTerm<T extends { term?: string; level?: string }>(rows: T[]) {
  const term1Products = rows.filter((row) => {
    const term = resolveClientDCRowTerm(row);
    return term === 'Term 1' || term === 'Both';
  });
  const term2Products = rows.filter((row) => resolveClientDCRowTerm(row) === 'Term 2');
  const hasMixedTerms = term1Products.length > 0 && term2Products.length > 0;
  const term2Only = term2Products.length > 0 && term1Products.length === 0;
  const term1Only = term1Products.length > 0 && term2Products.length === 0;
  return { term1Products, term2Products, hasMixedTerms, term2Only, term1Only };
}

const idOf = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === 'object') return v._id ? String(v._id) : null;
  return String(v);
};

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value || '-'}</Text>
    </View>
  );
}

type Row = {
  id: string;
  product?: string;
  itemType?: any;
  specs?: any;
  term?: string;
  level?: string;
  strength?: any;
  quantity?: any;
  [key: string]: any;
};

export default function DCRequestSummaryScreen({ navigation, route }: any) {
  const { user } = useAuth() as any;
  const orderId = route?.params?.orderId as string | undefined;
  const client = route?.params?.client as any;
  const paramDcId =
    (route?.params?.dcId as string | undefined) ||
    (client?._id && !client?._isConvertedLead ? String(client._id) : undefined);
  const catalog = useDcCatalog();
  const {
    getProductSpecs,
    getProductRelatedItems,
    getProductSpecimenItems,
    hasProductCategories,
    getProductCategories,
    getProductLevels,
  } = catalog;

  const [order, setOrder] = useState<any>(null);
  const [dc, setDc] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [routing, setRouting] = useState<RequestDcTermRouting | null>(null);
  const [specimenCopiesInput, setSpecimenCopiesInput] = useState('1');
  const [specimenProducts, setSpecimenProducts] = useState<string[] | null>(null);
  const [specimenItemChoice, setSpecimenItemChoice] = useState<SpecimenItemChoice>({});
  const [requestMasterQuantity, setRequestMasterQuantity] = useState<string | null>(null);
  const [requestMasterUnitPrice, setRequestMasterUnitPrice] = useState('');

  useEffect(() => {
    if (orderId && !catalog.loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, catalog.loading]);

  /** Specimen and related-item lines keep their own text; others fall back to the catalogue spec. */
  const persistEditPoSpecs = (productName: string, savedSpec?: string): string => {
    if (isMarkerSpecs(productName, savedSpec, getProductRelatedItems)) return String(savedSpec).trim();
    const specs = getProductSpecs(productName);
    if (specs.length === 0) return '';
    const current = String(savedSpec || '').trim();
    if (current && specs.includes(current)) return current;
    return specs[0] || '';
  };

  const withSpecimenRows = (
    books: Row[],
    products: string[] | null,
    items: SpecimenItemChoice = specimenItemChoice,
    copies: string = specimenCopiesInput,
  ): Row[] => {
    const chosen = products ? new Set(products) : null;
    const source = chosen ? books.filter((r) => chosen.has(String(r.product || ''))) : books;
    return [
      ...books,
      ...buildSpecimenRows(source, specimenCopiesValue(copies), {
        getSpecimenItems: getProductSpecimenItems,
        chosenItems: items,
      }).map((r, i) => ({ ...r, id: `specimen-${Date.now()}-${i}` })),
    ];
  };

  const load = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const dcOrderDoc = await apiService.get(`/dc-orders/${orderId}`);
      setOrder(dcOrderDoc);

      // Sibling Term-Wise DCs on the same order: their lines are never merged in.
      let related: any[] = [];
      try {
        const res = await apiService.get(`/dc?dcOrderId=${encodeURIComponent(orderId)}`);
        related = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      } catch {
        related = [];
      }
      const siblingRows = related
        .filter((r: any) => r?.status === 'scheduled_for_later')
        .flatMap((r: any) => (Array.isArray(r.productDetails) ? r.productDetails : []));

      const dcId =
        paramDcId ||
        idOf(related.find((r: any) => r?.status !== 'scheduled_for_later' && !r?.parentDcId)) ||
        null;

      const pe = dcOrderDoc?.pendingEdit?.status === 'pending' ? dcOrderDoc.pendingEdit : null;
      const pendingProducts = Array.isArray(pe?.products) && pe.products.length ? pe.products : null;
      const committed = Array.isArray(dcOrderDoc?.products) && dcOrderDoc.products.length ? dcOrderDoc.products : null;
      const savedPoProducts: any[] = pendingProducts || committed || [];

      const rowOpts: ResolveClientDCRowOpts = { hasProductCategories, getProductCategories };
      const getDefaultLevel = (p: string) => getProductLevels(p)[0] || '';
      const toRequestDcRows = (details: any[]): Row[] =>
        buildClientDCProductRows(
          dedupeSavedPoRows(keepMyClientsOwnedProductRows(collapseEmptyLevelDuplicateLines(details || []), siblingRows)),
          savedPoProducts,
          rowOpts,
          getDefaultLevel,
        ) as Row[];

      let fullDC: any = null;
      if (dcId) {
        try {
          fullDC = await apiService.get(`/dc/${dcId}`);
        } catch {
          fullDC = null;
        }
      }
      setDc(fullDC || (dcId ? { _id: dcId } : null));

      if (fullDC) {
        let thisDetails: any[] = keepMyClientsOwnedProductRows(
          Array.isArray(fullDC.productDetails) ? [...fullDC.productDetails] : [],
          siblingRows,
        );
        const mappedSavedPo = keepMyClientsOwnedProductRows(
          savedPoProducts.map((p: any) => orderProductToClientDcDetail(p)).filter((p: any) => p.product),
          siblingRows,
        );
        const poDeduped = dedupeSavedPoRows(mappedSavedPo);
        const dcDeduped = dedupeSavedPoRows(thisDetails);
        thisDetails =
          poDeduped.length > 0 && poDeduped.length >= dcDeduped.length
            ? poDeduped
            : dcDeduped.length > 0
              ? dcDeduped
              : poDeduped;

        // Saved PO rows carry no billing category or specimen copies — restore both from this DC.
        const savedDcRows: any[] = Array.isArray(fullDC.productDetails) ? fullDC.productDetails : [];
        const savedCategoryByKey = new Map(savedDcRows.map((p: any) => [productLineIdentityKey(p), p.category] as const));
        const shownRows = toRequestDcRows(thisDetails.filter((p: any) => !isSpecimenRow(p) && !isRelatedItemRow(p))).map(
          (row) => ({
            ...row,
            category: dcRowCategoryOrDefault(savedCategoryByKey.get(productLineIdentityKey(row)) ?? row.category),
          }),
        );
        const savedSpecimens = savedDcRows.filter((p: any) => isSpecimenRow(p));
        // Related items are rebuilt from the current catalogue so new items / prices apply.
        const relatedRows = buildRelatedItemRows(shownRows, getProductRelatedItems).map((r, i) => ({
          ...r,
          id: `related-${Date.now()}-${i}`,
        }));
        setRows([
          ...shownRows,
          ...relatedRows,
          ...(savedSpecimens.length
            ? toRequestDcRows(savedSpecimens).map((r) => ({ ...r, category: 'Training Material' }))
            : []),
        ]);
        setSpecimenCopiesInput(String(specimenSetsOfRow(savedSpecimens[0], getProductSpecimenItems)));
        const savedChoice = specimenChoiceFromRows(savedSpecimens);
        setSpecimenProducts(savedSpecimens.length ? savedChoice.products : null);
        setSpecimenItemChoice(savedChoice.items);
        setRequestMasterQuantity(
          fullDC.abacusMaterials ? String(fullDC.abacusMaterials.masterAbacusQuantity ?? '') : null,
        );
        setRequestMasterUnitPrice(
          fullDC.abacusMaterials?.masterAbacusUnitPrice ? String(fullDC.abacusMaterials.masterAbacusUnitPrice) : '',
        );
      } else {
        const fallback = savedPoProducts.map((p: any) => orderProductToClientDcDetail(p)).filter((p: any) => p.product);
        setRows(toRequestDcRows(keepMyClientsOwnedProductRows(fallback, siblingRows)));
        setRequestMasterQuantity(null);
        setRequestMasterUnitPrice('');
      }
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to load order');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const termSplit = useMemo(() => partitionRowsByTerm(rows), [rows]);
  // Abacus materials stay editable only on the school's first new-school DC (the one that carries them).
  const requestAbacusStrength = dc?.abacusMaterials ? abacusStudentStrength(rows as any) : 0;
  const requestMasterQuantityValue =
    requestMasterQuantity === null || requestMasterQuantity === ''
      ? defaultMasterAbacusQuantity(requestAbacusStrength)
      : Number(requestMasterQuantity) || 0;

  const handleRequestDC = async () => {
    if (!orderId) return;
    if (order?.status === 'dc_requested') {
      showAlert('Already requested', 'This client is already in Closed Sales.');
      return;
    }
    if (!isTransportComplete(order)) {
      showConfirm(
        'Transport required',
        TRANSPORT_REQUIRED_MESSAGE,
        () => {
          if (!navigateRoot('ClientEditPO', { orderId })) navigation.navigate('ClientEditPO', { orderId });
        },
        'Open Edit PO',
      );
      return;
    }
    if (!dc?._id) {
      showAlert('Error', 'Cannot send to Closed Sales: this client has no linked DC.');
      return;
    }
    if (rows.length === 0) {
      showAlert('Error', 'Please add at least one product before requesting');
      return;
    }
    if (rows.some((p) => !p.product || !p.quantity || !p.strength)) {
      showAlert('Error', 'Please fill in Product, Quantity, and Strength for all products');
      return;
    }
    if (
      requestAbacusStrength > 0 &&
      requestMasterQuantityValue > 0 &&
      requestAbacusStrength < 100 &&
      !(Number(requestMasterUnitPrice) > 0)
    ) {
      showAlert('Error', 'Enter a Master Abacus price when adding it below 100 students.');
      return;
    }

    const bookRows = rows.filter((row) => !isRelatedItemRow(row));
    const rowsToSend = [
      ...bookRows.filter((row) => !isSpecimenRow(row)),
      ...buildRelatedItemRows(bookRows, getProductRelatedItems),
      ...bookRows.filter((row) => isSpecimenRow(row)),
    ];
    const productDetails: any[] = keepMyClientsOwnedProductRows(
      rowsToSend.map((row: any) => ({
        lineId: ensureProductLineId(row),
        product: row.product || '',
        class: row.class || '1',
        category: dcRowCategoryOrDefault(row.category),
        itemType: row.itemType || undefined,
        section: row.section || undefined,
        program: row.program || undefined,
        stream: row.stream || undefined,
        productCategory: row.productCategory || undefined,
        specs: persistEditPoSpecs(row.product_name || row.product, row.specs),
        subject: row.subject || undefined,
        quantity: Number(row.quantity) || 0,
        strength: Number(row.strength) || 0,
        level: row.level && row.level !== '-' ? row.level : '',
        term: resolveClientDCRowTerm(row),
        dispatchMode: row.dispatchMode || undefined,
        // Related items carry their catalogue price (₹0 when non-billable); book prices resolve server-side.
        ...(isRelatedItemRow(row) ? { unit_price: Number(row.unit_price) || 0 } : {}),
      })),
    );
    const totalQuantity = productDetails.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const { term1Products, term2Products, hasMixedTerms } = partitionRowsByTerm(productDetails);
    if (hasMixedTerms && !routing) {
      showAlert(
        'Choose routing',
        'This DC has Term 1 and Term 2 products. Choose whether to send both terms to Closed Sales or only Term 1 (Term 2 goes to Term-Wise DC).',
      );
      return;
    }
    const splitTerm2 = hasMixedTerms && routing === 'term1_only';
    const abacusMaterialsFor = (list: any[]) =>
      requestAbacusStrength > 0 && abacusStudentStrength(list) > 0
        ? {
            abacusMaterials: {
              masterAbacusQuantity: requestMasterQuantityValue,
              masterAbacusUnitPrice: Number(requestMasterUnitPrice) || 0,
            },
          }
        : {};
    const poPhotoUrl = dc?.poPhotoUrl || '';

    setSubmitting(true);
    try {
      let term2DC: any = null;
      if (splitTerm2) {
        const term1Quantity = term1Products.reduce((s, p) => s + (p.quantity || 0), 0);
        await apiService.put(`/dc/${dc._id}`, {
          productDetails: term1Products,
          requestedQuantity: term1Quantity,
          // Stays po_submitted until Admin / Coordinator raises it from Closed Sales.
          status: 'po_submitted',
          ...abacusMaterialsFor(term1Products),
          ...(poPhotoUrl ? { poPhotoUrl, poDocument: poPhotoUrl } : {}),
        });
        const term2Quantity = term2Products.reduce((s, p) => s + (p.quantity || 0), 0);
        term2DC = await apiService.post('/dc/raise', {
          dcOrderId: idOf(dc.dcOrderId) || orderId,
          employeeId: idOf(dc.employeeId),
          productDetails: term2Products,
          requestedQuantity: term2Quantity,
          status: 'scheduled_for_later', // Term-Wise DC
          ...(poPhotoUrl ? { poPhotoUrl } : {}),
        });
      } else {
        await apiService.put(`/dc/${dc._id}`, {
          productDetails,
          requestedQuantity: totalQuantity,
          status: 'po_submitted',
          ...abacusMaterialsFor(productDetails),
          ...(poPhotoUrl ? { poPhotoUrl, poDocument: poPhotoUrl } : {}),
        });
      }

      const productsForDcOrder = splitTerm2 ? term1Products : productDetails;
      const quantityForDcOrder = splitTerm2
        ? term1Products.reduce((s, p) => s + (p.quantity || 0), 0)
        : totalQuantity;
      try {
        await apiService.put(`/dc-orders/${idOf(dc.dcOrderId) || orderId}`, {
          status: 'dc_requested',
          dcRequestData: {
            productDetails: productsForDcOrder,
            requestedQuantity: quantityForDcOrder,
            employeeId: user?._id || idOf(dc.employeeId),
            requestedAt: new Date().toISOString(),
            isSplit: splitTerm2,
            term2DCId: splitTerm2 ? term2DC?._id : undefined,
            requestDcTermRouting: routing || undefined,
          },
        });
      } catch (err: any) {
        throw new Error(err?.message || 'Request DC did not reach Closed Sales. Please try Request DC again.');
      }

      showAlert(
        'Sent to Closed Sales',
        splitTerm2
          ? 'Term 1 sent to Closed Sales. Term 2 DC will appear in Term-Wise DC (BDE Dashboard).'
          : hasMixedTerms && routing === 'both_terms'
            ? 'Term 1 and Term 2 sent together to Closed Sales for Admin/Coordinator review.'
            : 'Request sent to Closed Sales. Admin/Coordinator will Raise DC; then it moves to Pending DC and warehouse.',
      );
      if (!navigateRoot('DCClient')) navigation.navigate('DCClient');
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to submit Client Request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!order) return null;

  if (order.status === 'dc_requested') {
    return (
      <ScreenShell title={`Request DC${order.school_name ? ` - ${order.school_name}` : ''}`} loading={loading}>
        <View style={styles.dcFlowBlock}>
          <Text style={styles.dcFlowBlockMessage}>
            This client was already sent to Closed Sales. Super Admin can review it under Closed Sales.
          </Text>
          <TouchableOpacity style={styles.dcFlowBlockButton} onPress={() => navigation.goBack()}>
            <Text style={styles.dcFlowBlockButtonText}>Back to My Clients</Text>
          </TouchableOpacity>
        </View>
      </ScreenShell>
    );
  }

  const setRowCategory = (id: string, category: string) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, category } : r)));

  const renderRow = (row: Row) => {
    const specs = getProductSpecs((row.product || "")).length === 0 && !isMarkerSpecs((row.product || ""), row.specs, getProductRelatedItems)
      ? ''
      : persistEditPoSpecs((row.product || ""), row.specs);
    return (
      <View key={row.id} style={styles.rowCard}>
        <View style={styles.rowTop}>
          <Text style={styles.rowProduct} numberOfLines={2}>
            {row.product || '-'}
            {row.subject ? ` · ${row.subject}` : ''}
          </Text>
          <Text style={styles.rowQty}>{requestDcRowQuantity(row)}</Text>
        </View>
        <Text style={styles.rowMeta}>
          Class {row.class || '-'}
          {row.section ? ` · Sec ${row.section}` : ''}
          {row.program ? ` · ${row.program}` : ''}
          {row.stream ? ` · ${row.stream}` : ''}
          {row.productCategory ? ` · ${row.productCategory}` : ''}
          {specs ? ` · ${specs}` : ''}
          {row.level && row.level !== '-' ? ` · ${row.level}` : ''}
        </Text>
        {isSpecimenRow(row) ? (
          <Text style={styles.rowTag}>Training Material · Specimen copy (No billing)</Text>
        ) : isRelatedItemRow(row) ? (
          <Text style={styles.rowTag}>
            Related item ·{' '}
            {dcRowCategoryOrDefault(row.category) === 'Training Material'
              ? 'Training Material (No billing)'
              : `Billable ₹${Number(row.unit_price) || 0}/unit`}
          </Text>
        ) : (
          <View style={{ marginTop: 6 }}>
            <DcCategoryPicker value={row.category} onChange={(c) => setRowCategory(row.id, c)} />
          </View>
        )}
      </View>
    );
  };

  const renderTable = (list: Row[], title: string, color?: string) =>
    list.length ? (
      <View style={styles.section} key={title}>
        <Text style={[styles.sectionTitle, color ? { color } : null]}>{title}</Text>
        {list.map(renderRow)}
        <Text style={styles.totalLine}>Total: {list.reduce((s, r) => s + requestDcRowQuantity(r), 0)}</Text>
      </View>
    ) : null;

  const bookCandidates = specimenCandidateProducts(rows.filter((r) => !isSpecimenRow(r) && !isRelatedItemRow(r)));
  const hasSpecimens = rows.some((r) => isSpecimenRow(r));

  return (
    <ScreenShell title={`Request DC${order.school_name ? ` - ${order.school_name}` : ''}`} loading={loading}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.subtitle}>Review details. Tap Request DC to move this to Closed Sales.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client / School</Text>
          <ReadOnlyField label="Client Name" value={order.school_name} />
          <ReadOnlyField label="Zone" value={order.zone} />
          <ReadOnlyField label="Contact" value={order.contact_person} />
          <ReadOnlyField label="Mobile" value={order.contact_mobile} />
          <ReadOnlyField label="Address" value={order.address || order.location} />
          <ReadOnlyField label="School type" value={order.school_type} />
          <ReadOnlyField label="PO Document" value={dc?.poPhotoUrl || order.pod_proof_url ? 'Attached' : 'Not attached'} />
        </View>

        {termSplit.hasMixedTerms ? (
          <>
            {renderTable(termSplit.term1Products as Row[], 'Term 1 Products', '#1D4ED8')}
            {renderTable(termSplit.term2Products as Row[], 'Term 2 Products', '#15803D')}
          </>
        ) : (
          renderTable(rows, 'Products')
        )}
        {rows.length === 0 ? <Text style={styles.hint}>No products on this DC.</Text> : null}

        {termSplit.hasMixedTerms ? (
          <View style={styles.routingBox}>
            <Text style={styles.routingTitle}>This DC has Term 1 and Term 2 products</Text>
            <Text style={styles.routingText}>
              Choose how to request DC. Term 1 only: Term 1 → Closed Sales, Term 2 → Term-Wise DC. Both terms: the
              full DC goes to Closed Sales together.
            </Text>
            <TouchableOpacity
              style={[styles.routeBtn, routing === 'both_terms' && styles.routeBtnOnBlue]}
              onPress={() => setRouting('both_terms')}
            >
              <Text style={[styles.routeBtnText, routing === 'both_terms' && styles.routeBtnTextOn]}>
                Both Term 1 & Term 2 → Closed Sales
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.routeBtn, routing === 'term1_only' && styles.routeBtnOnOrange]}
              onPress={() => setRouting('term1_only')}
            >
              <Text style={[styles.routeBtnText, routing === 'term1_only' && styles.routeBtnTextOn]}>
                Only Term 1 → Closed Sales (Term 2 → Term-Wise DC)
              </Text>
            </TouchableOpacity>
            {routing === 'both_terms' ? (
              <Text style={styles.routingNote}>All products above will be requested as one DC in Closed Sales.</Text>
            ) : null}
            {routing === 'term1_only' ? (
              <Text style={styles.routingNote}>
                Only Term 1 products go to Closed Sales now; Term 2 will appear under Term-Wise DC for a later request.
              </Text>
            ) : null}
          </View>
        ) : null}

        {rows.some((r) => !isSpecimenRow(r)) ? (
          <View style={styles.specimenBox}>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() =>
                setRows((list) => {
                  const books = list.filter((r) => !isSpecimenRow(r));
                  return hasSpecimens ? books : withSpecimenRows(books, specimenProducts);
                })
              }
            >
              <View style={[styles.checkBox, hasSpecimens && styles.checkBoxOn]}>
                {hasSpecimens ? <Text style={styles.tick}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkTitle}>Specimen copies requested</Text>
                <Text style={styles.hint}>
                  Adds each product's specimen set (the products set on the product, or one set as per DC list) as
                  Training Material (no billing).
                </Text>
              </View>
            </TouchableOpacity>
            {hasSpecimens ? (
              <>
                <SpecimenProductPicker
                  products={bookCandidates}
                  selected={specimenProducts ?? bookCandidates}
                  onChange={(next) => {
                    setSpecimenProducts(next);
                    setRows((list) => withSpecimenRows(list.filter((r) => !isSpecimenRow(r)), next));
                  }}
                  getItems={getProductSpecimenItems}
                  chosenItems={specimenItemChoice}
                  onItemsChange={(next) => {
                    setSpecimenItemChoice(next);
                    setRows((list) => withSpecimenRows(list.filter((r) => !isSpecimenRow(r)), specimenProducts, next));
                  }}
                />
                <WebLabel>Sets per product *</WebLabel>
                <WebInput
                  keyboardType="number-pad"
                  value={specimenCopiesInput}
                  onChangeText={(t) => {
                    setSpecimenCopiesInput(t);
                    const qty = specimenCopiesValue(t);
                    setRows((list) =>
                      list.map((r) => {
                        if (!isSpecimenRow(r)) return r;
                        const rowQty = specimenRowQuantity(r, qty, getProductSpecimenItems);
                        return { ...r, quantity: rowQty, strength: rowQty };
                      }),
                    );
                  }}
                  onBlur={() => setSpecimenCopiesInput(String(specimenCopiesValue(specimenCopiesInput)))}
                />
              </>
            ) : null}
          </View>
        ) : null}

        {requestAbacusStrength > 0 ? (
          <AbacusMaterialsFields
            studentQuantity={requestAbacusStrength}
            masterQuantity={requestMasterQuantityValue}
            masterQuantityInput={requestMasterQuantity ?? String(requestMasterQuantityValue)}
            onMasterQuantityChange={setRequestMasterQuantity}
            masterUnitPrice={requestMasterUnitPrice}
            onMasterUnitPriceChange={setRequestMasterUnitPrice}
            hint={`Default Master Abacus: ${defaultMasterAbacusQuantity(requestAbacusStrength)}. Adjust the quantity if required. Below 100 students, an added Master Abacus must have a price.`}
          />
        ) : null}

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.stickyFooter}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.requestButton,
            (submitting || (termSplit.hasMixedTerms && !routing)) && styles.buttonDisabled,
          ]}
          onPress={handleRequestDC}
          disabled={submitting || (termSplit.hasMixedTerms && !routing)}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textLight} />
          ) : (
            <Text style={styles.requestButtonText}>Request DC</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 24 },
  subtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 20 },
  hint: { ...typography.body.small, color: colors.textSecondary, marginBottom: 6 },
  section: { marginBottom: 24 },
  sectionTitle: { ...typography.heading.h4, color: colors.textPrimary, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { ...typography.label.small, color: colors.textSecondary, marginBottom: 4 },
  readOnlyValue: {
    ...typography.body.medium,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundDark,
    padding: 12,
    borderRadius: 8,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.backgroundLight,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rowProduct: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowQty: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowTag: { fontSize: 12, color: colors.textTertiary, marginTop: 6 },
  totalLine: { textAlign: 'right', fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  routingBox: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  routingTitle: { fontSize: 15, fontWeight: '700', color: '#78350F' },
  routingText: { fontSize: 13, color: '#78350F' },
  routingNote: { fontSize: 12, color: colors.textSecondary },
  routeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.backgroundLight,
  },
  routeBtnOnBlue: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  routeBtnOnOrange: { backgroundColor: '#EA580C', borderColor: '#EA580C' },
  routeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  routeBtnTextOn: { color: '#fff' },
  specimenBox: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12, marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  spacer: { height: 24 },
  stickyFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: colors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButtonText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  requestButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  requestButtonText: { ...typography.heading.h4, color: colors.textLight, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  dcFlowBlock: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
  dcFlowBlockMessage: { ...typography.body.medium, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  dcFlowBlockButton: { paddingVertical: 14, paddingHorizontal: 24, backgroundColor: colors.primary, borderRadius: 12 },
  dcFlowBlockButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
});
