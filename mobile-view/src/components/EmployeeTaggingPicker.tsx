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
      .get('/employees?isActive=true')
      .then((data: any) => {
        const list = Array.isArray(data) ? data : [];
        const withoutSelf = list.filter((e: any) => e._id !== excludeId);
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
  title: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, fontWeight: '600' },
  empty: { fontSize: 13, color: colors.textTertiary },
  list: { maxHeight: 180, borderWidth: 1, borderColor: '#DCE3EC', borderRadius: 10, backgroundColor: colors.backgroundLight },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#CBD5E1', marginRight: 12 },
  checkboxOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  label: { fontSize: 14, color: colors.textPrimary, flex: 1 },
});
