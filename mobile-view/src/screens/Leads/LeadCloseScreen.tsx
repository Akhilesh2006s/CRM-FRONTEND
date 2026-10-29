/**
 * Close Lead — mobile port of the web app/dashboard/leads/close/[id]/page.tsx.
 * Same sequence as the web: close the lead (PUT /leads/:id, or PUT /dc-orders/:id + lead upsert),
 * then POST /dc/raise with the billed product rows, then POST /dc/:id/submit-po.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { getRoleFlags } from '../../utils/roles';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebLabel, WebSelect } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import MessageBanner from '../../components/MessageBanner';
import { navigateRoot } from '../../navigation/navigationRef';
import CloseLeadProductsModal from './CloseLeadProductsModal';
import { useCloseLeadProductConfig } from '../../components/leads/useCloseLeadProductConfig';
import CheckRow from '../../components/leads/CheckRow';
import {
  SpecimenProductPicker,
  specimenCandidateProducts,
} from '../../components/leads/SpecimenProductPicker';
import { AbacusMaterialsFields } from '../../components/leads/AbacusMaterialsFields';
import { persistProductTerm } from '../../lib/crm/productTerm';
import { partitionProductsForCloseLeadRouting } from '../../lib/crm/closeLeadTermRouting';
import { billedProductDetailRows } from '../../lib/crm/closeLeadProductConfig';
import { abacusStudentStrength, defaultMasterAbacusQuantity } from '../../lib/crm/abacusMaterials';
import {
  buildRelatedItemRows,
  buildSpecimenRows,
  isRelatedItemRow,
  isSpecimenRow,
  specimenCopiesValue,
  type SpecimenItemChoice,
} from '../../lib/crm/dcRowCategory';
import { renewalLinesToSections } from '../../lib/crm/renewalCloseSections';

/** Same as the web Close Lead page: e.g. 2026 → "2026-2027". */
const getCurrentAcademicYear = () => {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
};

type SplitPreview = {
  term1: { productName: string; strength: number }[];
  term2: { productName: string; strength: number }[];
};

export default function LeadCloseScreen({ route }: any) {
  const leadId = route?.params?.id ? String(route.params.id) : '';
  const { user } = useAuth();
  const currentUserId = String(user?._id || (user as any)?.id || '');
  const isSuperAdmin = getRoleFlags(user).isSuperAdmin || Boolean((user as any)?.isSuperAdmin);
  const currentAcademicYear = getCurrentAcademicYear();

  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([]);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [assignedEmployeeName, setAssignedEmployeeName] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /** True when the record was loaded from /dc-orders (not /leads). */
  const [isDcOrderRecord, setIsDcOrderRecord] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    contact_person2: '',
    contact_mobile2: '',
    financial_contact_designation: '',
    delivery_date: '',
    year: currentAcademicYear,
  });
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);

  const [poPhotoUrl, setPoPhotoUrl] = useState('');
  const [uploadingPO, setUploadingPO] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitPreview, setSplitPreview] = useState<SplitPreview | null>(null);
  const [pendingSubmissionContext, setPendingSubmissionContext] = useState<{
    dcProductDetails: any[];
    totalQuantity: number;
  } | null>(null);
  const [masterQuantityOverride, setMasterQuantityOverride] = useState<string | null>(null);
  const [masterUnitPrice, setMasterUnitPrice] = useState('');
  const [specimenRequested, setSpecimenRequested] = useState(false);
  const [specimenCopies, setSpecimenCopies] = useState('1');
  /** Products that get specimen copies; null = every product. */
  const [specimenProducts, setSpecimenProducts] = useState<string[] | null>(null);
  /** Items ticked from each product's specimen set; a product missing here sends its whole set. */
  const [specimenItemChoice, setSpecimenItemChoice] = useState<SpecimenItemChoice>({});

  const productConfig = useCloseLeadProductConfig({ schoolType: lead?.school_type });
  const {
    productDetails,
    setProductSections,
    childProductRows,
    groupedChildProductRows,
    getDefaultLevel,
    getProductCategories,
    hasProductCategories,
    validateProducts,
    buildDcOrderProducts,
    getCalculationType,
    getCatalogFallbackCount,
    getProductRelatedItems,
    getProductSpecimenItems,
  } = productConfig;
  const abacusStrength = lead?.school_type === 'Existing' ? 0 : abacusStudentStrength(childProductRows);
  const masterQuantity =
    masterQuantityOverride === null
      ? defaultMasterAbacusQuantity(abacusStrength)
      : Number(masterQuantityOverride) || 0;

  useEffect(() => {
    if (leadId) void loadLead();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const roles = ['Executive', 'Sales BDE', 'Employee'];
    Promise.all(
      roles.map((role) =>
        apiService.get(`/employees?isActive=true&role=${encodeURIComponent(role)}`).catch(() => []),
      ),
    ).then((batches) => {
      const seen = new Set<string>();
      const list: { _id: string; name: string }[] = [];
      for (const raw of batches) {
        const batch = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        for (const u of batch) {
          const id = String(u?._id || u?.id || '');
          const name = String(u?.name || '').trim();
          if (!id || !name || seen.has(id)) continue;
          seen.add(id);
          list.push({ _id: id, name });
        }
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
      setEmployees(list);
    });
  }, [isSuperAdmin]);

  const loadLead = async () => {
    setLoading(true);
    try {
      // Same order as the web: dc-orders first, then leads.
      let leadData: any = null;
      try {
        leadData = await apiService.get(`/dc-orders/${leadId}`);
        setIsDcOrderRecord(true);
      } catch {
        leadData = await apiService.get(`/leads/${leadId}`);
        setIsDcOrderRecord(false);
      }
      if (leadData) {
        setLead(leadData);
        const assigned = leadData.assigned_to;
        const assignedId = assigned && typeof assigned === 'object' ? assigned._id : assigned;
        if (assignedId) setAssignedEmployeeId(String(assignedId));
        if (assigned && typeof assigned === 'object' && assigned.name) setAssignedEmployeeName(String(assigned.name));
        setForm({
          contact_person2: leadData.contact_person2 || leadData.decision_maker || '',
          contact_mobile2: leadData.contact_mobile2 || '',
          financial_contact_designation: leadData.financial_contact_designation || '',
          // PO dispatch date must be an explicit user decision.
          delivery_date: '',
          year: currentAcademicYear,
        });
        const hasProducts =
          (Array.isArray(leadData.products) && leadData.products.length > 0) ||
          (typeof leadData.products === 'string' && leadData.products.trim());
        if (hasProducts) {
          // Fresh leads open with no sections (BDE adds them with "Add section").
          // Renewal leads open with last year's class lines.
          // Only renewal leads: every saved product line carries a class (it defaults to "1"),
          // so pre-filling from any lead would add a section per product.
          const leadProducts: any[] = Array.isArray(leadData.products) ? leadData.products : [];
          const isRenewalLead =
            leadData.lead_type === 'renewal' || leadProducts.some((p) => p?.sale_type === 'renewal');
          const renewal = renewalLinesToSections(isRenewalLead ? leadProducts.filter((p) => p?.sale_type !== 'cross_sale') : []);
          setProductSections(renewal.sections);
        } else {
          setProductSections([]);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  const uploadPoAsset = async (asset: any) => {
    const name = String(asset.name || 'po.pdf');
    const nameLooksPdf = name.toLowerCase().endsWith('.pdf');
    const mime = String(asset.mimeType || asset.type || '');
    if (mime && mime !== 'application/pdf' && !(mime === 'application/octet-stream' && nameLooksPdf)) {
      setError('Please upload a PDF file only');
      return;
    }
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }
    setUploadingPO(true);
    setError(null);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        let fileObj: File | Blob | null = asset.file instanceof File ? asset.file : null;
        if (!fileObj && asset.uri) {
          const res = await fetch(asset.uri);
          fileObj = await res.blob();
        }
        if (!fileObj) throw new Error('Could not read the selected PDF.');
        formData.append('poPhoto', fileObj, nameLooksPdf ? name : 'po.pdf');
      } else {
        formData.append('poPhoto', {
          uri: asset.uri,
          type: 'application/pdf',
          name: nameLooksPdf ? name : 'po.pdf',
        } as any);
      }
      const data = await apiService.upload('/dc/upload-po', formData);
      const url = data.poPhotoUrl || data.url || '';
      if (!url) throw new Error('Failed to upload PO document');
      setPoPhotoUrl(url);
      setNotice('PO document uploaded successfully');
    } catch (err: any) {
      setPoPhotoUrl('');
      setError(err?.message || 'Failed to upload PO document');
    } finally {
      setUploadingPO(false);
    }
  };

  const pickPOPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      await uploadPoAsset(result.assets[0]);
    } catch (err: any) {
      setError(err?.message || 'Failed to pick document');
    }
  };

  const handleWebPoFile = async (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    await uploadPoAsset({ file, name: file.name, mimeType: file.type, size: file.size });
    e.target.value = '';
  };

  const buildDcProductDetails = () => {
    const actualProductDetails = billedProductDetailRows(childProductRows, getCalculationType, getCatalogFallbackCount);
    const rows = actualProductDetails.map((p) => {
      const parentRow = productDetails.find((parent) => parent.isParentRow && p.id.startsWith(parent.id + '_'));
      const deliverables = parentRow?.selectedDeliverables || [];
      const levelValue = p.level || getDefaultLevel(p.product);
      const skuCats = hasProductCategories(p.product) ? getProductCategories(p.product) : [];
      const catStr = typeof p.category === 'string' ? p.category.trim() : '';
      const isSkuCategory = skuCats.some((c) => c.toLowerCase() === catStr.toLowerCase());
      // Billed book rows; renewal schools are billed the same way as new students.
      const enrollmentCategory = 'New Students';
      return {
        product: p.product,
        class: p.class || '1',
        section: p.section || undefined,
        program: p.program || undefined,
        stream: p.stream || undefined,
        category: isSkuCategory
          ? enrollmentCategory
          : p.category ||
            (hasProductCategories(p.product)
              ? getProductCategories(p.product)[0] || enrollmentCategory
              : enrollmentCategory),
        productCategory: isSkuCategory ? catStr : (p as any).productCategory || undefined,
        quantity: Number(p.quantity) || 0,
        strength: Number(p.strength) || 0,
        price: Number(p.price) || 0,
        total: Number(p.total) || 0,
        level: levelValue,
        specs: p.specs || '',
        subject: p.subject || undefined,
        subjectPackage: Boolean(p.subjectPackage),
        deliverables,
        term: persistProductTerm({
          term: (p as any).term || (parentRow as any)?.term,
          level: levelValue,
        }),
        dispatchMode: p.dispatchMode || parentRow?.dispatchMode,
      };
    });
    // Product related items (Tensmat, Teacher Books, Flash Cards, ...) always ship with the product.
    const withRelatedItems = [...rows, ...buildRelatedItemRows(rows, getProductRelatedItems)];
    return specimenRequested
      ? [
          ...withRelatedItems,
          ...buildSpecimenRows(
            specimenProducts ? rows.filter((row) => specimenProducts.includes(String(row.product || ''))) : rows,
            specimenCopiesValue(specimenCopies),
            { getSpecimenItems: getProductSpecimenItems, chosenItems: specimenItemChoice },
          ).map((row) => ({ ...row, deliverables: [] })),
        ]
      : withRelatedItems;
  };

  /** Split dialog line: product, class/section/stream and level, flagging specimen and related-item rows. */
  const splitPreviewName = (p: any) => {
    const where = [
      p.class ? `Cl ${p.class}${p.section && p.section !== 'ALL' ? p.section : ''}` : '',
      p.program,
      p.stream,
    ]
      .filter(Boolean)
      .join(' ');
    const stage = p.level ? p.level : p.term || '';
    const kind = isSpecimenRow(p) ? ' · Specimen copy' : isRelatedItemRow(p) ? ` · ${p.specs || 'Related item'}` : '';
    return `${p.productName || p.product}${where ? ` ${where}` : ''}${stage ? ` (${stage})` : ''}${kind}`;
  };

  /** Mark lead/order closed, then raise DC. Only call after user confirms any split dialog. */
  const closeRecordAndRaiseDc = async (dcProductDetails: any[], totalQuantity: number) => {
    if (!currentUserId) throw new Error('User not found. Please login again.');
    const mobileErr = phoneDigitsError(lead?.contact_mobile || '', true);
    if (mobileErr) throw new Error(mobileErr);
    const decisionMobile = String(form.contact_mobile2 || '').trim();
    if (decisionMobile) {
      const decisionErr = phoneDigitsError(decisionMobile, true);
      if (decisionErr) throw new Error(decisionErr);
    }

    const closingEmployeeId = isSuperAdmin ? assignedEmployeeId : currentUserId;
    if (!closingEmployeeId) throw new Error('Select the BDE this close is assigned to.');

    const updatePayload: any = {
      school_name: lead?.school_name || undefined,
      contact_person: lead?.contact_person || undefined,
      contact_mobile: lead?.contact_mobile || undefined,
      email: lead?.email || undefined,
      contact_person2: form.contact_person2 || undefined,
      contact_mobile2: form.contact_mobile2 || undefined,
      financial_contact_designation: form.financial_contact_designation || undefined,
      estimated_delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : undefined,
      year: currentAcademicYear,
      assigned_to: closingEmployeeId,
      products: buildDcOrderProducts(),
    };

    if (isDcOrderRecord) {
      updatePayload.status = 'saved';
      const updated = await apiService.put(`/dc-orders/${leadId}`, updatePayload);
      try {
        const searchResponse = await apiService.get(
          `/leads?schoolName=${encodeURIComponent(lead?.school_name || '')}&contactMobile=${lead?.contact_mobile || ''}`,
        );
        const allLeads = Array.isArray(searchResponse) ? searchResponse : searchResponse?.data || [];
        const existingLead = allLeads.find(
          (l: any) => l.school_name === lead?.school_name && l.contact_mobile === lead?.contact_mobile,
        );
        const clientSchoolCode = updated?.school_code || lead?.school_code || '';
        if (existingLead) {
          await apiService.put(`/leads/${existingLead._id}`, {
            status: 'Closed',
            year: currentAcademicYear,
            ...(clientSchoolCode ? { school_code: clientSchoolCode } : {}),
            school_id: updated?._id,
          });
        } else {
          await apiService.post('/leads/create', {
            school_name: lead?.school_name || updated?.school_name,
            school_code: clientSchoolCode || undefined,
            school_id: updated?._id,
            contact_person: lead?.contact_person || updated?.contact_person,
            contact_mobile: lead?.contact_mobile || updated?.contact_mobile,
            email: lead?.email || updated?.email || undefined,
            zone: lead?.zone || updated?.zone,
            location: lead?.location || updated?.location,
            priority: lead?.priority || updated?.priority || 'Hot',
            year: currentAcademicYear,
            status: 'Closed',
            createdBy: closingEmployeeId,
          });
        }
      } catch (leadUpdateErr: any) {
        console.warn('Could not update/create Lead record for reporting:', leadUpdateErr?.message);
      }
    } else {
      updatePayload.status = 'Closed';
      await apiService.put(`/leads/${leadId}`, updatePayload);
    }

    const dcPayload: any = {
      dcOrderId: leadId,
      dcDate: form.delivery_date || new Date().toISOString(),
      dcRemarks: `Lead converted to client - ${lead?.school_name}`,
      dcCategory: lead?.school_type === 'Existing' ? 'Existing School' : 'New School',
      requestedQuantity: totalQuantity,
      employeeId: closingEmployeeId,
      productDetails: dcProductDetails,
      ...(abacusStrength > 0
        ? {
            abacusMaterials: {
              masterAbacusQuantity: masterQuantity,
              masterAbacusUnitPrice: Number(masterUnitPrice) || 0,
            },
          }
        : {}),
      status: 'created',
    };
    if (poPhotoUrl) {
      dcPayload.poPhotoUrl = poPhotoUrl;
      dcPayload.poDocument = poPhotoUrl;
    }

    const dc = await apiService.post('/dc/raise', dcPayload);

    if (poPhotoUrl && dc?._id) {
      try {
        await apiService.post(`/dc/${dc._id}/submit-po`, { poPhotoUrl });
      } catch (poErr) {
        console.error('Failed to submit PO:', poErr);
      }
    }

    setNotice('Lead converted to client! DC created and submitted to My Clients successfully.');
    navigateRoot('DCClient', dc?._id ? { newlyConvertedDCId: dc._id } : undefined);
  };

  const handleSplitConfirm = async () => {
    if (!pendingSubmissionContext) return;
    setSubmitting(true);
    setError(null);
    try {
      await closeRecordAndRaiseDc(pendingSubmissionContext.dcProductDetails, pendingSubmissionContext.totalQuantity);
      setSplitModalOpen(false);
      setSplitPreview(null);
      setPendingSubmissionContext(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to convert lead to client');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSplitCancel = () => {
    setSplitModalOpen(false);
    setSplitPreview(null);
    setPendingSubmissionContext(null);
    setSubmitting(false);
    setError(null);
  };

  const handleTurnToClient = async () => {
    if (!lead) return;
    setError(null);
    setNotice(null);

    const productValidation = validateProducts();
    if (!productValidation.ok) {
      setError(productValidation.message);
      return;
    }
    if (!form.delivery_date || form.delivery_date.trim() === '') {
      setError('Delivery date is required. Pick a date in the Delivery Date field above.');
      return;
    }
    if (!poPhotoUrl || poPhotoUrl.trim() === '') {
      setError('PO document is required. Upload a PDF in the PO Document section above, then try again.');
      return;
    }
    if (!currentUserId) {
      setError('User not found. Please login again.');
      return;
    }
    if (abacusStrength > 0 && masterQuantity > 0 && abacusStrength < 100 && !(Number(masterUnitPrice) > 0)) {
      setError('Enter a Master Abacus price when adding it below 100 students.');
      productConfig.setProductDialogOpen(true);
      return;
    }

    const dcProductDetails = buildDcProductDetails();
    const totalQuantity = groupedChildProductRows.reduce((sum, p) => sum + (p.strength || 0), 0);
    const { myClientsProducts, termWiseProducts, needsTermWiseSplit } =
      partitionProductsForCloseLeadRouting(dcProductDetails);

    // Show split preview first — do NOT close the lead until Confirm & Submit.
    if (needsTermWiseSplit) {
      setSplitPreview({
        term1: myClientsProducts.map((p: any) => ({
          productName: splitPreviewName(p),
          strength: p.strength || p.quantity || 0,
        })),
        term2: termWiseProducts.map((p: any) => ({
          productName: splitPreviewName(p),
          strength: p.strength || p.quantity || 0,
        })),
      });
      setPendingSubmissionContext({ dcProductDetails, totalQuantity });
      setSplitModalOpen(true);
      return;
    }

    setSubmitting(true);
    try {
      await closeRecordAndRaiseDc(dcProductDetails, totalQuantity);
    } catch (err: any) {
      setError(err?.message || 'Failed to convert lead to client');
    } finally {
      setSubmitting(false);
    }
  };

  const employeeOptions = useMemo(() => {
    const list =
      assignedEmployeeId && !employees.some((e) => e._id === assignedEmployeeId)
        ? [{ _id: assignedEmployeeId, name: assignedEmployeeName || 'Assigned BDE' }, ...employees]
        : employees;
    return list.map((e) => ({ label: e.name, value: e._id }));
  }, [employees, assignedEmployeeId, assignedEmployeeName]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading lead details...</Text>
      </View>
    );
  }

  if (error && !lead) {
    return (
      <ScreenShell title="Close Lead">
        <MessageBanner type="error" message={error} />
      </ScreenShell>
    );
  }

  const candidateProducts = specimenCandidateProducts(childProductRows);
  const dialogExtra =
    childProductRows.length > 0 ? (
      <View>
        <View style={styles.extraBox}>
          <CheckRow
            checked={specimenRequested}
            onChange={setSpecimenRequested}
            label="Specimen copies requested"
            hint="Adds each product's specimen set (the products set on the product, or one set as per DC list) as Training Material (no billing)."
          />
          {specimenRequested ? (
            <>
              <SpecimenProductPicker
                products={candidateProducts}
                selected={specimenProducts ?? candidateProducts}
                onChange={setSpecimenProducts}
                getItems={getProductSpecimenItems}
                chosenItems={specimenItemChoice}
                onItemsChange={setSpecimenItemChoice}
              />
              <View style={{ marginTop: 8, width: 160 }}>
                <WebLabel>Sets per product *</WebLabel>
                <WebInput
                  keyboardType="number-pad"
                  value={specimenCopies}
                  onChangeText={(v) => setSpecimenCopies(v.replace(/[^\d]/g, ''))}
                  onBlur={() => setSpecimenCopies(String(specimenCopiesValue(specimenCopies)))}
                />
              </View>
            </>
          ) : null}
        </View>
        {abacusStrength > 0 ? (
          <AbacusMaterialsFields
            studentQuantity={abacusStrength}
            masterQuantity={masterQuantity}
            masterQuantityInput={masterQuantityOverride ?? String(masterQuantity)}
            onMasterQuantityChange={setMasterQuantityOverride}
            masterUnitPrice={masterUnitPrice}
            onMasterUnitPriceChange={setMasterUnitPrice}
            hint={`Default Master Abacus: ${defaultMasterAbacusQuantity(abacusStrength)}. Adjust the quantity if required. Below 100 students, an added Master Abacus must have a price.`}
          />
        ) : null}
      </View>
    ) : null;

  const rowCount = productDetails.filter((pd) => !pd.isParentRow).length;

  return (
    <ScreenShell title="Close Lead" subtitle="Fill in the details to close this lead and convert to client">
      {error ? <MessageBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}
      {notice ? <MessageBanner type="success" message={notice} onDismiss={() => setNotice(null)} /> : null}

      {isSuperAdmin ? (
        <WebSelect
          label="Assign to (BDE) *"
          value={assignedEmployeeId}
          onValueChange={setAssignedEmployeeId}
          items={employeeOptions}
          placeholder={employeeOptions.length === 0 ? 'No BDEs found' : 'Select BDE'}
        />
      ) : null}

      <Field label="School Name" value={lead?.school_name || ''} onChangeText={(t: string) => setLead({ ...lead, school_name: t })} />
      <Field label="Person 1" value={lead?.contact_person || ''} onChangeText={(t: string) => setLead({ ...lead, contact_person: t })} />
      <Field
        label="Email 1"
        value={lead?.email || ''}
        keyboardType="email-address"
        onChangeText={(t: string) => setLead({ ...lead, email: t })}
      />
      <Field
        label="Mob 1"
        value={lead?.contact_mobile || ''}
        keyboardType="phone-pad"
        maxLength={15}
        placeholder="10 to 15 digits"
        onChangeText={(t: string) => setLead({ ...lead, contact_mobile: sanitizePhoneDigits(t) })}
      />
      <Field
        label="Financial contact person"
        value={form.contact_person2}
        placeholder="Enter financial contact name"
        onChangeText={(t: string) => setForm({ ...form, contact_person2: t })}
      />
      <Field
        label="Financial contact mobile"
        value={form.contact_mobile2}
        keyboardType="phone-pad"
        maxLength={15}
        placeholder="10 to 15 digits"
        onChangeText={(t: string) => setForm({ ...form, contact_mobile2: sanitizePhoneDigits(t) })}
      />
      <Field
        label="Financial contact designation"
        value={form.financial_contact_designation}
        placeholder="e.g. Accountant"
        onChangeText={(t: string) => setForm({ ...form, financial_contact_designation: t })}
      />

      <View style={styles.fieldContainer}>
        <WebLabel>Delivery Date *</WebLabel>
        {Platform.OS === 'web' ? (
          React.createElement('input', {
            type: 'date',
            value: form.delivery_date || '',
            onChange: (e: any) => setForm((f) => ({ ...f, delivery_date: e.target.value })),
            style: {
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: 15,
              backgroundColor: '#fff',
              boxSizing: 'border-box',
            },
          })
        ) : (
          <TouchableOpacity style={styles.dateTouchable} onPress={() => setShowDeliveryDatePicker(true)} activeOpacity={0.7}>
            <Text style={[styles.dateText, !form.delivery_date && styles.datePlaceholder]}>
              {form.delivery_date || 'Tap to pick date'}
            </Text>
            <Text style={styles.dateIcon}>📅</Text>
          </TouchableOpacity>
        )}
      </View>
      {showDeliveryDatePicker ? (
        Platform.OS === 'android' ? (
          <DateTimePicker
            value={form.delivery_date ? new Date(form.delivery_date) : new Date()}
            mode="date"
            display="calendar"
            onChange={(_, selectedDate) => {
              setShowDeliveryDatePicker(false);
              if (selectedDate) setForm((f) => ({ ...f, delivery_date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` }));
            }}
          />
        ) : (
          <Modal visible transparent animationType="slide">
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowDeliveryDatePicker(false)} />
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Delivery Date</Text>
                <TouchableOpacity onPress={() => setShowDeliveryDatePicker(false)}>
                  <Text style={styles.datePickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={form.delivery_date ? new Date(form.delivery_date) : new Date()}
                mode="date"
                display="spinner"
                onChange={(_, selectedDate) => {
                  if (selectedDate) setForm((f) => ({ ...f, delivery_date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` }));
                }}
                style={{ height: 200 }}
              />
            </View>
          </Modal>
        )
      ) : null}

      <Field label="Select Year" value={form.year} editable={false} />

      <View style={[styles.fieldContainer, styles.borderTop]}>
        <WebLabel>PO Document *</WebLabel>
        {poPhotoUrl ? (
          <View style={styles.poRow}>
            <View style={styles.pdfBadge}>
              <Text style={styles.pdfBadgeText}>PDF</Text>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => setPoPhotoUrl('')}>
              <Text style={styles.removeBtnText}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        ) : Platform.OS === 'web' ? (
          <View>
            {React.createElement('input', {
              type: 'file',
              accept: 'application/pdf',
              disabled: uploadingPO,
              onChange: handleWebPoFile,
              style: { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0', backgroundColor: '#fff' },
            })}
            <Text style={styles.hint}>{uploadingPO ? 'Uploading...' : 'Accepted: PDF only (max 5MB)'}</Text>
          </View>
        ) : (
          <View>
            <TouchableOpacity style={styles.uploadButton} onPress={pickPOPhoto} disabled={uploadingPO}>
              <Text style={styles.uploadButtonText}>{uploadingPO ? 'Uploading...' : '📄 Upload PO Document (PDF)'}</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>Accepted: PDF only (max 5MB)</Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.addProductsButton} onPress={() => productConfig.setProductDialogOpen(true)}>
        <Text style={styles.addProductsButtonText}>📦 ADD PRODUCTS {rowCount > 0 ? `(${rowCount})` : ''}</Text>
      </TouchableOpacity>

      {childProductRows.length > 0 ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Products</Text>
          {groupedChildProductRows.map((row, idx) => (
            <Text key={`${row.product}_${row.class}_${idx}`} style={styles.summaryLine}>
              • {row.product} · Cl {row.class}
              {row.section && row.section !== 'ALL' ? row.section : ''}
              {row.level ? ` · ${row.level}` : ''} — {row.strength} students
            </Text>
          ))}
          {specimenRequested ? <Text style={styles.summaryLine}>• Specimen copies requested</Text> : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.turnToClientButton, submitting && styles.disabled]}
        onPress={handleTurnToClient}
        disabled={submitting}
        activeOpacity={0.8}
      >
        <Text style={styles.turnToClientButtonText}>{submitting ? 'Processing...' : '✓ Upload PO'}</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <CloseLeadProductsModal config={productConfig} dialogExtra={dialogExtra} />

      <Modal visible={splitModalOpen} transparent animationType="fade" onRequestClose={handleSplitCancel}>
        <View style={styles.splitOverlay}>
          <View style={styles.splitCard}>
            <Text style={styles.splitTitle}>This lead will be split into 2 DCs</Text>
            <Text style={styles.splitSubtitle}>
              Level/Term 1 goes to My Clients. Level/Term 2 goes to Term-Wise DC. Scroll the list if needed, then tap
              Confirm & Submit below to continue.
            </Text>
            <ScrollView style={styles.splitScroll} nestedScrollEnabled>
              <View style={styles.splitBlock}>
                <Text style={styles.splitBlockTitleTerm1}>DC 1 – My Clients (Term 1 / Level 1)</Text>
                {(splitPreview?.term1 || []).length === 0 ? (
                  <Text style={styles.splitProduct}>No Term 1 / Level 1 lines</Text>
                ) : (
                  splitPreview!.term1.map((p, i) => (
                    <View key={`t1-${i}`} style={styles.splitRow}>
                      <Text style={styles.splitProduct}>• {p.productName}</Text>
                      <Text style={styles.splitQty}>Qty: {p.strength}</Text>
                    </View>
                  ))
                )}
              </View>
              <View style={styles.splitBlock}>
                <Text style={styles.splitBlockTitleTerm2}>DC 2 – Term Wise DC (Term 2 / Level 2)</Text>
                {(splitPreview?.term2 || []).length === 0 ? (
                  <Text style={styles.splitProduct}>No Term 2 / Level 2 lines</Text>
                ) : (
                  splitPreview!.term2.map((p, i) => (
                    <View key={`t2-${i}`} style={styles.splitRow}>
                      <Text style={styles.splitProduct}>• {p.productName}</Text>
                      <Text style={styles.splitQty}>Qty: {p.strength}</Text>
                    </View>
                  ))
                )}
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>
            <View style={styles.splitFooter}>
              <TouchableOpacity style={styles.splitCancelBtn} onPress={handleSplitCancel} disabled={submitting}>
                <Text style={styles.splitCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.splitConfirmBtn, submitting && styles.disabled]}
                onPress={handleSplitConfirm}
                disabled={submitting}
              >
                <Text style={styles.splitConfirmText}>{submitting ? 'Submitting...' : 'Confirm & Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, maxLength, editable }: any) {
  return (
    <View style={styles.fieldContainer}>
      <WebLabel>{label}</WebLabel>
      <WebInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        maxLength={maxLength}
        editable={editable !== false}
        style={editable === false ? styles.readOnly : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  fieldContainer: { marginBottom: 4 },
  readOnly: { backgroundColor: colors.backgroundMuted, color: colors.textSecondary },
  borderTop: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4 },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6, marginBottom: 8 },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  dateText: { fontSize: 15, color: colors.textPrimary },
  datePlaceholder: { color: colors.textMuted },
  dateIcon: { fontSize: 18 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  datePickerContainer: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  datePickerTitle: { ...typography.heading.h3, color: colors.textPrimary },
  datePickerDone: { ...typography.label.medium, color: colors.primary, fontWeight: '600' },
  poRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  pdfBadge: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBadgeText: { fontSize: 14, fontWeight: '700', color: colors.error },
  removeBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  removeBtnText: { color: colors.textPrimary, fontWeight: '600' },
  uploadButton: { backgroundColor: colors.primary, borderRadius: 8, padding: 12, alignItems: 'center' },
  uploadButtonText: { color: colors.textLight, fontWeight: '600' },
  addProductsButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: '#fff',
  },
  addProductsButtonText: { color: colors.primary, fontWeight: '700' },
  extraBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginTop: 12, backgroundColor: '#fff' },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: colors.backgroundLight,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  summaryLine: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  turnToClientButton: {
    backgroundColor: colors.success,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  turnToClientButtonText: { color: colors.textLight, fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: 24 },
  splitOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  splitCard: { width: '100%', maxWidth: 420, maxHeight: '85%', backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 20 },
  splitTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 6 },
  splitSubtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  splitScroll: { maxHeight: 360, marginBottom: 8 },
  splitBlock: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 12 },
  splitBlockTitleTerm1: { ...typography.body.medium, color: '#15803d', fontWeight: '700', marginBottom: 8 },
  splitBlockTitleTerm2: { ...typography.body.medium, color: '#1d4ed8', fontWeight: '700', marginBottom: 8 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  splitProduct: { ...typography.body.small, color: colors.textSecondary, flex: 1, paddingRight: 8 },
  splitQty: { ...typography.body.small, color: colors.textSecondary },
  splitFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 10 },
  splitCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundLight,
  },
  splitCancelText: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  splitConfirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.success },
  splitConfirmText: { ...typography.body.medium, color: colors.textLight, fontWeight: '700' },
});
