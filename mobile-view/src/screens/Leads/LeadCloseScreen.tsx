import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput, WebSelect } from '../../ui/WebPrimitives';
import { useAuth } from '../../context/AuthContext';
import MessageBanner from '../../components/MessageBanner';
import { navigateRoot } from '../../navigation/navigationRef';
import CloseLeadProductsModal, {
  type CloseLeadProductRow,
} from './CloseLeadProductsModal';
import {
  assignTermsByLevelCombination,
  formatProductWithLevel,
} from '../../utils/levelTermRouting';

type ProductDetail = CloseLeadProductRow;

function getCategoriesForProduct(catalog: any[], productName: string): string[] {
  const product = catalog.find(
    (p) => (p.productName || p.name || p.product || '') === productName,
  );
  if (!product?.hasCategory) return [];
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    return product.categories.map((c: any) => String(c).trim()).filter(Boolean);
  }
  return [];
}

/** e.g. 2026 → "2026-27" (matches existing Close Lead year values). */
function getCurrentAcademicYear(): string {
  const y = new Date().getFullYear();
  return `${y}-${String(y + 1).slice(-2)}`;
}

/** Newest years first so the current/recent year is at the top of the picker. */
function getAcademicYearsNewestFirst(count = 4): string[] {
  const current = new Date().getFullYear();
  const newestStart = current + 1; // include next year (e.g. 2027-28)
  return Array.from({ length: count }, (_, i) => {
    const y = newestStart - i;
    return `${y}-${String(y + 1).slice(-2)}`;
  });
}

export default function LeadCloseScreen({ navigation, route }: any) {
  const id = route?.params?.id ? String(route.params.id) : '';
  const { user } = useAuth();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([]);
  const [poPhotoUrl, setPoPhotoUrl] = useState<string>('');
  const [uploadingPO, setUploadingPO] = useState(false);
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);
  const [loadedAsDcOrder, setLoadedAsDcOrder] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formMessageType, setFormMessageType] = useState<'error' | 'success'>('error');
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitPreview, setSplitPreview] = useState<{
    term1: { productName: string; strength: number }[];
    term2: { productName: string; strength: number }[];
  } | null>(null);
  const [pendingConvert, setPendingConvert] = useState<{
    schoolName: string;
    productsPayload: any[];
    isDcOrder: boolean;
  } | null>(null);

  const currentAcademicYear = getCurrentAcademicYear();
  // Newest academic years first in the Close Lead year dropdown
  const availableYears = getAcademicYearsNewestFirst(4);

  const [form, setForm] = useState({
    school_name: '',
    contact_person: '',
    email: '',
    contact_mobile: '',
    contact_person2: '',
    contact_mobile2: '',
    delivery_date: '',
    year: currentAcademicYear,
  });

  const todayYmd = () => new Date().toISOString().split('T')[0];

  const showError = (message: string) => {
    setFormMessageType('error');
    setFormMessage(message);
  };

  const showSuccess = (message: string) => {
    setFormMessageType('success');
    setFormMessage(message);
  };

  useEffect(() => {
    loadLead();
    loadProducts();
  }, [id]);

  const loadProducts = async () => {
    try {
      setLoadingProducts(true);
      // Use /products/active first (no auth required, works for executives; /products requires Admin)
      let data: any;
      try {
        data = await apiService.get('/products/active');
      } catch (err: any) {
        // Fallback to /products for admin users if /active fails
        try {
          data = await apiService.get('/products');
        } catch (err2: any) {
          console.error('Failed to load products:', err2?.message || err2);
          throw err2;
        }
      }
      
      // Handle different response structures
      let productsList: any[] = [];
      if (Array.isArray(data)) {
        productsList = data;
      } else if (data?.data && Array.isArray(data.data)) {
        productsList = data.data;
      } else if (data?.products && Array.isArray(data.products)) {
        productsList = data.products;
      }
      
      console.log('Products list after parsing:', productsList.length, 'products');
      
      // Filter for active products - be more lenient with the filter
      // Only filter if prodStatus exists and is explicitly 0 or false
      const activeProducts = productsList.filter((p: any) => {
        // If prodStatus exists, check it's not 0 or false
        if (p.prodStatus !== undefined && p.prodStatus !== null) {
          return p.prodStatus !== 0 && p.prodStatus !== false && p.prodStatus !== '0';
        }
        // If status exists, check it's not 0 or false
        if (p.status !== undefined && p.status !== null) {
          return p.status !== 0 && p.status !== false && p.status !== '0';
        }
        // If no status field, include it (assume active)
        return true;
      });
      
      console.log('Active products after filtering:', activeProducts.length);
      
      // If no products after filtering, show all products (maybe they don't have status field)
      const finalProducts = activeProducts.length > 0 ? activeProducts : productsList;
      
      setProducts(finalProducts);
      
      if (finalProducts.length === 0) {
        console.warn('No products found at all');
        Alert.alert('Info', 'No products found. Please ensure products are created in the system.');
      } else {
        console.log('Successfully loaded', finalProducts.length, 'products');
      }
    } catch (error: any) {
      console.error('Failed to load products:', error);
      Alert.alert('Error', `Failed to load products: ${error.message || 'Unknown error'}\n\nPlease check your connection and try again.`);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadLead = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setLoadedAsDcOrder(false);
      let data: any;
      try {
        data = await apiService.get(`/leads/${id}`);
      } catch {
        data = await apiService.get(`/dc-orders/${id}`);
        if (data) setLoadedAsDcOrder(true);
      }
      
      if (data) {
        setLead(data);
        const followUpYmd = data.follow_up_date
          ? new Date(data.follow_up_date).toISOString().split('T')[0]
          : '';
        const estimatedYmd = data.estimated_delivery_date
          ? new Date(data.estimated_delivery_date).toISOString().split('T')[0]
          : '';
        // Never treat follow-up as delivery; ignore estimated when it matches follow-up (legacy bug).
        const deliveryDate =
          estimatedYmd && estimatedYmd !== followUpYmd ? estimatedYmd : '';
        setForm({
          school_name: data.school_name || '',
          contact_person: data.contact_person || '',
          email: data.email || '',
          contact_mobile: data.contact_mobile || '',
          contact_person2: data.decision_maker || data.contact_person2 || '',
          contact_mobile2: data.contact_mobile2 || '',
          delivery_date: deliveryDate || todayYmd(),
          year: currentAcademicYear,
        });
        
        // Prefill product rows if the lead/order already has products
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          const rows: ProductDetail[] = data.products
            .map((p: any, index: number) => {
              const name = (p.product_name || p.product || '').toString().trim();
              if (!name) return null;
              const strength = Number(p.quantity ?? p.strength) || 0;
              const price = Number(p.unit_price ?? p.price) || 0;
              return {
                id: `existing_${index}_${name}`,
                product: name,
                class: String(p.class || '1'),
                category: p.category || '',
                quantity: strength || 1,
                strength: strength || 0,
                price,
                total: (strength || 0) * price,
                level: p.level || '',
                specs: p.specs || 'Regular',
                subject: p.subject || undefined,
                deliverables: Array.isArray(p.deliverables) ? p.deliverables : undefined,
                term: p.term || 'Term 1',
                isParentRow: false,
              } as ProductDetail;
            })
            .filter(Boolean) as ProductDetail[];
          if (rows.length > 0) setProductDetails(rows);
        }
      }
    } catch (error: any) {
      showError(error.message || 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  };

  const pickPOPhoto = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;
      await uploadPoAsset(result.assets[0]);
    } catch (err: any) {
      showError(err.message || 'Failed to pick document');
    }
  };

  const uploadPoAsset = async (asset: any) => {
    const name = String(asset.name || 'po.pdf');
    const nameLooksPdf = name.toLowerCase().endsWith('.pdf');
    const mime = String(asset.mimeType || asset.type || '');
    if (mime && mime !== 'application/pdf' && mime !== 'application/octet-stream' && !nameLooksPdf) {
      showError('Please upload a PDF file only.');
      return;
    }
    if (!nameLooksPdf && mime && mime !== 'application/pdf') {
      showError('Please upload a PDF file only.');
      return;
    }
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      showError('File size must be less than 5MB.');
      return;
    }

    setUploadingPO(true);
    setFormMessage(null);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        let fileObj: File | Blob | null = asset.file instanceof File ? asset.file : null;
        if (!fileObj && asset.uri) {
          const res = await fetch(asset.uri);
          const blob = await res.blob();
          try {
            fileObj = new File([blob], nameLooksPdf ? name : `${name}.pdf`, {
              type: 'application/pdf',
            });
          } catch {
            fileObj = blob;
          }
        }
        if (!fileObj) {
          throw new Error('Could not read the selected PDF.');
        }
        formData.append('poPhoto', fileObj, nameLooksPdf ? name : 'po.pdf');
      } else {
        formData.append('poPhoto', {
          uri: asset.uri,
          type: 'application/pdf',
          name: nameLooksPdf ? name : 'po.pdf',
        } as any);
      }

      const uploadRes = await apiService.upload('/dc/upload-po', formData);
      const uploadedUrl = uploadRes.poPhotoUrl || uploadRes.url;
      if (!uploadedUrl) {
        throw new Error('Upload succeeded but no file URL was returned');
      }
      setPoPhotoUrl(uploadedUrl);
      showSuccess('PO document uploaded.');
    } catch (err: any) {
      setPoPhotoUrl('');
      showError(err.message || 'Failed to upload PO document');
    } finally {
      setUploadingPO(false);
    }
  };

  const handleWebPoFile = async (e: any) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    await uploadPoAsset({
      file,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      uri: URL.createObjectURL(file),
    });
    e.target.value = '';
  };

  const proceedWithConversion = async (opts: {
    schoolName: string;
    productsPayload: any[];
    isDcOrder: boolean;
  }) => {
    const userId = user?._id || (user as any)?.id;
    if (!lead || !userId) {
      showError('User not found. Please login again.');
      return;
    }

    const isLocalFileUri = (uri: string) =>
      /^(file|content|ph|assets-library):\/\//i.test(uri);

    setSubmitting(true);
    try {
      let podProofUrl = poPhotoUrl;
      if (isLocalFileUri(poPhotoUrl)) {
        try {
          const formData = new FormData();
          formData.append('poPhoto', {
            uri: poPhotoUrl,
            type: 'application/pdf',
            name: 'po.pdf',
          } as any);
          const uploadRes = await apiService.upload('/dc/upload-po', formData);
          podProofUrl = uploadRes.poPhotoUrl || uploadRes.url || poPhotoUrl;
        } catch (uploadErr: any) {
          showError(uploadErr?.message || 'Failed to upload PO. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      if (opts.isDcOrder) {
        const updatePayload: any = {
          school_name: opts.schoolName,
          contact_person: form.contact_person || lead?.contact_person,
          contact_mobile: form.contact_mobile || lead?.contact_mobile,
          email: form.email || lead?.email,
          contact_person2: form.contact_person2,
          contact_mobile2: form.contact_mobile2,
          estimated_delivery_date: new Date(form.delivery_date).toISOString(),
          assigned_to: userId,
          products: opts.productsPayload,
          status: 'saved',
        };
        if (podProofUrl) updatePayload.pod_proof_url = podProofUrl;
        await apiService.put(`/dc-orders/${id}`, updatePayload);
      } else {
        await apiService.post(`/leads/${id}/convert-to-client`, {
          school_name: opts.schoolName,
          contact_person: form.contact_person || lead?.contact_person,
          contact_mobile: form.contact_mobile || lead?.contact_mobile,
          email: form.email || lead?.email,
          contact_person2: form.contact_person2,
          contact_mobile2: form.contact_mobile2,
          zone: lead?.zone,
          school_type: lead?.school_type,
          estimated_delivery_date: form.delivery_date
            ? new Date(form.delivery_date).toISOString()
            : undefined,
          products: opts.productsPayload,
          pod_proof_url: podProofUrl,
        });
      }

      showSuccess('Lead converted to client. Opening My Clients…');
      navigateRoot('DCClient');
    } catch (err: any) {
      showError(err.message || 'Failed to convert lead to client');
    } finally {
      setSubmitting(false);
      setPendingConvert(null);
      setSplitPreview(null);
      setSplitModalOpen(false);
    }
  };

  const handleSplitConfirm = async () => {
    if (!pendingConvert) return;
    setSplitModalOpen(false);
    await proceedWithConversion(pendingConvert);
  };

  const handleSplitCancel = () => {
    setSplitModalOpen(false);
    setSplitPreview(null);
    setPendingConvert(null);
    setSubmitting(false);
  };

  const handleTurnToClient = async () => {
    setFormMessage(null);
    const userId = user?._id || (user as any)?.id;
    if (!lead || !userId) {
      showError('User not found. Please login again.');
      return;
    }

    const schoolName = (form.school_name || lead?.school_name || '').trim();
    if (!schoolName) {
      showError('School name is required.');
      return;
    }
    const mobileError = phoneDigitsError(form.contact_mobile, true);
    if (mobileError) {
      showError(mobileError);
      return;
    }

    const actualProductDetails = productDetails.filter((pd) => !pd.isParentRow);

    if (actualProductDetails.length === 0) {
      showError('Add at least one product (tap ADD PRODUCTS) with class, quantity, and price.');
      return;
    }

    const invalidProducts = actualProductDetails.filter(
      (p) =>
        !p.product ||
        p.strength == null ||
        p.strength === '' ||
        Number(p.strength) <= 0 ||
        p.price == null ||
        p.price === '' ||
        Number(p.price) <= 0,
    );
    if (invalidProducts.length > 0) {
      showError(
        'Each product needs Quantity (Strength) and Unit Price greater than 0. Open ADD PRODUCTS and fill those fields.',
      );
      return;
    }

    if (!form.delivery_date?.trim()) {
      showError('Delivery date is required. Pick a date above.');
      return;
    }

    if (!poPhotoUrl || poPhotoUrl.trim() === '') {
      showError('PO document is required. Upload a PDF with the blue button above.');
      return;
    }

    const withTerms = assignTermsByLevelCombination(
      actualProductDetails.map((p) => ({
        product_name: p.product,
        quantity: Number(p.strength) || 1,
        unit_price: Number(p.price) || 0,
        strength: Number(p.strength) || 0,
        class: String(p.class || ''),
        level: p.level || undefined,
        specs: p.specs || undefined,
        subject: p.subject || undefined,
        deliverables: p.deliverables?.length ? p.deliverables : undefined,
        productCategory: p.category || undefined,
        term: p.term || 'Term 1',
        product: p.product,
      })),
      (productName) => {
        const product = products.find(
          (p) =>
            String(p.productName || p.name || p.product || '')
              .trim()
              .toLowerCase() === String(productName || '').trim().toLowerCase(),
        );
        return Array.isArray(product?.productLevels)
          ? product.productLevels.map((l: any) => String(l).trim()).filter(Boolean)
          : [];
      },
    );

    const productsPayload = withTerms.map((p) => ({
      product_name: p.product_name || p.product,
      quantity: Number(p.quantity) || Number(p.strength) || 1,
      unit_price: Number(p.unit_price) || 0,
      strength: Number(p.strength) || Number(p.quantity) || 0,
      class: p.class,
      level: p.level,
      specs: p.specs,
      subject: p.subject,
      deliverables: p.deliverables,
      productCategory: p.productCategory,
      term: p.term || 'Term 1',
    }));

    const term1Items = withTerms.filter(
      (p) => (p.term || 'Term 1') === 'Term 1' || (p.term || 'Term 1') === 'Both',
    );
    const term2Items = withTerms.filter((p) => (p.term || 'Term 1') === 'Term 2');

    const convertOpts = {
      schoolName,
      productsPayload,
      isDcOrder: loadedAsDcOrder,
    };

    if (term1Items.length > 0 && term2Items.length > 0) {
      setPendingConvert(convertOpts);
      setSplitPreview({
        term1: term1Items.map((p) => ({
          productName: formatProductWithLevel(String(p.product_name || p.product || ''), p.level),
          strength: Number(p.strength) || Number(p.quantity) || 0,
        })),
        term2: term2Items.map((p) => ({
          productName: formatProductWithLevel(String(p.product_name || p.product || ''), p.level),
          strength: Number(p.strength) || Number(p.quantity) || 0,
        })),
      });
      setSplitModalOpen(true);
      return;
    }

    await proceedWithConversion(convertOpts);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading lead...</Text>
      </View>
    );
  }

  const actualProductDetails = productDetails.filter(pd => !pd.isParentRow);

  return (
    <ScreenShell title="Close Lead">
      {formMessage ? (
        <MessageBanner
          type={formMessageType}
          message={formMessage}
          onDismiss={() => setFormMessage(null)}
        />
      ) : null}

      <FormField label="School Name *" value={form.school_name} onChangeText={(text: string) => setForm({ ...form, school_name: text })} placeholder="Enter school name" />
      <FormField label="Person 1 *" value={form.contact_person} onChangeText={(text: string) => setForm({ ...form, contact_person: text })} placeholder="Enter contact person" />
      <FormField label="Email 1" value={form.email} onChangeText={(text: string) => setForm({ ...form, email: text })} placeholder="Enter email" keyboardType="email-address" />
      <FormField label="Mob 1 *" value={form.contact_mobile} onChangeText={(text: string) => setForm({ ...form, contact_mobile: sanitizePhoneDigits(text) })} placeholder="10 to 15 digits" keyboardType="phone-pad" maxLength={15} />
      <FormField label="Decision Maker" value={form.contact_person2} onChangeText={(text: string) => setForm({ ...form, contact_person2: text })} placeholder="Enter decision maker name" />
      <FormField label="Email" value={form.contact_mobile2} onChangeText={(text: string) => setForm({ ...form, contact_mobile2: text })} placeholder="Enter decision maker email" keyboardType="email-address" />
      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Delivery Date *</Text>
        {Platform.OS === 'web' ? (
          React.createElement('input', {
            type: 'date',
            value: form.delivery_date || '',
            min: todayYmd(),
            onChange: (e: any) => setForm((f) => ({ ...f, delivery_date: e.target.value })),
            style: {
              width: '100%',
              padding: 14,
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              fontSize: 16,
              backgroundColor: '#fff',
            },
          })
        ) : (
          <TouchableOpacity
            style={styles.dateTouchable}
            onPress={() => setShowDeliveryDatePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateTouchableText, !form.delivery_date && styles.datePlaceholder]}>
              {form.delivery_date || 'Tap to pick date'}
            </Text>
            <Text style={styles.dateCalendarIcon}>📅</Text>
          </TouchableOpacity>
        )}
      </View>
        {showDeliveryDatePicker && (
          <Modal visible transparent animationType="slide">
            <TouchableOpacity
              style={styles.datePickerOverlay}
              activeOpacity={1}
              onPress={() => setShowDeliveryDatePicker(false)}
            />
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
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                minimumDate={new Date()}
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setForm((f) => ({
                      ...f,
                      delivery_date: selectedDate.toISOString().split('T')[0],
                    }));
                    if (Platform.OS === 'android') {
                      setShowDeliveryDatePicker(false);
                    }
                  }
                }}
                style={Platform.OS === 'ios' ? styles.datePickerIos : undefined}
              />
            </View>
          </Modal>
        )}

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Select Year *</Text>
          <Picker
            selectedValue={form.year}
            onValueChange={(itemValue) => setForm({ ...form, year: itemValue })}
            style={styles.picker}
          >
            {availableYears.map(year => (
              <Picker.Item key={year} label={year} value={year} />
            ))}
          </Picker>
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>PO Document *</Text>
          {poPhotoUrl ? (
            <View style={styles.poPhotoContainer}>
              <View style={[styles.poPhoto, { backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.error }}>PDF</Text>
              </View>
              <TouchableOpacity style={styles.removePhotoButton} onPress={() => setPoPhotoUrl('')}>
                <Text style={styles.removePhotoText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : Platform.OS === 'web' ? (
            <View>
              {React.createElement('input', {
                type: 'file',
                accept: 'application/pdf,.pdf',
                disabled: uploadingPO,
                onChange: handleWebPoFile,
                style: {
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#fff',
                  fontSize: 15,
                },
              })}
              <Text style={{ marginTop: 6, fontSize: 12, color: colors.textSecondary }}>
                {uploadingPO ? 'Uploading…' : 'PDF only, max 5MB'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadButton} onPress={pickPOPhoto} disabled={uploadingPO}>
              <Text style={styles.uploadButtonText}>{uploadingPO ? 'Uploading...' : '📄 Upload PO Document (PDF)'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.addProductsButton}
          onPress={() => {
            void loadProducts();
            setShowProductModal(true);
          }}
        >
          <Text style={styles.addProductsButtonText}>
            📦 ADD PRODUCTS {actualProductDetails.length > 0 && `(${actualProductDetails.length})`}
          </Text>
        </TouchableOpacity>

        {actualProductDetails.length > 0 ? (
          <View style={styles.productDetailsCard}>
            <Text style={styles.productDetailsTitle}>Product Details</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.productDetailsHeaderRow}>
                  <Text style={[styles.pdCol, styles.pdColProduct, styles.pdHeader]}>Product</Text>
                  <Text style={[styles.pdCol, styles.pdColLevel, styles.pdHeader]}>Level</Text>
                  <Text style={[styles.pdCol, styles.pdColClass, styles.pdHeader]}>Class</Text>
                  <Text style={[styles.pdCol, styles.pdColCat, styles.pdHeader]}>
                    Product Category
                  </Text>
                  <Text style={[styles.pdCol, styles.pdColSpecs, styles.pdHeader]}>Specs</Text>
                  <Text style={[styles.pdCol, styles.pdColQty, styles.pdHeader]}>
                    Quantity (Strength) *
                  </Text>
                  <Text style={[styles.pdCol, styles.pdColAction, styles.pdHeader]}>Action</Text>
                </View>
                {actualProductDetails.map((pd) => {
                  const categoryOptions = getCategoriesForProduct(products, pd.product);
                  return (
                  <View key={pd.id} style={styles.productDetailsRow}>
                    <Text style={[styles.pdCol, styles.pdColProduct]} numberOfLines={1}>
                      {pd.product}
                    </Text>
                    <Text style={[styles.pdCol, styles.pdColLevel]}>{pd.level || '—'}</Text>
                    <Text style={[styles.pdCol, styles.pdColClass]}>{pd.class || '—'}</Text>
                    <View style={[styles.pdCol, styles.pdColCat]}>
                      {categoryOptions.length > 0 ? (
                        <WebSelect
                          value={pd.category || ''}
                          onValueChange={(v) =>
                            setProductDetails((prev) =>
                              prev.map((r) =>
                                r.id === pd.id ? { ...r, category: v } : r,
                              ),
                            )
                          }
                          items={categoryOptions.map((c) => ({ label: c, value: c }))}
                          placeholder="Select category"
                        />
                      ) : (
                        <Text style={styles.pdPlain} numberOfLines={1}>
                          {pd.category || '—'}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.pdCol, styles.pdColSpecs]} numberOfLines={1}>
                      {pd.specs || '—'}
                    </Text>
                    <Text style={[styles.pdCol, styles.pdColQty]}>{pd.strength}</Text>
                    <TouchableOpacity
                      style={styles.pdColAction}
                      onPress={() =>
                        setProductDetails((prev) => prev.filter((r) => r.id !== pd.id))
                      }
                    >
                      <Text style={styles.pdRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  );
                })}
                <View style={[styles.productDetailsRow, styles.productDetailsTotalRow]}>
                  <Text style={[styles.pdCol, styles.pdColProduct, styles.pdHeader]}>Total:</Text>
                  <Text style={[styles.pdCol, styles.pdColLevel]} />
                  <Text style={[styles.pdCol, styles.pdColClass]} />
                  <Text style={[styles.pdCol, styles.pdColCat]} />
                  <Text style={[styles.pdCol, styles.pdColSpecs]} />
                  <Text style={[styles.pdCol, styles.pdColQty, styles.pdHeader]}>
                    {actualProductDetails.reduce((s, p) => s + (Number(p.strength) || 0), 0)}
                  </Text>
                  <Text style={[styles.pdCol, styles.pdColAction, styles.pdHeader]}>
                    ₹
                    {actualProductDetails
                      .reduce(
                        (s, p) =>
                          s + (Number(p.total) || Number(p.strength) * Number(p.price) || 0),
                        0,
                      )
                      .toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.turnToClientButton, submitting && styles.submitButtonDisabled]}
          onPress={handleTurnToClient}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.turnToClientButtonText}>
            {submitting ? 'Processing…' : '👤 Turn Lead to Client'}
          </Text>
        </TouchableOpacity>

      <CloseLeadProductsModal
        visible={showProductModal}
        onClose={() => setShowProductModal(false)}
        catalogProducts={products}
        loadingProducts={loadingProducts}
        onRefreshProducts={loadProducts}
        onDone={(rows) => setProductDetails(rows)}
      />

      <Modal visible={splitModalOpen} transparent animationType="fade">
        <View style={styles.splitOverlay}>
          <View style={styles.splitCard}>
            <Text style={styles.splitTitle}>This lead will be split into 2 DCs</Text>
            <Text style={styles.splitSubtitle}>
              Level/Term 1 → My Clients. Level/Term 2 → Term-Wise DC. Scroll if needed, then tap Confirm & Submit.
            </Text>

            <ScrollView
              style={styles.splitScroll}
              contentContainerStyle={{ paddingBottom: 8 }}
              nestedScrollEnabled
            >
              <View style={styles.splitBlock}>
                <Text style={styles.splitBlockTitleTerm1}>
                  DC 1 – My Clients (Term 1 / Level 1)
                </Text>
                {(splitPreview?.term1 || []).map((p, i) => (
                  <View key={`t1-${i}`} style={styles.splitRow}>
                    <Text style={styles.splitProduct}>• {p.productName}</Text>
                    <Text style={styles.splitQty}>Qty: {p.strength}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.splitBlock}>
                <Text style={styles.splitBlockTitleTerm2}>
                  DC 2 – Term Wise DC (Term 2 / Level 2)
                </Text>
                {(splitPreview?.term2 || []).map((p, i) => (
                  <View key={`t2-${i}`} style={styles.splitRow}>
                    <Text style={styles.splitProduct}>• {p.productName}</Text>
                    <Text style={styles.splitQty}>Qty: {p.strength}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View style={styles.splitFooter}>
              <TouchableOpacity
                style={styles.splitCancelBtn}
                onPress={handleSplitCancel}
                disabled={submitting}
              >
                <Text style={styles.splitCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.splitConfirmBtn, submitting && styles.submitButtonDisabled]}
                onPress={handleSplitConfirm}
                disabled={submitting}
              >
                <Text style={styles.splitConfirmText}>
                  {submitting ? 'Submitting…' : 'Confirm & Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, maxLength }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <WebInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder} keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, ...typography.body.medium, color: colors.textSecondary },
  header: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 24, color: colors.textLight, fontWeight: 'bold' },
  headerTitle: { ...typography.heading.h1, color: colors.textLight, flex: 1, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  fieldContainer: { marginBottom: 16 },
  label: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8 },
  input: { ...typography.body.medium, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.textPrimary },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  dateTouchableText: { ...typography.body.medium, color: colors.textPrimary },
  datePlaceholder: { color: colors.textSecondary },
  dateCalendarIcon: { fontSize: 20 },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  datePickerContainer: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
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
  datePickerIos: { height: 200 },
  picker: { height: 50, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  uploadButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  uploadButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  poPhotoContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  poPhoto: { width: 80, height: 80, borderRadius: 8, marginRight: 12 },
  removePhotoButton: { backgroundColor: colors.error, borderRadius: 8, padding: 8 },
  removePhotoText: { ...typography.body.small, color: colors.textLight },
  addProductsButton: { backgroundColor: colors.info, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  addProductsButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  productDetailsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: colors.backgroundLight,
  },
  productDetailsTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  productDetailsHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
    marginBottom: 4,
    backgroundColor: '#F1F5F9',
  },
  productDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productDetailsTotalRow: {
    borderBottomWidth: 0,
    backgroundColor: '#F1F5F9',
    marginTop: 4,
    borderRadius: 8,
  },
  pdCol: { ...typography.body.small, color: colors.textPrimary, paddingHorizontal: 4 },
  pdHeader: { fontWeight: '700', color: colors.textSecondary },
  pdColProduct: { width: 90 },
  pdColLevel: { width: 50, textAlign: 'center' },
  pdColClass: { width: 44, textAlign: 'center' },
  pdColCat: { width: 150 },
  pdPlain: { ...typography.body.small, color: colors.textPrimary },
  pdColSpecs: { width: 90 },
  pdColQty: { width: 100, textAlign: 'center' },
  pdColAction: { width: 80, alignItems: 'center', justifyContent: 'center' },
  pdRemove: { color: colors.error, fontSize: 16, fontWeight: '700' },
  turnToClientButton: {
    backgroundColor: colors.info,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 28,
  },
  turnToClientButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '700' },
  submitButton: { marginTop: 24, borderRadius: 12, overflow: 'hidden' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonGradient: { paddingVertical: 16, alignItems: 'center' },
  submitButtonText: { ...typography.label.large, color: colors.textLight, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.backgroundLight, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { ...typography.heading.h2, color: colors.textPrimary },
  modalClose: { fontSize: 24, color: colors.textSecondary },
  modalBody: { padding: 20, maxHeight: 600 },
  modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  modalButton: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  modalButtonText: { ...typography.body.medium, color: colors.textLight, fontWeight: '600' },
  productSelectionContainer: { marginBottom: 20 },
  sectionTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 12 },
  productList: { maxHeight: 200, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8 },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  productItemText: { ...typography.body.medium, color: colors.textPrimary, flex: 1 },
  productItemAdd: { ...typography.body.small, color: colors.primary, fontWeight: '600' },
  productsLoadingContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  productsLoadingText: { ...typography.body.small, color: colors.textSecondary, marginTop: 8 },
  emptyContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { ...typography.body.medium, color: colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  emptySubtext: { ...typography.body.small, color: colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  refreshButton: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  refreshButtonText: { ...typography.body.small, color: colors.textLight, fontWeight: '600' },
  rangeConfigContainer: { marginBottom: 20 },
  parentRowContainer: { backgroundColor: colors.background, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  parentRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  parentRowProduct: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  rangeControls: { flexDirection: 'row', marginBottom: 12 },
  rangeControl: { flex: 1, marginRight: 8 },
  rangeLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 4 },
  dropdownButton: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: colors.backgroundLight, 
    borderWidth: 1, 
    borderColor: colors.border, 
    borderRadius: 8, 
    padding: 12,
    height: 44,
  },
  dropdownButtonText: { ...typography.body.medium, color: colors.textPrimary },
  dropdownArrow: { ...typography.body.small, color: colors.textSecondary, marginLeft: 8 },
  classPickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  classPickerOverlayTouchable: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  classPickerContainer: { backgroundColor: colors.backgroundLight, borderRadius: 16, width: '80%', maxWidth: 400, maxHeight: '70%', zIndex: 1000, elevation: 5 },
  classPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  classPickerTitle: { ...typography.heading.h3, color: colors.textPrimary },
  classPickerClose: { fontSize: 24, color: colors.textSecondary, padding: 4 },
  classPickerList: { maxHeight: 400 },
  classPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.backgroundLight },
  classPickerItemSelected: { backgroundColor: colors.primary + '15' },
  classPickerItemText: { ...typography.body.medium, color: colors.textPrimary },
  classPickerItemTextSelected: { color: colors.primary, fontWeight: '600' },
  classPickerCheck: { fontSize: 18, color: colors.primary, fontWeight: 'bold' },
  subjectsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  subjectsLabel: { ...typography.body.small, color: colors.textSecondary, marginBottom: 8 },
  subjectsList: { flexDirection: 'row', flexWrap: 'wrap' },
  subjectChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, marginRight: 8, marginBottom: 8 },
  subjectChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  subjectChipText: { ...typography.body.small, color: colors.textPrimary },
  subjectChipTextSelected: { color: colors.textLight },
  checkboxList: { flexDirection: 'column', marginTop: 8, paddingVertical: 4 },
  checkboxItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12, 
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  checkbox: { 
    width: 24, 
    height: 24, 
    borderWidth: 2, 
    borderColor: '#6B7280', 
    borderRadius: 4, 
    backgroundColor: '#FFFFFF', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
  },
  checkboxSelected: { 
    backgroundColor: colors.primary, 
    borderColor: colors.primary,
  },
  checkboxCheck: { 
    fontSize: 14, 
    color: colors.textLight, 
    fontWeight: 'bold',
  },
  checkboxLabel: { 
    ...typography.body.medium, 
    color: colors.textPrimary, 
    flex: 1,
  },
  detailsTableContainer: { marginBottom: 20 },
  tableWrapper: { minWidth: 1160 },
  tableHeader: { flexDirection: 'row', backgroundColor: colors.background, padding: 8, borderBottomWidth: 2, borderBottomColor: colors.border, alignItems: 'center' },
  tableHeaderText: { ...typography.body.small, color: colors.textPrimary, fontWeight: '600', textAlign: 'center' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, padding: 8, alignItems: 'center', minHeight: 50 },
  tableCell: { ...typography.body.small, color: colors.textPrimary, textAlign: 'center', justifyContent: 'center', paddingVertical: 4 },
  colProduct: { width: 120, paddingHorizontal: 4 },
  colClass: { width: 60, paddingHorizontal: 4 },
  colCategory: { width: 120, paddingHorizontal: 4 },
  colSpecs: { width: 100, paddingHorizontal: 4 },
  colSubject: { width: 100, paddingHorizontal: 4 },
  colStrength: { width: 80, paddingHorizontal: 4 },
  colPrice: { width: 80, paddingHorizontal: 4 },
  colTotal: { width: 80, paddingHorizontal: 4 },
  colLevel: { width: 80, paddingHorizontal: 4 },
  colTerm: { width: 88, paddingHorizontal: 4 },
  colAction: { width: 60, paddingHorizontal: 4 },
  tableInput: { backgroundColor: colors.backgroundLight, borderWidth: 1, borderColor: colors.border, borderRadius: 4, padding: 6, textAlign: 'center', fontSize: 12, height: 32, color: colors.textPrimary },
  tablePicker: { height: 32, width: '100%', color: '#111827', backgroundColor: colors.backgroundLight, fontSize: 14 },
  tdPickerWrap: { backgroundColor: colors.backgroundLight },
  tableFooter: { flexDirection: 'column', padding: 12, backgroundColor: colors.background, borderTopWidth: 2, borderTopColor: colors.border },
  tableFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tableFooterLabel: { ...typography.body.medium, color: colors.textPrimary, fontWeight: '600' },
  tableFooterValue: { ...typography.body.medium, color: colors.primary, fontWeight: '600' },
  removeButton: { fontSize: 18, color: colors.error, fontWeight: 'bold' },
  splitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  splitCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 20,
  },
  splitTitle: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 6 },
  splitSubtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  splitScroll: { maxHeight: 320, marginBottom: 8 },
  splitBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  splitBlockTitleTerm1: {
    ...typography.body.medium,
    color: '#15803d',
    fontWeight: '700',
    marginBottom: 8,
  },
  splitBlockTitleTerm2: {
    ...typography.body.medium,
    color: '#1d4ed8',
    fontWeight: '700',
    marginBottom: 8,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
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
  splitConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  splitConfirmText: { ...typography.body.medium, color: colors.textLight, fontWeight: '700' },
});
