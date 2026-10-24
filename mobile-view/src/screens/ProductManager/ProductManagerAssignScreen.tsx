import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../services/api';
import { colors, radii, spacing } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebButton, WebInput } from '../../ui/WebPrimitives';
import { showAlert } from '../../utils/showAlert';
import ProductManagerScreen from './ProductManagerScreen';

type Manager = { _id: string; name: string; email: string; phone?: string; productIds: string[] };
type Product = { _id: string; name: string; assignedTo: { _id: string; name: string } | null };
type Overview = { managers: Manager[]; products: Product[] };

/** Same flow as the web Assign products page (app/dashboard/product-managers/page.tsx). */
export default function ProductManagerAssignScreen({ navigation }: { navigation: any }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [manager, setManager] = useState<Manager | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  /** Manager whose dashboard is open (web: /dashboard/product-manager/:id). */
  const [viewing, setViewing] = useState<Manager | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/product-manager/overview');
      setOverview({
        managers: Array.isArray(data?.managers) ? data.managers : [],
        products: Array.isArray(data?.products) ? data.products : [],
      });
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to load product assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const managers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = overview?.managers || [];
    if (!needle) return rows;
    return rows.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(needle));
  }, [overview, search]);

  const productName = (id: string) => overview?.products.find((product) => product._id === id)?.name || id;

  const openAssign = (row: Manager) => {
    setManager(row);
    setSelected(row.productIds || []);
  };

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const save = async () => {
    if (!manager) return;
    setSaving(true);
    try {
      await apiService.put('/product-manager/assignments', { managerId: manager._id, productIds: selected });
      setManager(null);
      showAlert('Saved', 'Products assigned');
      await load();
    } catch (error: any) {
      showAlert('Error', error?.message || 'Failed to assign products');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      title="Assign Products"
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
    >
      <Text style={styles.help}>
        Create the person under Users / Employees with the Product Manager role, then assign their products here. Each
        product stays with one Product Manager. Saving moves it off the previous manager.
      </Text>
      <WebInput value={search} onChangeText={setSearch} placeholder="Search Product Manager" autoCapitalize="none" />

      {managers.map((row) => (
        <View key={row._id} style={styles.card}>
          <Text style={styles.name}>{row.name}</Text>
          <Text style={styles.meta}>
            {row.email}
            {row.phone ? ` · ${row.phone}` : ''}
          </Text>
          <Text style={styles.products}>
            {row.productIds?.length ? row.productIds.map(productName).join(', ') : 'No products assigned'}
          </Text>
          <View style={styles.actions}>
            <View style={styles.actionCell}>
              <WebButton
                title="View"
                variant="outline"
                onPress={() => setViewing(row)}
              />
            </View>
            <View style={styles.actionCell}>
              <WebButton title="Assign" onPress={() => openAssign(row)} />
            </View>
          </View>
        </View>
      ))}
      {!loading && managers.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.meta}>
            {search.trim() ? 'No Product Managers match your search.' : 'No Product Managers yet. Add one from New Employee.'}
          </Text>
        </View>
      ) : null}

      <Modal visible={Boolean(manager)} animationType="slide" transparent onRequestClose={() => !saving && setManager(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Assign products to {manager?.name}</Text>
            <Text style={styles.sheetDesc}>Only these products will be visible to this Product Manager.</Text>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {(overview?.products || []).map((product) => {
                const on = selected.includes(product._id);
                const taken = product.assignedTo && product.assignedTo._id !== manager?._id;
                return (
                  <TouchableOpacity
                    key={product._id}
                    style={[styles.choice, on && styles.choiceOn]}
                    onPress={() => toggle(product._id)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Ionicons
                      name={on ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={on ? colors.primary : colors.textMuted}
                    />
                    <View style={styles.choiceText}>
                      <Text style={styles.choiceName}>{product.name}</Text>
                      {taken ? (
                        <Text style={styles.choiceNote}>
                          Currently with {product.assignedTo?.name}. Saving moves it here.
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {!overview?.products?.length ? <Text style={styles.meta}>No products found.</Text> : null}
            </ScrollView>
            <View style={styles.actions}>
              <View style={styles.actionCell}>
                <WebButton title="Cancel" variant="outline" disabled={saving} onPress={() => setManager(null)} />
              </View>
              <View style={styles.actionCell}>
                <WebButton title={saving ? 'Saving…' : 'Save'} loading={saving} disabled={saving} onPress={() => void save()} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ProductManagerScreen reads managerId as a prop, not a route param, so it is embedded here. */}
      <Modal visible={Boolean(viewing)} animationType="slide" onRequestClose={() => setViewing(null)}>
        <View style={styles.viewRoot}>
          <View style={styles.viewBar}>
            <TouchableOpacity onPress={() => setViewing(null)} hitSlop={12} style={styles.viewClose}>
              <Ionicons name="close" size={26} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.viewTitle} numberOfLines={1}>
              {viewing?.name || 'Product Manager'}
            </Text>
          </View>
          {viewing ? <ProductManagerScreen embedded managerId={viewing._id} navigation={navigation} /> : null}
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.textSecondary, marginBottom: 12, fontSize: 13, lineHeight: 18 },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: radii.lg,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontWeight: '700', color: colors.textPrimary, fontSize: 15 },
  meta: { marginTop: 4, color: colors.textSecondary, fontSize: 13 },
  products: { marginTop: 6, color: colors.textPrimary, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionCell: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.backgroundLight,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '85%',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  sheetDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 12 },
  list: { flexGrow: 0 },
  choice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 8,
  },
  choiceOn: { borderColor: colors.primary, backgroundColor: colors.accent },
  choiceText: { flex: 1 },
  choiceName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  choiceNote: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  viewRoot: { flex: 1, backgroundColor: colors.background },
  viewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  viewClose: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  viewTitle: { flex: 1, fontSize: 20, fontWeight: '600', color: colors.textPrimary, paddingHorizontal: 8 },
});
