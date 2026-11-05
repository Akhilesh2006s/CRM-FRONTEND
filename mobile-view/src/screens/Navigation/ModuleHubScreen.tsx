import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '../../ui/ScreenShell';
import { EmptyState } from '../../ui/Kit';
import { useAuth } from '../../context/AuthContext';
import { getNavSections } from '../../config/navConfig';
import { iconForScreen } from '../../config/moduleIcons';
import { navigateRoot } from '../../navigation/navigationRef';
import { colors } from '../../theme/colors';
import { MODULE_COLORS } from '../Dashboard/DashboardScreen';

/** One module (Clients, Leads, Expenses…) opened from a Home tile: its options as tiles. */
export default function ModuleHubScreen({ route }: any) {
  const { user } = useAuth();
  const title: string = route?.params?.title || '';
  const sections = getNavSections(user);
  const index = sections.findIndex((s) => s.title === title);
  const section = sections[index];
  const color = MODULE_COLORS[Math.max(index, 0) % MODULE_COLORS.length];

  return (
    <ScreenShell title={title || 'Menu'}>
      {!section ? (
        <EmptyState title="Nothing here" message="This module is not available for your role." />
      ) : (
        <View style={styles.grid}>
          {section.items.map((item) => {
            const icon = iconForScreen(item.screen);
            return (
              <TouchableOpacity
                key={item.screen + item.label}
                style={styles.tile}
                activeOpacity={0.8}
                onPress={() => navigateRoot(item.screen, item.params)}
              >
                <View style={[styles.icon, { backgroundColor: color + '1A' }]}>
                  <Ionicons name={icon.name} size={24} color={color} />
                </View>
                <Text style={styles.label} numberOfLines={2}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    minHeight: 112,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
