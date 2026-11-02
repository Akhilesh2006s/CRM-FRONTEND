import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getNavSections } from '../../config/navConfig';
import { navigateRoot } from '../../navigation/navigationRef';
import { iconForScreen, iconForSection } from '../../config/moduleIcons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

/** Tile colours, one per module in turn. */
const MODULE_COLORS = ['#26A69A', '#F28C28', '#2F5BEA', '#E53935', '#8E44AD', '#0D9488', '#D97706', '#2563EB'];

/**
 * Menu: one main tile per module (Clients, Sales, Expenses, ...). Tapping a module opens its
 * options underneath; searching opens every module that has a match.
 */
export default function WorkHubScreen() {
  const { user } = useAuth();
  const sections = getNavSections(user);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.title.toLowerCase().includes(q) ? s.items : s.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, q]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Menu</Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder="Search…"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {filtered.map((section, index) => {
        const color = MODULE_COLORS[index % MODULE_COLORS.length];
        const expanded = Boolean(q) || open === section.title;
        return (
          <View key={section.title} style={styles.module}>
            <TouchableOpacity
              style={styles.moduleRow}
              onPress={() => setOpen(open === section.title ? null : section.title)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
            >
              <View style={[styles.moduleIcon, { backgroundColor: color }]}>
                <Ionicons name={iconForSection(section.title)} size={30} color="#FFFFFF" />
              </View>
              <Text style={styles.moduleTitle}>{section.title}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textTertiary} style={styles.chevron} />
            </TouchableOpacity>
            {expanded ? (
              <View style={styles.options}>
                {section.items.map((item) => {
                  const meta = iconForScreen(item.screen);
                  return (
                    <TouchableOpacity
                      key={item.screen + item.label}
                      style={styles.option}
                      onPress={() => navigateRoot(item.screen, item.params)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={meta.name} size={18} color={color} />
                      <Text style={styles.optionLabel}>{item.label}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}

      {filtered.length === 0 ? <Text style={styles.empty}>Nothing matches “{query}”</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  title: { ...typography.heading.h1, color: colors.textPrimary, marginBottom: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 4 },
  search: { flex: 1, paddingVertical: 12, fontSize: 16, color: colors.textPrimary },
  module: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  moduleRow: { flexDirection: 'row', alignItems: 'center', minHeight: 76 },
  moduleIcon: { width: 76, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  moduleTitle: { flex: 1, fontSize: 18, color: colors.textPrimary, textAlign: 'center' },
  chevron: { marginRight: 14 },
  options: { borderTopWidth: 1, borderTopColor: colors.border },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionLabel: { flex: 1, fontSize: 15, color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 24, fontSize: 15 },
});
