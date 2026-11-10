import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebSelect, WebLabel, WebButton } from '../../ui/WebPrimitives';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import EmployeeTaggingPicker, { supportsEmployeeTagging } from '../../components/EmployeeTaggingPicker';

import DateField from '../../ui/DateField';
import { bankDetailsError, bankDetailsFromEmployee, bankDetailsPayload, emptyBankDetails } from '../../utils/bankDetails';
import { employeeDateYmd, employeeDocName, openEmployeeDoc } from '../../utils/employeeDocs';
import {
  ONBOARDING_ITEMS,
  PERMANENT_ADDRESS_FIELDS,
  emptyPermanentAddress,
  employeeDesignation,
  formatPermanentAddress,
  isBlankPermanentAddress,
  onboardingError,
  onboardingFromSaved,
  permanentAddressError,
  permanentAddressFromSaved,
  productsLeftForTraining,
  type PermanentAddressDetails,
} from '../../utils/employeeHrms';
/** User types, same values / labels as web app/dashboard/employees/new/page.tsx */
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Executive', label: 'BDE' },
  { value: 'Trainer', label: 'Trainer' },
  { value: 'Finance Manager', label: 'Finance Manager' },
  { value: 'Finance Executive', label: 'Finance Executive' },
  { value: 'HR Manager', label: 'HR Manager' },
  { value: 'HR Executive', label: 'HR Executive' },
  { value: 'Coordinator', label: 'Coordinator' },
  { value: 'Senior Coordinator', label: 'Senior Coordinator' },
  { value: 'Manager', label: 'Product Manager' },
  { value: 'Executive Manager', label: 'Zonal Manager' },
  { value: 'Regional Manager', label: 'Regional Manager' },
  { value: 'Regional Head', label: 'Regional Head' },
  { value: 'National Head', label: 'National Head' },
  { value: 'Warehouse Executive', label: 'Warehouse Executive' },
  { value: 'Warehouse Manager', label: 'Warehouse Manager' },
  { value: 'Admin', label: 'Admin' },
  { value: 'Office Team', label: 'Office Team' },
  { value: 'Super Admin', label: 'Super Admin' },
];

const REFERENCE_RELATIONS = ['Wife', 'Husband', 'Brother', 'Sister', 'Father', 'Mother'];

const MULTI_ZONE_ROLES = ['Executive Manager', 'Trainer', 'Coordinator', 'Senior Coordinator'];
const isSingleZoneRole = (role: string) => ['Executive', 'Sales BDE', 'Employee', 'BDE'].includes(role);
const roleUsesZones = (role: string) => isSingleZoneRole(role) || MULTI_ZONE_ROLES.includes(role);
const roleRequiresZones = (role: string) => isSingleZoneRole(role) || ['Trainer', 'Coordinator', 'Senior Coordinator'].includes(role);

type Reference = { relation: string; name: string; mobile: string; aadhaarUrl: string };
type Product = { _id: string; productName: string };
type EmployeeOption = { _id: string; name: string; role: string; department?: string; designation?: string; assignedProductIds?: Array<string | { _id?: string }> };
type UploadKind = 'aadhaar' | 'location' | 'passport' | 'reference-aadhaar' | 'passbook';

const todayDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const emptyRelationship = () => ({ employeeId: '', fullName: '', relationship: '', department: '', designation: '' });
const ROLE_NAMES: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));
const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());

/**
 * Add employee. With route param `id` (EmployeeEdit) it loads that employee and
 * saves every create-time field except the password (web: components/employees/EmployeeForm.tsx).
 */
export default function EmployeeNewScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const editId: string = String(route?.params?.id || '');
  const isEdit = Boolean(editId);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    empCode: '',
    email: '',
    password: '',
    phone: '',
    mobile: '',
    permanentAddress: '',
    permanentAddressDetails: emptyPermanentAddress() as PermanentAddressDetails,
    temporaryAddress: '',
    department: '',
    state: '',
    zone: '',
    zones: [] as string[],
    cluster: '',
    district: '',
    city: '',
    pincode: '',
    role: 'Executive',
    designation: '',
    taggedEmployeeIds: [] as string[],
    dateOfBirth: '',
    dateOfJoining: '',
    yearlySalary: '',
    monthlyTakeHome: '',
    ...emptyBankDetails(),
    hasEmployeeRelationship: null as boolean | null,
    employeeRelationshipDetails: emptyRelationship(),
    references: [
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
      { relation: '', name: '', mobile: '', aadhaarUrl: '' },
    ] as Reference[],
    aadhaarUrl: '',
    locationPhotoUrl: '',
    passportPhotoUrl: '',
    onboardingChecklist: [] as string[],
    onboardingProductTraining: [] as string[],
    onboardingOtherNote: '',
    trainerProducts: [] as string[],
    verticalManagerId: '',
    bankPassbookUrl: '',
  });
  /** Saved employee in edit mode; fields an older record never had may stay blank. */
  const [original, setOriginal] = useState<Record<string, any> | null>(null);
  const [loadingEmployee, setLoadingEmployee] = useState(isEdit);
  const onFile = (key: string) => {
    const value = original?.[key];
    if (Array.isArray(value)) return value.length > 0;
    if (key === 'phone') return Boolean(value) && value !== '0';
    if (typeof value === 'boolean') return true;
    return value !== undefined && value !== null && value !== 0 && String(value).trim() !== '';
  };
  /** Required at creation; in edit mode only when the employee already has it on file. */
  const needs = (key: string) => !isEdit || onFile(key);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<string[]>([]);
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({});
  const [loadingPincode, setLoadingPincode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [canAddDepartment, setCanAddDepartment] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [addingDepartment, setAddingDepartment] = useState(false);
  const [relationSearch, setRelationSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const clustersForZone = clustersByZone[form.zone] || [];
  const singleZone = isSingleZoneRole(form.role);
  const usesZones = roleUsesZones(form.role);

  useEffect(() => {
    const loadZonesAndClusters = async () => {
      try {
        const [pairsRaw, zonesRaw] = await Promise.all([
          apiService.get('/zones-clusters').catch(() => []),
          apiService.get('/zones').catch(() => []),
        ]);
        const pairs: { zone?: string; cluster?: string }[] = Array.isArray(pairsRaw) ? pairsRaw : [];
        const zoneDocs: { name?: string }[] = Array.isArray(zonesRaw) ? zonesRaw : [];
        const zoneMap: Record<string, string[]> = {};
        pairs.forEach((zc) => {
          const zone = (zc.zone || '').trim();
          if (!zone) return;
          if (!zoneMap[zone]) zoneMap[zone] = [];
          const cl = (zc.cluster || '').trim();
          if (cl && !zoneMap[zone].includes(cl)) zoneMap[zone].push(cl);
        });
        const zoneNamesFromApi = zoneDocs.map((z) => (z.name || '').trim()).filter(Boolean);
        setZones([...new Set([...Object.keys(zoneMap), ...zoneNamesFromApi])].sort((a, b) => a.localeCompare(b)));
        setClustersByZone(zoneMap);
      } catch {
        setZones([]);
        setClustersByZone({});
      }
    };
    loadZonesAndClusters();
    apiService
      .get('/products/active')
      .then((d: any) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]));
    apiService
      .get('/employees?isActive=true')
      .then((d: any) => setEmployees(Array.isArray(d) ? d : []))
      .catch(() => setEmployees([]));
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data: any = await apiService.get('/departments');
      setDepartments((Array.isArray(data?.departments) ? data.departments : []).map((d: any) => String(d.name)));
      setCanAddDepartment(Boolean(data?.canManage));
    } catch {
      setDepartments([]);
    }
  };

  const addDepartment = async () => {
    const name = newDepartment.trim();
    if (!name) return;
    setAddingDepartment(true);
    try {
      const created: any = await apiService.post('/departments', { name });
      await loadDepartments();
      setForm((f) => ({ ...f, department: created?.name || name }));
      setNewDepartment('');
    } catch (e: any) {
      fail(e?.response?.data?.message || e?.message || 'Failed to add department');
    } finally {
      setAddingDepartment(false);
    }
  };

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const emp: any = await apiService.get(`/employees/${editId}`);
        if (cancelled || !emp) return;
        const parts = String(emp.name || '').trim().split(/\s+/);
        const savedZones: string[] = Array.isArray(emp.zones) && emp.zones.length ? emp.zones : emp.zone ? [emp.zone] : [];
        const refs: any[] = Array.isArray(emp.references) ? emp.references : [];
        const refAt = (i: number): Reference => ({
          relation: String(refs[i]?.relation || ''),
          name: String(refs[i]?.name || ''),
          mobile: String(refs[i]?.mobile || ''),
          aadhaarUrl: String(refs[i]?.aadhaarUrl || ''),
        });
        const rel = emp.employeeRelationshipDetails || {};
        const permanentAddress = String(emp.permanentAddress || '');
        const temporaryAddress = String(emp.temporaryAddress || emp.address1 || '');
        setOriginal(emp);
        setForm((f) => ({
          ...f,
          firstName: emp.firstName || parts[0] || '',
          lastName: emp.lastName ?? parts.slice(1).join(' '),
          empCode: String(emp.empCode || ''),
          email: emp.email || '',
          password: '',
          phone: emp.phone && emp.phone !== '0' ? String(emp.phone) : '',
          mobile: String(emp.mobile || ''),
          permanentAddress,
          permanentAddressDetails: permanentAddressFromSaved(emp.permanentAddressDetails),
          temporaryAddress,
          department: String(emp.department || ''),
          state: String(emp.state || ''),
          zone: savedZones[0] || '',
          zones: savedZones,
          cluster: String(emp.cluster || ''),
          district: String(emp.district || ''),
          city: String(emp.city || ''),
          pincode: String(emp.pincode || ''),
          role: emp.role || 'Executive',
          designation: String(emp.designation || ''),
          taggedEmployeeIds: (Array.isArray(emp.taggedEmployeeIds) ? emp.taggedEmployeeIds : []).map((x: any) => String(x?._id || x)),
          dateOfBirth: employeeDateYmd(emp.dateOfBirth),
          dateOfJoining: employeeDateYmd(emp.dateOfJoining),
          yearlySalary: emp.yearlySalary ? String(emp.yearlySalary) : '',
          monthlyTakeHome: emp.monthlyTakeHome ? String(emp.monthlyTakeHome) : '',
          ...bankDetailsFromEmployee(emp),
          hasEmployeeRelationship: typeof emp.hasEmployeeRelationship === 'boolean' ? emp.hasEmployeeRelationship : null,
          employeeRelationshipDetails: {
            employeeId: rel.employeeId ? String(rel.employeeId?._id || rel.employeeId) : '',
            fullName: String(rel.fullName || ''),
            relationship: String(rel.relationship || ''),
            department: String(rel.department || ''),
            designation: String(rel.designation || ''),
          },
          references: [refAt(0), refAt(1)],
          aadhaarUrl: String(emp.aadhaarUrl || ''),
          locationPhotoUrl: String(emp.locationPhotoUrl || ''),
          passportPhotoUrl: String(emp.passportPhotoUrl || ''),
          onboardingChecklist: onboardingFromSaved(emp.onboardingChecklist),
          onboardingProductTraining: Array.isArray(emp.onboardingProductTraining) ? emp.onboardingProductTraining.map(String) : [],
          onboardingOtherNote: String(emp.onboardingOtherNote || ''),
          trainerProducts: Array.isArray(emp.trainerProducts) ? emp.trainerProducts : [],
          verticalManagerId: emp.verticalManagerId ? String(emp.verticalManagerId?._id || emp.verticalManagerId) : '',
          bankPassbookUrl: String(emp.bankPassbookUrl || ''),
        }));
        setSameAsPermanent(Boolean(permanentAddress.trim()) && permanentAddress === temporaryAddress);
        const productIds = Array.isArray(emp.assignedProductIds) ? emp.assignedProductIds : [];
        setProductId(productIds.length ? String(productIds[0]?._id || productIds[0]) : '');
      } catch (e: any) {
        if (!cancelled) setErrorMessage(e?.message || 'Failed to load employee');
      } finally {
        if (!cancelled) setLoadingEmployee(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId]);

  // Trainer: Product Heads (role Manager) that own every selected product.
  const eligibleProductHeads = useMemo(() => {
    const heads = employees.filter((e) => e.role === 'Manager');
    const selectedIds = products.filter((p) => form.trainerProducts.includes(p.productName)).map((p) => p._id);
    if (!selectedIds.length) return heads;
    return heads.filter((head) => {
      const assigned = new Set(
        (head.assignedProductIds || []).map((v) => (typeof v === 'string' ? v : String(v?._id || '')))
      );
      return selectedIds.every((id) => assigned.has(id));
    });
  }, [employees, products, form.trainerProducts]);

  const sanitizeDigits = (value: string, maxDigits = 15) => String(value || '').replace(/\D/g, '').slice(0, maxDigits);

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const fail = (msg: string) => {
    setErrorMessage(msg);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const setPermanentAddress = (patch: Partial<PermanentAddressDetails>) =>
    setForm((f) => ({ ...f, permanentAddressDetails: { ...f.permanentAddressDetails, ...patch } }));

  const handlePincodeChange = async (value: string) => {
    const pincode = value.replace(/\D/g, '').slice(0, 6);
    setForm((current) => ({ ...current, pincode, permanentAddressDetails: { ...current.permanentAddressDetails, pincode } }));
    if (pincode.length !== 6) return;
    setLoadingPincode(true);
    try {
      const location: any = await apiService.get(`/location/resolve?pincode=${pincode}`);
      setForm((current) => {
        const zone = location.zone || current.zone;
        const address = current.permanentAddressDetails;
        return {
          ...current,
          permanentAddressDetails: {
            ...address,
            state: location.state || address.state,
            district: location.district || address.district,
            villageTownCity: address.villageTownCity || location.city || location.town || '',
          },
          city: location.city || location.town || current.city,
          district: location.district || current.district,
          state: location.state || current.state,
          zone,
          zones: !roleUsesZones(current.role)
            ? current.zones
            : isSingleZoneRole(current.role)
              ? zone
                ? [zone]
                : []
              : zone && !current.zones.includes(zone)
                ? [...current.zones, zone]
                : current.zones,
          cluster: location.cluster || (location.zone ? '' : current.cluster),
        };
      });
    } catch {
      // Keep the fields editable when this pincode has no configured mapping.
    } finally {
      setLoadingPincode(false);
    }
  };

  const setReference = (idx: number, patch: Partial<Reference>) =>
    setForm((f) => {
      const references = [...f.references];
      references[idx] = { ...references[idx], ...patch };
      return { ...f, references };
    });

  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  /**
   * Pick a PDF (the bank passbook may also be a photo) and POST it to /employees/upload
   * (fields `file` + `kind`), returning the stored URL.
   */
  const uploadPdf = async (kind: UploadKind, key: string, onUrl: (url: string) => void) => {
    try {
      const allowImage = kind === 'passbook';
      const result = await DocumentPicker.getDocumentAsync({
        type: allowImage ? ['application/pdf', 'image/*'] : 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.name || (allowImage ? 'passbook' : 'document.pdf');
      const isPdf = asset.mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
      const isImage = /^image\//.test(asset.mimeType || '') || /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
      if (asset.mimeType && !isPdf && !(allowImage && isImage)) {
        fail(allowImage ? 'Upload the passbook as a PDF or an image (JPG, PNG).' : 'Only PDF files are allowed.');
        return;
      }
      setUploading(key);
      setErrorMessage(null);
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = (asset as any).file || (await fetch(asset.uri).then((r) => r.blob()));
        fd.append('file', blob, name);
      } else {
        fd.append('file', { uri: asset.uri, name, type: asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg') } as any);
      }
      fd.append('kind', kind);
      const data = await apiService.upload(`/employees/upload?kind=${kind}`, fd);
      if (!data?.url) throw new Error('Upload failed');
      onUrl(data.url);
    } catch (e: any) {
      fail(e?.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const productNames = useMemo(() => products.map((p) => p.productName).filter(Boolean), [products]);
  const productsLeft = productsLeftForTraining(productNames, form.onboardingProductTraining);
  /** A declaration saved before the employee picker: typed name, no employee picked. */
  const legacyRelationship =
    isEdit &&
    !form.employeeRelationshipDetails.employeeId &&
    Boolean(original?.employeeRelationshipDetails?.fullName) &&
    form.employeeRelationshipDetails.fullName === String(original?.employeeRelationshipDetails?.fullName || '');
  const relationMatches = useMemo(() => {
    const q = relationSearch.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter((e) => e._id !== editId && `${e.name} ${ROLE_NAMES[e.role] || e.role}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [employees, relationSearch, editId]);
  const pickRelatedEmployee = (picked: EmployeeOption) => {
    setRelationSearch('');
    setForm((f) => ({
      ...f,
      employeeRelationshipDetails: {
        ...f.employeeRelationshipDetails,
        employeeId: picked._id,
        fullName: picked.name || '',
        department: picked.department || '',
        designation: employeeDesignation(picked),
      },
    }));
  };
  const toggleOnboarding = (item: string) =>
    setForm((f) => ({
      ...f,
      onboardingChecklist: ONBOARDING_ITEMS.filter((name) =>
        name === item ? !f.onboardingChecklist.includes(item) : f.onboardingChecklist.includes(name)
      ),
    }));
  const toggleTrainingProduct = (name: string) =>
    setForm((f) => {
      const ticked = toggleIn(f.onboardingProductTraining, name);
      const allDone = productsLeftForTraining(productNames, ticked).length === 0;
      return {
        ...f,
        onboardingProductTraining: ticked,
        // Product Training stays ticked only while every product is ticked.
        onboardingChecklist: allDone ? f.onboardingChecklist : f.onboardingChecklist.filter((i) => i !== 'Product Training'),
      };
    });

  const handleSubmit = async () => {
    clearMessages();
    const addressPartsBlank = isBlankPermanentAddress(form.permanentAddressDetails);
    // Employees saved before the address parts existed may keep their one-line address.
    const keepLegacyPermanentAddress = isEdit && addressPartsBlank && !onFile('permanentAddressDetails') && Boolean(form.permanentAddress.trim());
    const permanentAddressText = keepLegacyPermanentAddress ? form.permanentAddress : formatPermanentAddress(form.permanentAddressDetails);
    const temporaryAddress = sameAsPermanent ? permanentAddressText : form.temporaryAddress;
    if (!form.firstName?.trim()) return fail('First Name is required');
    if (!form.email?.trim()) return fail('Email is required');
    if (!form.mobile.trim()) return fail('Employee mobile number is required.');
    if (!/^\d{10,15}$/.test(form.mobile)) return fail('Enter a mobile number with 10 to 15 digits.');
    if (!form.phone.trim() && needs('phone')) return fail('Company contact number is required.');
    if (form.phone.trim() && !/^\d{10,15}$/.test(form.phone)) return fail('Company contact number must be 10 to 15 digits.');
    if (form.phone && form.phone === form.mobile) return fail('Official contact number and personal mobile number cannot be the same.');
    if (form.hasEmployeeRelationship === null && needs('hasEmployeeRelationship')) return fail('Select Yes or No for the employee relationship declaration');
    if (form.hasEmployeeRelationship) {
      const r = form.employeeRelationshipDetails;
      if (!r.employeeId && !legacyRelationship) return fail('Employee Relationship Declaration: select the employee from the list');
      if (!r.relationship.trim()) return fail('Employee Relationship Declaration: Relationship is required');
    }
    if (!form.dateOfBirth && needs('dateOfBirth')) return fail('Date of birth is required');
    if (form.dateOfBirth && !isIsoDate(form.dateOfBirth)) return fail('Pick a valid date of birth');
    if (form.dateOfBirth > todayDate()) return fail('Date of birth cannot be a future date');
    if (!form.dateOfJoining && needs('dateOfJoining')) return fail('Date of joining is required');
    if (form.dateOfJoining && !isIsoDate(form.dateOfJoining)) return fail('Pick a valid date of joining');
    if (form.dateOfJoining > todayDate()) return fail('Date of joining cannot be a future date');
    const ctc = Number(form.yearlySalary);
    if (!(ctc > 0) && (needs('yearlySalary') || form.yearlySalary.trim() !== '')) return fail('CTC (per year) is required');
    const takeHome = form.monthlyTakeHome.trim() === '' ? 0 : Number(form.monthlyTakeHome);
    if (!Number.isFinite(takeHome) || takeHome < 0) return fail('Monthly take-home must be a valid amount');
    const bankError = bankDetailsError(form);
    if (bankError) return fail(bankError);
    if (!form.passportPhotoUrl.trim() && needs('passportPhotoUrl')) return fail('Passport size photo PDF is required');
    if (form.role === 'Office Team' && !form.designation.trim()) return fail('Enter the designation');

    const selectedZones = !usesZones
      ? []
      : singleZone
        ? form.zone.trim()
          ? [form.zone.trim()]
          : []
        : form.zones.map((z) => z.trim()).filter(Boolean);
    if (roleRequiresZones(form.role) && selectedZones.length === 0) {
      return fail(singleZone ? 'Zone is required for BDE' : 'Select at least one zone');
    }
    if (singleZone && !form.cluster?.trim()) return fail('Cluster is required for BDE role');

    // Older employees may have no references yet; leave both blank or fill both.
    const skipReferences =
      isEdit &&
      !onFile('references') &&
      form.references.every((r) => !r.relation && !r.name.trim() && !r.mobile.trim() && !r.aadhaarUrl);
    for (let i = 0; i < (skipReferences ? 0 : 2); i++) {
      const ref = form.references[i];
      if (!REFERENCE_RELATIONS.includes(ref.relation)) {
        return fail(`Family Member ${i + 1}: select relationship (Wife, Husband, Brother, Sister, Father, or Mother)`);
      }
      if (!ref.name.trim()) return fail(`Family Member ${i + 1}: name is required`);
      if (!/^\d{10,15}$/.test(ref.mobile)) return fail(`Family Member ${i + 1}: enter a mobile number with 10 to 15 digits`);
      if (!ref.aadhaarUrl.trim()) return fail(`Family Member ${i + 1}: Aadhaar PDF is required`);
    }
    if (!skipReferences && form.references[0].mobile === form.references[1].mobile) {
      return fail('Family Member 1 and Family Member 2 cannot have the same mobile number');
    }
    if (!keepLegacyPermanentAddress && !(isEdit && addressPartsBlank && !onFile('permanentAddressDetails') && !onFile('permanentAddress'))) {
      const addressError = permanentAddressError(form.permanentAddressDetails);
      if (addressError) return fail(addressError);
    }
    if (!temporaryAddress.trim() && (needs('temporaryAddress') || (isEdit && onFile('address1')))) return fail('Temporary address is required');
    if (!form.aadhaarUrl.trim() && needs('aadhaarUrl')) return fail('Aadhaar upload is required');
    if (!form.locationPhotoUrl.trim() && needs('locationPhotoUrl')) return fail('Location upload is required');
    const keepLegacyManager = isEdit && original?.role === 'Manager' && !onFile('assignedProductIds') && !productId;
    const keepLegacyTrainer =
      isEdit && original?.role === 'Trainer' && !onFile('trainerProducts') && !form.trainerProducts.length && !form.verticalManagerId;
    if (form.role === 'Manager' && !productId && !keepLegacyManager) return fail('Select the product for this Product Manager');
    if (form.role === 'Trainer' && !keepLegacyTrainer) {
      if (!form.trainerProducts.length) return fail('Select at least one product for this Trainer');
      if (!form.verticalManagerId) return fail('Select the Product Head for this Trainer');
    }
    const skipOnboarding = isEdit && !onFile('onboardingChecklist') && form.onboardingChecklist.length === 0;
    const checklistError = skipOnboarding
      ? null
      : onboardingError(form.onboardingChecklist, form.onboardingProductTraining, form.onboardingOtherNote, productNames);
    if (checklistError) return fail(checklistError);

    setSubmitting(true);
    try {
      const payload: any = {
        ...form,
        permanentAddress: permanentAddressText,
        temporaryAddress,
        address1: temporaryAddress,
        zone: selectedZones[0] || '',
        zones: selectedZones,
        name: `${form.firstName} ${form.lastName}`.trim() || form.firstName || 'Executive',
        yearlySalary: ctc,
        monthlyTakeHome: takeHome,
        ...bankDetailsPayload(form),
        password: form.password.trim() || undefined,
        empCode: form.empCode.trim() || undefined,
      };
      if (form.role !== 'Executive') delete payload.cluster;
      if (keepLegacyPermanentAddress || (isEdit && addressPartsBlank)) delete payload.permanentAddressDetails;
      if (!supportsEmployeeTagging(form.role)) delete payload.taggedEmployeeIds;
      if (form.role === 'Manager' && productId) payload.assignedProductIds = [productId];
      if (form.role !== 'Trainer') {
        delete payload.trainerProducts;
        delete payload.verticalManagerId;
      }
      if (isEdit) {
        delete payload.password;
        if (!form.empCode.trim()) delete payload.empCode;
        if (form.hasEmployeeRelationship === null) {
          delete payload.hasEmployeeRelationship;
          delete payload.employeeRelationshipDetails;
        }
        if (skipOnboarding) {
          delete payload.onboardingChecklist;
          delete payload.onboardingProductTraining;
          delete payload.onboardingOtherNote;
        }
        if (!permanentAddressText.trim()) delete payload.permanentAddress;
        if (form.role === 'Trainer' && keepLegacyTrainer) {
          delete payload.trainerProducts;
          delete payload.verticalManagerId;
        }
        if (!temporaryAddress.trim()) delete payload.address1;
        await apiService.put(`/employees/${editId}`, payload);
        setSuccessMessage('Employee updated.');
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        return;
      }
      await apiService.post('/employees/create', payload);
      const role = user?.role;
      setSuccessMessage(
        role === 'Super Admin'
          ? 'Employee added.'
          : role === 'HR Executive' || role === 'HR Manager'
            ? 'Employee saved. Their Vertical Head will complete background verification before HR final approval.'
            : 'Employee saved. The Vertical Head must approve before HR final approval.'
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error: any) {
      fail(error.response?.data?.message || error.message || (isEdit ? 'Failed to update employee' : 'Failed to create employee'));
    } finally {
      setSubmitting(false);
    }
  };

  const UploadRow = ({ label, url, kind, uploadKey, onUrl }: { label: string; url: string; kind: UploadKind; uploadKey: string; onUrl: (u: string) => void }) => (
    <View style={styles.fieldContainer}>
      <WebLabel>{label}</WebLabel>
      <TouchableOpacity style={[styles.uploadButton, !!url && styles.uploadButtonDone]} onPress={() => uploadPdf(kind, uploadKey, onUrl)} disabled={!!uploading}>
        <Text style={styles.uploadButtonText} numberOfLines={1}>
          {uploading === uploadKey
            ? 'Uploading…'
            : url
              ? `Uploaded: ${employeeDocName(url)}${isEdit ? ' · tap to replace' : ''}`
              : kind === 'passbook'
                ? 'Choose PDF or photo'
                : 'Choose PDF'}
        </Text>
      </TouchableOpacity>
      {url && uploading !== uploadKey ? (
        <TouchableOpacity onPress={() => openEmployeeDoc(url)} style={styles.viewDocLink}>
          <Text style={styles.viewDocLinkText}>View uploaded file</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const Check = ({ checked, label, onPress, disabled }: { checked: boolean; label: string; onPress: () => void; disabled?: boolean }) => (
    <TouchableOpacity style={[styles.checkRow, disabled && styles.checkRowDisabled]} onPress={onPress} disabled={disabled}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={checked ? colors.primary : colors.textMuted} />
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );

  if (loadingEmployee) {
    return (
      <ScreenShell title="Edit Employee" loading>
        <View />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={isEdit ? 'Edit Employee' : 'New Employee'} noScroll>
      <ScrollView ref={scrollRef} style={styles.content} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.viewEmployeesButton}
              onPress={() =>
                isEdit
                  ? navigation.goBack()
                  : navigation.navigate(user?.role === 'Super Admin' ? 'EmployeesActive' : 'EmployeeVerification')
              }
            >
              <Text style={styles.viewEmployeesButtonText}>
                {isEdit ? 'Back' : user?.role === 'Super Admin' ? 'View Employees' : 'View Verification Queue'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity onPress={clearMessages} style={styles.dismissError}>
              <Text style={styles.dismissErrorText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <PageSection title="Personal">
          <FormField label="First Name *" value={form.firstName} onChangeText={(t: string) => setForm((f) => ({ ...f, firstName: t }))} placeholder="First Name" />
          <FormField label="Last Name" value={form.lastName} onChangeText={(t: string) => setForm((f) => ({ ...f, lastName: t }))} placeholder="Last Name" />
          <FormField label="Emp ID / Code" value={form.empCode} onChangeText={(t: string) => setForm((f) => ({ ...f, empCode: t }))} placeholder="Auto-assigned if left blank" />
          <View style={styles.fieldContainer}>
            <WebLabel>Date of birth *</WebLabel>
            <DateField placeholder="Date of birth *" value={form.dateOfBirth} onChange={(t: string) => setForm((f) => ({ ...f, dateOfBirth: t.trim() }))} />
          </View>
          <View style={styles.fieldContainer}>
            <WebLabel>Date of joining *</WebLabel>
            <DateField placeholder="Date of joining *" value={form.dateOfJoining} onChange={(t: string) => setForm((f) => ({ ...f, dateOfJoining: t.trim() }))} />
          </View>

          <View style={styles.fieldContainer}>
            <WebLabel>Employee Relationship Declaration *</WebLabel>
            <Text style={styles.helper}>
              Do you have any relatives, family members, or personal connections currently employed by Viswam EduTech Solutions Pvt. Ltd.?
            </Text>
            <View style={styles.roleContainer}>
              {[
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.roleOption, form.hasEmployeeRelationship === opt.value && styles.roleOptionSelected]}
                  onPress={() =>
                    setForm((f) => ({
                      ...f,
                      hasEmployeeRelationship: opt.value,
                      ...(opt.value ? {} : { employeeRelationshipDetails: emptyRelationship() }),
                    }))
                  }
                >
                  <Text style={[styles.roleOptionText, form.hasEmployeeRelationship === opt.value && styles.roleOptionTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {form.hasEmployeeRelationship ? (
            <>
              <View style={styles.fieldContainer}>
                <WebLabel>Employee Name *</WebLabel>
                {form.employeeRelationshipDetails.employeeId ? (
                  <View style={styles.pickedRow}>
                    <Text style={styles.pickedText}>{form.employeeRelationshipDetails.fullName}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        setForm((f) => ({
                          ...f,
                          employeeRelationshipDetails: { ...emptyRelationship(), relationship: f.employeeRelationshipDetails.relationship },
                        }))
                      }
                    >
                      <Text style={styles.viewDocLinkText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <WebInput style={styles.input} value={relationSearch} onChangeText={setRelationSearch} placeholder="Search and select the employee" />
                    {relationSearch.trim() ? (
                      <View style={styles.listBox}>
                        {relationMatches.length === 0 ? <Text style={styles.helper}>No employee found.</Text> : null}
                        {relationMatches.map((e) => (
                          <TouchableOpacity key={e._id} style={styles.checkRow} onPress={() => pickRelatedEmployee(e)}>
                            <Text style={styles.checkLabel}>{`${e.name} (${ROLE_NAMES[e.role] || e.role})`}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    {legacyRelationship ? (
                      <Text style={styles.helper}>
                        Saved earlier as "{form.employeeRelationshipDetails.fullName}". Select the employee from the list to update it.
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
              <ReadOnlyField label="Full Name" value={form.employeeRelationshipDetails.fullName} />
              <FormField
                label="Relationship *"
                value={form.employeeRelationshipDetails.relationship}
                placeholder="e.g. Brother, spouse, friend"
                onChangeText={(t: string) =>
                  setForm((f) => ({ ...f, employeeRelationshipDetails: { ...f.employeeRelationshipDetails, relationship: t } }))
                }
              />
              <ReadOnlyField label="Department" value={form.employeeRelationshipDetails.department} />
              <ReadOnlyField label="Designation" value={form.employeeRelationshipDetails.designation} />
            </>
          ) : null}
        </PageSection>

        <PageSection title="Contact">
          <FormField label="Email Id *" value={form.email} onChangeText={(t: string) => setForm((f) => ({ ...f, email: t }))} placeholder="Email" keyboardType="email-address" />
          <FormField label="Company contact number *" value={form.phone} onChangeText={(v: string) => setForm((f) => ({ ...f, phone: sanitizeDigits(v) }))} placeholder="10 to 15 digits" keyboardType="phone-pad" maxLength={15} />
          <FormField label="Personal mobile *" value={form.mobile} onChangeText={(v: string) => setForm((f) => ({ ...f, mobile: sanitizeDigits(v) }))} placeholder="10 to 15 digits" keyboardType="phone-pad" maxLength={15} />
        </PageSection>

        <PageSection title="Permanent Address *" description="PIN Code fills District, State and Zone.">
          {isEdit && isBlankPermanentAddress(form.permanentAddressDetails) && form.permanentAddress.trim() ? (
            <Text style={styles.lookupText}>Saved earlier as: {form.permanentAddress}. Fill in the parts below to update it.</Text>
          ) : null}
          {PERMANENT_ADDRESS_FIELDS.map(({ key, label, required }) => (
            <React.Fragment key={key}>
              <FormField
                label={`${label}${required ? ' *' : ''}`}
                value={form.permanentAddressDetails[key]}
                onChangeText={key === 'pincode' ? handlePincodeChange : (t: string) => setPermanentAddress({ [key]: t })}
                placeholder={key === 'pincode' ? '6-digit PIN Code' : label}
                keyboardType={key === 'pincode' ? 'number-pad' : undefined}
                maxLength={key === 'pincode' ? 6 : undefined}
              />
              {key === 'pincode' && loadingPincode ? <Text style={styles.lookupText}>Looking up location…</Text> : null}
            </React.Fragment>
          ))}
          <Check checked={sameAsPermanent} label="Same as permanent address" onPress={() => setSameAsPermanent((v) => !v)} />
          <View style={[styles.fieldContainer, { marginTop: 8 }]}>
            <WebLabel>Temporary address *</WebLabel>
            <WebInput
              style={[styles.textArea, sameAsPermanent && styles.textAreaDisabled]}
              value={sameAsPermanent ? formatPermanentAddress(form.permanentAddressDetails) || form.permanentAddress : form.temporaryAddress}
              editable={!sameAsPermanent}
              onChangeText={(t: string) => setForm((f) => ({ ...f, temporaryAddress: t }))}
              placeholder="Temporary / current address"
              multiline
              numberOfLines={3}
            />
          </View>
        </PageSection>

        <PageSection title="Documents" description="PDF files only.">
          <UploadRow label="Aadhaar *" url={form.aadhaarUrl} kind="aadhaar" uploadKey="aadhaar" onUrl={(u) => setForm((f) => ({ ...f, aadhaarUrl: u }))} />
          <UploadRow label="Location *" url={form.locationPhotoUrl} kind="location" uploadKey="location" onUrl={(u) => setForm((f) => ({ ...f, locationPhotoUrl: u }))} />
          <UploadRow label="Passport size photo *" url={form.passportPhotoUrl} kind="passport" uploadKey="passport" onUrl={(u) => setForm((f) => ({ ...f, passportPhotoUrl: u }))} />
        </PageSection>

        <PageSection title="Family Details *" description="Two family members, each with an Aadhaar PDF.">
          {[0, 1].map((idx) => (
            <View key={idx} style={styles.refCard}>
              <Text style={styles.refTitle}>Family Member {idx + 1}</Text>
              <WebSelect
                label="Relationship *"
                value={form.references[idx].relation}
                placeholder="Select relationship"
                onValueChange={(v) => setReference(idx, { relation: v })}
                items={REFERENCE_RELATIONS.map((r) => ({ label: r, value: r }))}
              />
              <FormField label="Name *" value={form.references[idx].name} onChangeText={(t: string) => setReference(idx, { name: t })} />
              <FormField label="Mobile *" value={form.references[idx].mobile} onChangeText={(t: string) => setReference(idx, { mobile: sanitizeDigits(t) })} keyboardType="phone-pad" maxLength={15} />
              <UploadRow
                label="Aadhaar * (PDF)"
                url={form.references[idx].aadhaarUrl}
                kind="reference-aadhaar"
                uploadKey={`ref-${idx}`}
                onUrl={(u) => setReference(idx, { aadhaarUrl: u })}
              />
            </View>
          ))}
        </PageSection>

        <PageSection title="User Type">
          <WebSelect
            label="User Type *"
            value={form.role}
            onValueChange={(role) => {
              if (!role) return;
              if (role !== 'Manager') setProductId('');
              setForm((f) => {
                const single = isSingleZoneRole(role);
                const nextZones = !roleUsesZones(role) ? [] : single ? (f.zone ? [f.zone] : []) : f.zones;
                return {
                  ...f,
                  role,
                  zones: nextZones,
                  zone: roleUsesZones(role) ? nextZones[0] || '' : '',
                  cluster: single ? f.cluster : '',
                  trainerProducts: role === 'Trainer' ? f.trainerProducts : [],
                  verticalManagerId: role === 'Trainer' ? f.verticalManagerId : '',
                  taggedEmployeeIds: supportsEmployeeTagging(role) ? f.taggedEmployeeIds : [],
                };
              });
            }}
            items={ROLE_OPTIONS}
          />
          <WebSelect
            label="Department"
            value={form.department}
            onValueChange={(department) => setForm((f) => ({ ...f, department }))}
            placeholder={departments.length ? 'Select department' : 'No departments yet'}
            items={[...departments, ...(form.department && !departments.includes(form.department) ? [form.department] : [])].map((d) => ({ label: d, value: d }))}
          />
          {canAddDepartment ? (
            <View style={styles.fieldContainer}>
              <WebInput style={styles.input} value={newDepartment} onChangeText={setNewDepartment} placeholder="New department name" maxLength={60} />
              <WebButton
                title={addingDepartment ? 'Adding…' : 'Add Department'}
                variant="outline"
                onPress={addDepartment}
                disabled={addingDepartment || !newDepartment.trim()}
              />
            </View>
          ) : null}
          {!isEdit ? (
            <FormField label="Password" value={form.password} onChangeText={(t: string) => setForm((f) => ({ ...f, password: t }))} placeholder="Default password if left blank" secureTextEntry />
          ) : null}

          {!usesZones ? null : singleZone ? (
            <>
              <WebSelect
                label="BDE Zone *"
                value={form.zone}
                onValueChange={(zone) => setForm((f) => ({ ...f, zone, zones: zone ? [zone] : [], cluster: '' }))}
                placeholder="Select Zone"
                items={zones.map((zone) => ({ label: zone, value: zone }))}
              />
              <WebSelect
                label="Cluster *"
                value={form.cluster}
                onValueChange={(cluster) => setForm((f) => ({ ...f, cluster }))}
                placeholder={!form.zone ? 'Select zone first' : clustersForZone.length === 0 ? 'No clusters linked to this zone' : 'Select Employee Cluster'}
                disabled={!form.zone || clustersForZone.length === 0}
                items={clustersForZone.map((cluster) => ({ label: cluster, value: cluster }))}
              />
            </>
          ) : (
            <View style={styles.fieldContainer}>
              <WebLabel>{form.role === 'Executive Manager' ? 'Zones (optional)' : 'Zones *'}</WebLabel>
              <View style={styles.listBox}>
                {zones.length === 0 ? <Text style={styles.helper}>No zones configured.</Text> : null}
                {zones.map((z) => (
                  <Check
                    key={z}
                    checked={form.zones.includes(z)}
                    label={z}
                    onPress={() =>
                      setForm((f) => {
                        const next = toggleIn(f.zones, z);
                        return { ...f, zones: next, zone: next[0] || '' };
                      })
                    }
                  />
                ))}
              </View>
            </View>
          )}

          {form.role === 'Office Team' ? (
            <FormField label="Designation *" value={form.designation} onChangeText={(t: string) => setForm((f) => ({ ...f, designation: t }))} placeholder="Enter designation" />
          ) : null}

          {form.role === 'Manager' ? (
            <WebSelect
              label="Product *"
              value={productId}
              onValueChange={setProductId}
              placeholder="Select product"
              items={products.map((p) => ({ label: p.productName, value: p._id }))}
            />
          ) : null}

          {form.role === 'Trainer' ? (
            <>
              <View style={styles.fieldContainer}>
                <WebLabel>Trainer products *</WebLabel>
                <View style={styles.listBox}>
                  {products.map((p) => (
                    <Check
                      key={p._id}
                      checked={form.trainerProducts.includes(p.productName)}
                      label={p.productName}
                      onPress={() => setForm((f) => ({ ...f, trainerProducts: toggleIn(f.trainerProducts, p.productName), verticalManagerId: '' }))}
                    />
                  ))}
                </View>
              </View>
              <WebSelect
                label="Product Head *"
                value={form.verticalManagerId}
                onValueChange={(v) => setForm((f) => ({ ...f, verticalManagerId: v }))}
                placeholder={eligibleProductHeads.length ? 'Select Product Head' : 'No Product Head owns all selected products'}
                items={eligibleProductHeads.map((h) => ({ label: h.name, value: h._id }))}
              />
            </>
          ) : null}

          <EmployeeTaggingPicker
            role={form.role}
            selectedIds={form.taggedEmployeeIds}
            onChange={(taggedEmployeeIds) => setForm((f) => ({ ...f, taggedEmployeeIds }))}
          />
        </PageSection>

        <PageSection title="Onboarding Checklist *" description="Select at least two items. Product Training can be ticked after every product is ticked.">
          <View style={styles.listBox}>
            {ONBOARDING_ITEMS.map((item) => {
              const locked = item === 'Product Training' && productsLeft.length > 0 && !form.onboardingChecklist.includes(item);
              return (
                <View key={item}>
                  <Check
                    checked={form.onboardingChecklist.includes(item)}
                    label={item}
                    disabled={locked}
                    onPress={() => toggleOnboarding(item)}
                  />
                  {item === 'Product Training' ? (
                    <View style={styles.subList}>
                      <Text style={styles.helper}>
                        {productNames.length === 0
                          ? 'No active products.'
                          : productsLeft.length
                            ? `Tick every product (${productNames.length - productsLeft.length} of ${productNames.length} done).`
                            : 'All products ticked.'}
                      </Text>
                      {productNames.map((name) => (
                        <Check
                          key={name}
                          checked={form.onboardingProductTraining.includes(name)}
                          label={name}
                          onPress={() => toggleTrainingProduct(name)}
                        />
                      ))}
                    </View>
                  ) : null}
                  {item === 'Others' && form.onboardingChecklist.includes('Others') ? (
                    <View style={styles.subList}>
                      <WebInput
                        style={styles.input}
                        value={form.onboardingOtherNote}
                        onChangeText={(t: string) => setForm((f) => ({ ...f, onboardingOtherNote: t }))}
                        placeholder="What is it? (required)"
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </PageSection>

        <PageSection title="Salary">
          <FormField label="CTC (₹ per year) *" value={form.yearlySalary} onChangeText={(t: string) => setForm((f) => ({ ...f, yearlySalary: t.replace(/[^\d.]/g, '') }))} placeholder="e.g. 300000" keyboardType="decimal-pad" />
          {Number(form.yearlySalary) > 0 ? (
            <Text style={styles.lookupText}>₹{Math.round(Number(form.yearlySalary) / 12).toLocaleString('en-IN')} per month</Text>
          ) : null}
          <FormField label="Monthly take-home (₹)" value={form.monthlyTakeHome} onChangeText={(t: string) => setForm((f) => ({ ...f, monthlyTakeHome: t.replace(/[^\d.]/g, '') }))} placeholder="Optional" keyboardType="decimal-pad" />
        </PageSection>

        <PageSection title="Bank">
          <FormField label="Account holder name" value={form.bankAccountHolderName} onChangeText={(t: string) => setForm((f) => ({ ...f, bankAccountHolderName: t }))} placeholder="As in the bank account" />
          <FormField label="Bank account number" value={form.bankAccountNumber} onChangeText={(t: string) => setForm((f) => ({ ...f, bankAccountNumber: t.replace(/\D/g, '') }))} placeholder="6 to 20 digits" keyboardType="number-pad" maxLength={20} />
          <FormField label="IFSC" value={form.bankIfsc} onChangeText={(t: string) => setForm((f) => ({ ...f, bankIfsc: t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() }))} placeholder="e.g. SBIN0001234" maxLength={11} />
          <FormField label="Bank name" value={form.bankName} onChangeText={(t: string) => setForm((f) => ({ ...f, bankName: t }))} placeholder="e.g. State Bank of India" />
          <FormField label="Branch" value={form.bankBranch} onChangeText={(t: string) => setForm((f) => ({ ...f, bankBranch: t }))} placeholder="Branch name" />
          <UploadRow
            label="Passbook / cancelled cheque (PDF or photo)"
            url={form.bankPassbookUrl}
            kind="passbook"
            uploadKey="passbook"
            onUrl={(u) => setForm((f) => ({ ...f, bankPassbookUrl: u }))}
          />
        </PageSection>

        <WebButton
          title={isEdit ? 'Save Changes' : 'Submit'}
          onPress={handleSubmit}
          disabled={submitting || !!uploading}
          loading={submitting}
        />
        {isEdit ? <WebButton title="Cancel" variant="outline" onPress={() => navigation.goBack()} disabled={submitting} /> : null}
      </ScrollView>
    </ScreenShell>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldContainer}>
      <WebLabel>{label}</WebLabel>
      <WebInput style={[styles.input, styles.textAreaDisabled]} value={value} editable={false} placeholder="Filled from the selected employee" />
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, secureTextEntry, maxLength }: any) {
  return (
    <View style={styles.fieldContainer}>
      <WebLabel>{label}</WebLabel>
      <WebInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 32 },
  fieldContainer: { marginBottom: 12 },
  input: { marginBottom: 0 },
  textArea: { minHeight: 80, textAlignVertical: 'top', marginBottom: 0 },
  textAreaDisabled: { backgroundColor: colors.backgroundMuted, color: colors.textTertiary },
  roleContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleOption: { minWidth: 72, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: '#DCE3EC' },
  roleOptionSelected: { backgroundColor: colors.accent, borderColor: colors.primary },
  roleOptionText: { fontSize: 14, color: colors.textPrimary },
  roleOptionTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  uploadButton: { paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFD3EE', backgroundColor: colors.accent, alignItems: 'center' },
  uploadButtonDone: { borderStyle: 'solid', borderColor: '#BBF7D0', backgroundColor: colors.successLight },
  uploadButtonText: { fontSize: 14, fontWeight: '600', color: colors.primaryDark },
  viewDocLink: { marginTop: 6, alignSelf: 'flex-start' },
  viewDocLinkText: { fontSize: 13, color: colors.primaryDark, textDecorationLine: 'underline' },
  refCard: { borderWidth: 1, borderColor: '#EEF2F7', borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: colors.background },
  refTitle: { fontSize: 14, color: colors.textPrimary, marginBottom: 8, fontWeight: '700' },
  listBox: { borderWidth: 1, borderColor: '#DCE3EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: colors.backgroundLight },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  checkLabel: { fontSize: 14, color: colors.textPrimary, flex: 1 },
  checkRowDisabled: { opacity: 0.45 },
  subList: { marginLeft: 28, marginBottom: 8 },
  pickedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#DCE3EC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.backgroundLight },
  pickedText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  helper: { fontSize: 13, color: colors.textTertiary, paddingVertical: 8 },
  successBanner: { backgroundColor: colors.successLight, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  successText: { fontSize: 14, color: '#15803D', fontWeight: '600', marginBottom: 12 },
  viewEmployeesButton: { alignSelf: 'flex-start', backgroundColor: colors.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  viewEmployeesButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorBanner: { backgroundColor: colors.errorLight, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { fontSize: 14, color: '#B91C1C', marginBottom: 8 },
  dismissError: { alignSelf: 'flex-start' },
  dismissErrorText: { color: colors.error, fontWeight: '700', fontSize: 13 },
  lookupText: { fontSize: 13, color: colors.textTertiary, marginTop: -4, marginBottom: 12 },
});
