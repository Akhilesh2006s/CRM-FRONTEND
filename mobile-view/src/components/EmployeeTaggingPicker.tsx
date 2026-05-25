import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { apiService } from '../services/api';

export const TAGGING_ROLES = [
  'Executive',
  'Coordinator',
  'Senior Coordinator',
  'Finance Manager',
  'Warehouse Manager',
];

type Props = {
  role: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeId?: string;
};

export default function EmployeeTaggingPicker({ role, selectedIds, onChange, excludeId }: Props) {
  const [options, setOptions] = useState<{ _id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    if (!TAGGING_ROLES.includes(role)) return;
    apiService
      .get<any[]>('/employees?isActive=true')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setOptions(list.filter((e) => e._id !== excludeId));
      })
      .catch(() => setOptions([]));
  }, [role, excludeId]);

  if (!TAGGING_ROLES.includes(role)) return null;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Employee tagging</Text>
      {options.length === 0 ? (
        <Text style={styles.empty}>No employees available to tag</Text>
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled>
          {options.map((e) => (
            <TouchableOpacity key={e._id} style={styles.row} onPress={() => toggle(e._id)}>
              <View style={[styles.checkbox, selectedIds.includes(e._id) && styles.checkboxOn]} />
              <Text style={styles.label}>
                {e.name} ({e.role})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { ...typography.label.medium, color: colors.textPrimary, marginBottom: 8, fontWeight: '600' },
  empty: { ...typography.body.small, color: colors.textSecondary },
  list: { maxHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.backgroundLight },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: colors.border, marginRight: 10 },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { ...typography.body.small, color: colors.textPrimary, flex: 1 },
});
