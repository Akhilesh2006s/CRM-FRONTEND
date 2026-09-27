import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { apiService } from '../../services/api';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton } from '../../ui/WebPrimitives';

type Manager = { _id: string; name: string; email: string; productIds: string[] };
type Product = { _id: string; name: string; assignedTo: { _id: string; name: string } | null };
type Overview = { managers: Manager[]; products: Product[] };

export default function ProductManagerAssignScreen({ navigation }: { navigation: any }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [manager, setManager] = useState<Manager | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await apiService.get('/product-manager/overview');
    setOverview(data);
  };

  useEffect(() => {
    load().catch((error: any) => Alert.alert('Error', error?.message || 'Failed to load assignments'));
  }, []);

  const productName = (id: string) => overview?.products.find((product) => product._id === id)?.name || id;

  const save = async () => {
    if (!manager) return;
    setSaving(true);
    try {
      await apiService.put('/product-manager/assignments', { managerId: manager._id, productIds: selected });
      setManager(null);
      await load();
      Alert.alert('Saved', 'Products assigned');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to assign products');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell title="Assign Products">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Each product stays with one Product Manager. Saving moves it off the previous manager.
        </Text>
        {(overview?.managers || []).map((row) => (
          <View key={row._id} style={styles.card}>
            <Text style={styles.name}>{row.name}</Text>
            <Text style={styles.meta}>{row.email}</Text>
            <Text style={styles.meta}>
              {row.productIds.length ? row.productIds.map(productName).join(', ') : 'No products assigned'}
            </Text>
            <View style={styles.actions}>
              <WebButton title="View" variant="outline" onPress={() => navigation.navigate('ProductManager', { managerId: row._id })} />
              <WebButton
                title="Assign"
                onPress={() => {
                  setManager(row);
                  setSelected(row.productIds);
                }}
              />
            </View>
          </View>
        ))}
        {manager ? (
          <View style={styles.card}>
            <Text style={styles.name}>Products for {manager.name}</Text>
            {(overview?.products || []).map((product) => {
              const on = selected.includes(product._id);
              return (
                <Text
                  key={product._id}
                  style={[styles.choice, on && styles.choiceOn]}
                  onPress={() =>
                    setSelected((current) =>
                      current.includes(product._id) ? current.filter((id) => id !== product._id) : [...current, product._id]
                    )
                  }
                >
                  {on ? '✓ ' : ''}
                  {product.name}
                  {product.assignedTo && product.assignedTo._id !== manager._id ? ` · with ${product.assignedTo.name}` : ''}
                </Text>
              );
            })}
            <WebButton title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
          </View>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  help: { color: colors.textSecondary, marginBottom: 12 },
  card: { backgroundColor: colors.backgroundLight, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  name: { fontWeight: '700', color: colors.textPrimary },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  choice: { paddingVertical: 8, color: colors.textPrimary },
  choiceOn: { fontWeight: '700' },
});
