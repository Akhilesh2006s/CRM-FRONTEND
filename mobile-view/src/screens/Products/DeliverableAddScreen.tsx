import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getRoleFlags } from '../../utils/roles';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { WebInput, WebButton, WebLabel } from '../../ui/WebPrimitives';
import { navigateRoot } from '../../navigation/navigationRef';
import { showAlert } from '../../utils/showAlert';
import { colors } from '../../theme/colors';

/** Matches web `products/deliverables/add` */
export default function DeliverableAddScreen({ route, navigation }: any) {
  const { user } = useAuth();
  const { isAdmin } = getRoleFlags(user);
  const productId = route.params?.productId as string | undefined;
  const [productName, setProductName] = useState(route.params?.productName || '');
  const [deliverableName, setDeliverableName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      showAlert('Access denied', 'Admin privileges required.');
      navigation.goBack();
      return;
    }
    if (!productId) {
      showAlert('Error', 'Product not specified');
      navigateRoot('DeliverablesList');
      return;
    }
    (async () => {
      try {
        const product = await apiService.get(`/products/${productId}`);
        setProductName(product?.productName || productName || '');
      } catch {
        showAlert('Error', 'Failed to load product');
        navigateRoot('DeliverablesList');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId, isAdmin]);

  const handleSave = async () => {
    setFormError(null);
    const trimmed = deliverableName.trim();
    if (!trimmed) {
      setFormError('Deliverable name is required');
      showAlert('Validation', 'Deliverable name is required');
      return;
    }
    if (!productId) {
      setFormError('Product not specified');
      showAlert('Error', 'Product not specified');
      return;
    }
    setSaving(true);
    try {
      await apiService.post('/deliverables', { deliverableName: trimmed, productId });
      showAlert('Success', 'Deliverable saved successfully!');
      if (
        !navigateRoot('DeliverableView', {
          productId,
          productName: productName || undefined,
        })
      ) {
        navigation.replace('DeliverableView', {
          productId,
          productName: productName || undefined,
        });
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to save deliverable';
      setFormError(msg);
      showAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      title="Add Deliverable"
      subtitle={productName ? `Product: ${productName}` : undefined}
      loading={loading}
    >
      <PageSection title="Deliverable details">
        <WebLabel>Deliverable Name *</WebLabel>
        <WebInput
          placeholder="Enter deliverable name"
          value={deliverableName}
          onChangeText={(t) => {
            setDeliverableName(t);
            if (formError) setFormError(null);
          }}
        />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
      </PageSection>
      <View style={styles.btnRow}>
        <View style={{ flex: 1 }}>
          <WebButton
            title="Cancel"
            variant="outline"
            onPress={() => {
              if (productId) {
                if (
                  !navigateRoot('DeliverableView', {
                    productId,
                    productName: productName || undefined,
                  })
                ) {
                  navigation.goBack();
                }
              } else {
                navigateRoot('DeliverablesList');
              }
            }}
            disabled={saving}
          />
        </View>
        <View style={{ flex: 1 }}>
          <WebButton
            title={saving ? 'Saving…' : 'Save'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginBottom: 10,
    marginTop: -4,
  },
  btnRow: { flexDirection: 'row', gap: 8 },
});
