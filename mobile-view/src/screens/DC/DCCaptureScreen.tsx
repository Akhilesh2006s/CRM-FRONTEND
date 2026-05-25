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
import { getCurrentLocation, getTownFromPincode } from '../../services/location';
import { useAuth } from '../../context/AuthContext';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, DataTable } from '../../ui/WebPrimitives';
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

        const dcOrder = await apiService.post('/dc-orders', dcOrderData);
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
    <ScreenShell title="D C Capture" loading={loading}>
      <PageSection title="D C Capture">
<View style={styles.content}>
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DC Capture</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>School Name *</Text>
          <WebInput
            style={styles.input}
            value={schoolName}
            onChangeText={setSchoolName}
            placeholder="Enter school name"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Contact Person</Text>
          <WebInput
            style={styles.input}
            value={contactPerson}
            onChangeText={setContactPerson}
            placeholder="Enter contact person name"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Contact Mobile *</Text>
          <WebInput
            style={styles.input}
            value={contactMobile}
            onChangeText={setContactMobile}
            placeholder="Enter mobile number"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <WebInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Address</Text>
          <WebInput
            style={[styles.input, styles.textArea]}
            value={address}
            onChangeText={setAddress}
            placeholder="Enter address"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Pincode</Text>
          <WebInput
            style={styles.input}
            value={pincode}
            onChangeText={handlePincodeChange}
            placeholder="Enter 6-digit pincode"
            keyboardType="numeric"
            maxLength={6}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Town</Text>
          <WebInput
            style={styles.input}
            value={town}
            onChangeText={setTown}
            placeholder="Town name (auto-filled from pincode)"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>School Category</Text>
          <View style={styles.categoryGrid}>
            {SCHOOL_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  schoolCategory === cat && styles.categoryButtonSelected,
                ]}
                onPress={() => setSchoolCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    schoolCategory === cat && styles.categoryButtonTextSelected,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {schoolCategory && (
          <View style={styles.section}>
            <Text style={styles.label}>Remarks * (Mandatory for selected category)</Text>
            <WebInput
              style={[styles.input, styles.textArea]}
              value={schoolRemarks}
              onChangeText={setSchoolRemarks}
              placeholder="Enter remarks"
              multiline
              numberOfLines={4}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Photo</Text>
          <TouchableOpacity style={styles.photoButton} onPress={capturePhoto}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} />
            ) : (
              <Text style={styles.photoButtonText}>Capture Photo</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location *</Text>
          <TouchableOpacity
            style={[styles.locationButton, locationData && styles.locationButtonSuccess]}
            onPress={getLocation}
            disabled={loading}
          >
            <Text style={styles.locationButtonText}>
              {locationData ? 'Location Captured ✓' : 'Capture Location'}
            </Text>
          </TouchableOpacity>
          {locationData && (
            <Text style={styles.locationText}>
              Lat: {locationData.latitude.toFixed(6)}, Lng: {locationData.longitude.toFixed(6)}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.productsHeader}>
            <Text style={styles.label}>Products</Text>
            <TouchableOpacity onPress={addProduct}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {products.map((product, index) => (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productHeader}>
                <Text style={styles.productNumber}>Product {index + 1}</Text>
                {products.length > 1 && (
                  <TouchableOpacity onPress={() => removeProduct(product.id)}>
                    <Text style={styles.removeButton}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.productRow}>
                <View style={styles.productField}>
                  <Text style={styles.fieldLabel}>Product *</Text>
                  <View style={styles.picker}>
                    {PRODUCTS.map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.pickerOption,
                          product.product === p && styles.pickerOptionSelected,
                        ]}
                        onPress={() => updateProduct(product.id, 'product', p)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            product.product === p && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.productRow}>
                <View style={[styles.productField, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.fieldLabel}>Class</Text>
                  <WebInput
                    style={styles.input}
                    value={product.class}
                    onChangeText={(value) => updateProduct(product.id, 'class', value)}
                    placeholder="Class"
                  />
                </View>

                <View style={[styles.productField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Category</Text>
                  <WebInput
                    style={styles.input}
                    value={product.category}
                    onChangeText={(value) => updateProduct(product.id, 'category', value)}
                    placeholder="Category"
                  />
                </View>
              </View>

              <View style={styles.productRow}>
                <View style={styles.productField}>
                  <Text style={styles.fieldLabel}>Product Category *</Text>
                  <View style={styles.categoryGrid}>
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryButtonSmall,
                          product.productCategory === cat && styles.categoryButtonSelected,
                        ]}
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
                </View>
              </View>

              <View style={styles.productRow}>
                <View style={[styles.productField, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.fieldLabel}>Quantity</Text>
                  <WebInput
                    style={styles.input}
                    value={product.quantity.toString()}
                    onChangeText={(value) => updateProduct(product.id, 'quantity', parseInt(value) || 0)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.productField, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Strength</Text>
                  <WebInput
                    style={styles.input}
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

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit DC</Text>
          )}
        </TouchableOpacity>
      </View>
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#333',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  categoryButtonSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 6,
    marginBottom: 6,
  },
  categoryButtonTextSmall: {
    fontSize: 12,
    color: '#333',
  },
  photoButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  photoButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  locationButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  locationButtonSuccess: {
    backgroundColor: '#d4edda',
    borderColor: '#28a745',
  },
  locationButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  locationText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  productNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeButton: {
    color: '#dc3545',
    fontSize: 14,
  },
  productRow: {
    marginBottom: 12,
  },
  productField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    color: '#666',
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
  },
  pickerOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerOptionText: {
    fontSize: 12,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#fff',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

