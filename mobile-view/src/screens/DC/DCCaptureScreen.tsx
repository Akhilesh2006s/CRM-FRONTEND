import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiService } from '../../services/api';
import { phoneDigitsError, sanitizePhoneDigits } from '../../utils/phone';
import { getCurrentLocation, getTownFromPincode } from '../../services/location';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { colors } from '../../theme/colors';
import MessageBanner from '../../components/MessageBanner';

const PRODUCTS = [
  'Abacus',
  'Vedic Maths',
  'EELL',
  'IIT',
  'CodeChamp',
  'Math Lab',
  'Financial Literacy',
  'Brain Bytes',
  'Spelling Bee',
  'Skill Pro',
];

const SCHOOL_CATEGORIES = [
  'Hot',
  'Warm',
  'Visit Again',
  'Not Met Management',
  'Not Interested',
];

const PRODUCT_CATEGORIES = [
  'Hot',
  'Warm',
  'Visit Again',
  'Not Met Management',
  'Not Interested',
];

interface ProductRow {
  id: string;
  product: string;
  class: string;
  category: string;
  productCategory: string;
  quantity: number;
  strength: number;
}

export default function DCCaptureScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const dcId = route.params?.dcId;
  const existingDC = route.params?.dc;

  const [schoolName, setSchoolName] = useState(existingDC?.dcOrderId?.school_name || existingDC?.customerName || '');
  const [contactPerson, setContactPerson] = useState(existingDC?.dcOrderId?.contact_person || '');
  const [contactMobile, setContactMobile] = useState(existingDC?.dcOrderId?.contact_mobile || existingDC?.customerPhone || '');
  const [email, setEmail] = useState(existingDC?.dcOrderId?.email || existingDC?.customerEmail || '');
  const [address, setAddress] = useState(existingDC?.dcOrderId?.address || existingDC?.customerAddress || '');
  const [pincode, setPincode] = useState('');
  const [town, setTown] = useState(existingDC?.dcOrderId?.location || '');
  const [schoolCategory, setSchoolCategory] = useState(existingDC?.dcOrderId?.schoolCategory || '');
  const [schoolRemarks, setSchoolRemarks] = useState(existingDC?.dcOrderId?.remarks || '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<{ latitude: number; longitude: number } | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([
    {
      id: '1',
      product: 'Abacus',
      class: '',
      category: '',
      productCategory: '',
      quantity: 0,
      strength: 0,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (existingDC?.productDetails && existingDC.productDetails.length > 0) {
      setProducts(
        existingDC.productDetails.map((p: any, idx: number) => ({
          id: String(idx + 1),
          product: p.product || 'Abacus',
          class: p.class || '',
          category: p.category || '',
          productCategory: p.productCategory || '',
          quantity: p.quantity || 0,
          strength: p.strength || 0,
        }))
      );
    }
  }, [existingDC]);

  const capturePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const getLocation = async () => {
    try {
      setLoading(true);
      const location = await getCurrentLocation();
      setLocationData(location);
      Alert.alert('Success', 'Location captured successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  const handlePincodeChange = async (text: string) => {
    setPincode(text);
    if (text.length === 6) {
      try {
        const result = await getTownFromPincode(text);
        setTown(result.town);
      } catch (error) {
        // Town lookup failed, user can enter manually
      }
    }
  };

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: Date.now().toString(),
        product: 'Abacus',
        class: '',
        category: '',
        productCategory: '',
        quantity: 0,
        strength: 0,
      },
    ]);
  };

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  const updateProduct = (id: string, field: keyof ProductRow, value: any) => {
    setProducts(
      products.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const clearMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (!schoolName) {
      setErrorMessage('School name is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!contactMobile) {
      setErrorMessage('Contact mobile is required');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const mobileError = phoneDigitsError(contactMobile, true);
    if (mobileError) {
      setErrorMessage(mobileError);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (schoolCategory && !schoolRemarks) {
      setErrorMessage('Remarks are mandatory when school category is selected');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!locationData) {
      setErrorMessage('Please capture location');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const productsWithoutCategory = products.filter((p) => p.product && !p.productCategory);
    if (productsWithoutCategory.length > 0) {
      setErrorMessage('Please select category for all products');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setLoading(true);
    try {
      const productDetails = products
        .filter((p) => p.product)
        .map((p) => ({
          product: p.product,
          class: p.class,
          category: p.category,
          productCategory: p.productCategory,
          quantity: p.quantity || 0,
          strength: p.strength || 0,
        }));

      const dcData = {
        customerName: schoolName,
        customerPhone: contactMobile,
        customerEmail: email,
        customerAddress: address,
        product: products[0]?.product || 'Abacus',
        requestedQuantity: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        productDetails,
        dcDate: new Date(),
        dcRemarks: schoolRemarks,
        dcCategory: schoolCategory,
        poPhotoUrl: photo,
      };

      if (dcId) {
        await apiService.put(`/dc/${dcId}`, {
          ...dcData,
          dcOrderId: existingDC?.dcOrderId?._id,
        });
        setSuccessMessage('DC updated successfully.');
        setErrorMessage(null);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        const dcOrderData = {
          school_name: schoolName,
          contact_person: contactPerson,
          contact_mobile: contactMobile,
          email: email,
          address: address,
          location: town,
          pincode: pincode,
          schoolCategory: schoolCategory,
          remarks: schoolRemarks,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          products: productDetails.map((p) => ({
            product_name: p.product,
            quantity: p.quantity,
          })),
          assigned_to: user?._id,
          created_by: user?._id,
        };

        const dcOrder = await apiService.post('/dc-orders/create', dcOrderData);
        await apiService.post('/dc/raise', {
          dcOrderId: dcOrder._id,
          ...dcData,
        });
        setSuccessMessage('DC created successfully.');
        setErrorMessage(null);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    } catch (error: any) {
      setErrorMessage(error.response?.data?.message || error.message || 'Failed to save DC');
      setSuccessMessage(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell title="DC Capture" loading={loading}>
      {successMessage && (
        <MessageBanner
          type="success"
          message={successMessage}
          actionLabel={dcId ? 'Go Back' : 'View DCs'}
          onAction={() => (dcId ? navigation.goBack() : navigation.navigate('DCList'))}
        />
      )}
      {errorMessage && (
        <MessageBanner type="error" message={errorMessage} onDismiss={clearMessages} />
      )}

      <PageSection title="School">
        <WebLabel>School Name *</WebLabel>
        <WebInput value={schoolName} onChangeText={setSchoolName} placeholder="Enter school name" />
        <WebLabel>Contact Person</WebLabel>
        <WebInput value={contactPerson} onChangeText={setContactPerson} placeholder="Enter contact person name" />
        <WebLabel>Contact Mobile *</WebLabel>
        <WebInput
          value={contactMobile}
          onChangeText={(text) => setContactMobile(sanitizePhoneDigits(text))}
          placeholder="10 to 15 digits"
          keyboardType="phone-pad"
          maxLength={15}
        />
        <WebLabel>Email</WebLabel>
        <WebInput
          value={email}
          onChangeText={setEmail}
          placeholder="Enter email"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </PageSection>

      <PageSection title="Address">
        <WebLabel>Address</WebLabel>
        <WebInput
          style={styles.textArea}
          value={address}
          onChangeText={setAddress}
          placeholder="Enter address"
          multiline
          numberOfLines={3}
        />
        <View style={styles.twoCol}>
          <View style={styles.flex1}>
            <WebLabel>Pincode</WebLabel>
            <WebInput
              value={pincode}
              onChangeText={handlePincodeChange}
              placeholder="6 digits"
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
          <View style={styles.flex1}>
            <WebLabel>Town</WebLabel>
            <WebInput value={town} onChangeText={setTown} placeholder="Auto from pincode" />
          </View>
        </View>
      </PageSection>

      <PageSection title="School category">
        <View style={styles.categoryGrid}>
          {SCHOOL_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryButton, schoolCategory === cat && styles.categoryButtonSelected]}
              onPress={() => setSchoolCategory(cat)}
            >
              <Text style={[styles.categoryButtonText, schoolCategory === cat && styles.categoryButtonTextSelected]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {schoolCategory && (
          <View style={styles.mt12}>
            <WebLabel>Remarks *</WebLabel>
            <WebInput
              style={styles.textArea}
              value={schoolRemarks}
              onChangeText={setSchoolRemarks}
              placeholder="Required for the selected category"
              multiline
              numberOfLines={4}
            />
          </View>
        )}
      </PageSection>

      <PageSection title="Photo & location">
        <WebLabel>Photo</WebLabel>
        <TouchableOpacity style={styles.photoButton} onPress={capturePhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <Text style={styles.photoButtonText}>Capture Photo</Text>
          )}
        </TouchableOpacity>
        <WebLabel>Location *</WebLabel>
        <TouchableOpacity
          style={[styles.locationButton, locationData && styles.locationButtonSuccess]}
          onPress={getLocation}
          disabled={loading}
        >
          <Text style={[styles.locationButtonText, locationData && styles.locationButtonTextSuccess]}>
            {locationData ? 'Location Captured ✓' : 'Capture Location'}
          </Text>
        </TouchableOpacity>
        {locationData && (
          <Text style={styles.locationText}>
            Lat: {locationData.latitude.toFixed(6)}, Lng: {locationData.longitude.toFixed(6)}
          </Text>
        )}
      </PageSection>

      <View style={styles.section}>
        <View style={styles.productsHeader}>
          <Text style={styles.sectionTitle}>Products</Text>
          <TouchableOpacity onPress={addProduct} hitSlop={8}>
            <Text style={styles.addButton}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {products.map((product, index) => (
          <View key={product.id} style={styles.productCard}>
            <View style={styles.productHeader}>
              <Text style={styles.productNumber}>Product {index + 1}</Text>
              {products.length > 1 && (
                <TouchableOpacity onPress={() => removeProduct(product.id)} hitSlop={8}>
                  <Text style={styles.removeButton}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <WebLabel>Product *</WebLabel>
            <View style={styles.picker}>
              {PRODUCTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pickerOption, product.product === p && styles.pickerOptionSelected]}
                  onPress={() => updateProduct(product.id, 'product', p)}
                >
                  <Text style={[styles.pickerOptionText, product.product === p && styles.pickerOptionTextSelected]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.twoCol}>
              <View style={styles.flex1}>
                <WebLabel>Class</WebLabel>
                <WebInput
                  value={product.class}
                  onChangeText={(value) => updateProduct(product.id, 'class', value)}
                  placeholder="Class"
                />
              </View>
              <View style={styles.flex1}>
                <WebLabel>Category</WebLabel>
                <WebInput
                  value={product.category}
                  onChangeText={(value) => updateProduct(product.id, 'category', value)}
                  placeholder="Category"
                />
              </View>
            </View>

            <WebLabel>Series *</WebLabel>
            <View style={[styles.categoryGrid, styles.mb12]}>
              {PRODUCT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryButtonSmall, product.productCategory === cat && styles.categoryButtonSelected]}
                  onPress={() => updateProduct(product.id, 'productCategory', cat)}
                >
                  <Text
                    style={[
                      styles.categoryButtonTextSmall,
                      product.productCategory === cat && styles.categoryButtonTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.twoCol}>
              <View style={styles.flex1}>
                <WebLabel>Quantity</WebLabel>
                <WebInput
                  value={product.quantity.toString()}
                  onChangeText={(value) => updateProduct(product.id, 'quantity', parseInt(value) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.flex1}>
                <WebLabel>Strength</WebLabel>
                <WebInput
                  value={product.strength.toString()}
                  onChangeText={(value) => updateProduct(product.id, 'strength', parseInt(value) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      <WebButton title="Submit DC" onPress={handleSubmit} loading={loading} disabled={loading} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  twoCol: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  mt12: { marginTop: 12 },
  mb12: { marginBottom: 12 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E0F2FE' },
  categoryButtonSelected: { backgroundColor: '#0284C7' },
  categoryButtonText: { fontSize: 13, fontWeight: '600', color: '#0369A1' },
  categoryButtonTextSelected: { color: '#FFFFFF' },
  categoryButtonSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#E0F2FE' },
  categoryButtonTextSmall: { fontSize: 13, fontWeight: '600', color: '#0369A1' },
  photoButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    marginBottom: 14,
  },
  photo: { width: '100%', height: 200, borderRadius: 10 },
  photoButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  locationButton: {
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: '#DCE3EC',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButtonSuccess: { backgroundColor: colors.successLight, borderColor: colors.success },
  locationButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '600' },
  locationButtonTextSuccess: { color: '#15803D' },
  locationText: { marginTop: 8, fontSize: 13, color: colors.textTertiary },
  productsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addButton: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' },
  productCard: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
  },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  productNumber: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  removeButton: { color: colors.error, fontSize: 13, fontWeight: '600' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pickerOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#E0F2FE' },
  pickerOptionSelected: { backgroundColor: '#0284C7' },
  pickerOptionText: { fontSize: 13, fontWeight: '600', color: '#0369A1' },
  pickerOptionTextSelected: { color: '#FFFFFF' },
});
