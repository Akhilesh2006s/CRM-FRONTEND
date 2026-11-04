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

/** Tile colours, one per module in turn. */
const MODULE_COLORS = ['#26A69A', '#F28C28', '#2F5BEA', '#E53935', '#8E44AD', '#0D9488', '#D97706', '#2563EB'];

/**
 * Menu: one main row per module (Clients, Sales, Expenses, ...). Tapping a module opens its
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.search}
            placeholder="Search modules…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                <View style={[styles.moduleIcon, { backgroundColor: color + '1A' }]}>
                  <Ionicons name={iconForSection(section.title)} size={20} color={color} />
                </View>
                <View style={styles.moduleText}>
                  <Text style={styles.moduleTitle} numberOfLines={1}>
                    {section.title}
                  </Text>
                  <Text style={styles.moduleSub}>
                    {section.items.length} {section.items.length === 1 ? 'option' : 'options'}
                  </Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
              </TouchableOpacity>
              {expanded ? (
                <View style={styles.options}>
                  {section.items.map((item, i) => {
                    const meta = iconForScreen(item.screen);
                    return (
                      <TouchableOpacity
                        key={item.screen + item.label}
                        style={[styles.option, i === section.items.length - 1 && styles.optionLast]}
                        onPress={() => navigateRoot(item.screen, item.params)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={meta.name} size={18} color={color} />
                        <Text style={styles.optionLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  module: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  moduleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
  moduleIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  moduleText: { flex: 1 },
  moduleTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  moduleSub: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  options: { borderTopWidth: 1, borderTopColor: '#EEF2F7', backgroundColor: '#FBFCFE' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 12,
    paddingLeft: 24,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionLast: { borderBottomWidth: 0 },
  optionLabel: { flex: 1, fontSize: 15, color: colors.textPrimary },
  empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 24, fontSize: 15 },
});
