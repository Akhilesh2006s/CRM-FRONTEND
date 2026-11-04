import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ScreenShell, { PageSection } from '../../ui/ScreenShell';
import { colors } from '../../theme/colors';

const LINKS = [
  { label: 'Warehouse Inventory', route: 'WarehouseInventoryItems' },
  { label: 'Employee Returns', route: 'ReturnsEmployee' },
  { label: 'Warehouse Returns', route: 'ReturnsWarehouse' },
];

export default function InventoryScreen({ navigation }: any) {
  return (
    <ScreenShell title="Stock Returns">
      <PageSection title="Choose a section">
        {LINKS.map((l, i) => (
          <TouchableOpacity
            key={l.route}
            style={[styles.linkItem, i === LINKS.length - 1 && styles.linkLast]}
            onPress={() => navigation.navigate(l.route)}
          >
            <Text style={styles.linkText}>{l.label}</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </PageSection>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  linkItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  linkLast: { borderBottomWidth: 0 },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  linkArrow: { fontSize: 20, color: colors.textMuted },
});
