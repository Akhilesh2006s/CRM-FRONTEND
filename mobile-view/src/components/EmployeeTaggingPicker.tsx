import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { apiService } from '../services/api';

import {
  TAGGING_ROLES,
  filterTagOptions,
  getTaggingSectionLabel,
  supportsEmployeeTagging,
} from '../lib/employeeTagging';

export { TAGGING_ROLES, supportsEmployeeTagging };

type Props = {
  role: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeId?: string;
};

export default function EmployeeTaggingPicker({ role, selectedIds, onChange, excludeId }: Props) {
  const [options, setOptions] = useState<{ _id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    if (!supportsEmployeeTagging(role)) return;
    apiService
      .get<any[]>('/employees?isActive=true')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        const withoutSelf = list.filter((e) => e._id !== excludeId);
        setOptions(filterTagOptions(withoutSelf, role));
      })
      .catch(() => setOptions([]));
  }, [role, excludeId]);

  useEffect(() => {
    const allowed = new Set(options.map((o) => o._id));
    const pruned = selectedIds.filter((id) => allowed.has(id));
    if (pruned.length !== selectedIds.length) {
      onChange(pruned);
    }
  }, [options, role]);

  if (!supportsEmployeeTagging(role)) return null;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getTaggingSectionLabel(role)}</Text>
      {options.length === 0 ? (
        <Text style={styles.empty}>
          {role === 'Executive Manager' || role === 'Manager'
            ? 'No active executives available to tag'
            : 'No employees available to tag'}
        </Text>
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
