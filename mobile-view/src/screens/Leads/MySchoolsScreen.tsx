import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import ScreenShell from '../../ui/ScreenShell';
import { WebInput } from '../../ui/WebPrimitives';
import { Card, CardTitle, InfoRow, EmptyState, type Tone } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import SchoolOverview from '../../components/SchoolOverview';
import SchoolLocation, { primeSchoolLocations, type SchoolPoint } from '../../components/SchoolLocation';
import { ymdToDmy } from '../../utils/dateFormat';

/** Same tags as the server (backend utils/schoolStatus.js). */
const TAGS = ['Lead', 'PO Dropped', 'DC Dropped', 'Client for Renewal', 'Renewed'] as const;
type Tag = (typeof TAGS)[number];

const TAG_TONE: Record<Tag, Tone> = {
  Lead: 'info',
  'PO Dropped': 'warning',
  'DC Dropped': 'success',
  'Client for Renewal': 'error',
  Renewed: 'success',
};

type School = {
  _id: string;
  school_name?: string;
  school_code?: string;
  contact_person?: string;
  contact_mobile?: string;
  zone?: string;
  area?: string;
  city?: string;
  location?: string;
  follow_up_date?: string;
  year?: string;
  statusTag: Tag;
  schoolLocation?: SchoolPoint | null;
};

const day = (v?: string) => (v ? ymdToDmy(String(v).slice(0, 10)) : '');

/**
 * My Schools: every school assigned to the BDE in one list — leads and clients — each tagged
 * Lead, PO Dropped, DC Dropped, Client for Renewal or Renewed (from its deals, DCs and academic year).
 */
export default function MySchoolsScreen() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'All' | Tag>('All');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiService.get('/dc-orders/my-schools', { timeout: 45000 });
      const rows: School[] = Array.isArray(data) ? data : [];
      const points: Record<string, SchoolPoint | null> = {};
      rows.forEach((r) => {
        if (r.school_code) points[r.school_code] = r.schoolLocation || null;
      });
      primeSchoolLocations(points);
      setSchools(rows);
    } catch (e: any) {
      showAlert('Error', e?.message || 'Failed to load schools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = schools.filter((s) => {
    if (filter !== 'All' && s.statusTag !== filter) return false;
    if (!words.length) return true;
    const hay = [s.school_name, s.school_code, s.contact_person, s.contact_mobile, s.zone, s.area, s.city, s.location, s.statusTag]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const count = (t: 'All' | Tag) => (t === 'All' ? schools.length : schools.filter((s) => s.statusTag === t).length);

  return (
    <ScreenShell
      title="My Schools"
      subtitle="All your schools: leads and clients. Tap a school for its details."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <WebInput placeholder="Search school, code, contact, area…" value={search} onChangeText={setSearch} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginBottom: 12 }}>
        {(['All', ...TAGS] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, filter === t && styles.chipOn]} onPress={() => setFilter(t)}>
            <Text style={[styles.chipText, filter === t && styles.chipTextOn]}>
              {t} ({count(t)})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {visible.length === 0 ? (
        <EmptyState icon="🏫" title="No schools found" />
      ) : (
        visible.map((s) => {
          const open = openId === s._id;
          return (
            <Card key={s._id} onPress={() => setOpenId(open ? null : s._id)}>
              <CardTitle
                title={s.school_name || 'Unnamed School'}
                subtitle={[s.school_code, s.year].filter(Boolean).join(' · ') || undefined}
                badge={s.statusTag}
                tone={TAG_TONE[s.statusTag] || 'neutral'}
              />
              <InfoRow label="Contact" value={s.contact_person || undefined} />
              <InfoRow label="Mobile" value={s.contact_mobile || undefined} phone />
              <InfoRow label="Area" value={[s.area, s.city].filter(Boolean).join(', ') || undefined} />
              {s.statusTag === 'Lead' ? <InfoRow label="Follow-up" value={day(s.follow_up_date) || undefined} /> : null}
              <SchoolLocation schoolCode={s.school_code} schoolName={s.school_name} />
              <View style={styles.footer}>
                <Text style={styles.footerToggle}>{open ? 'Hide details ⌃' : 'Details ⌄'}</Text>
              </View>
              {open ? <SchoolOverview leadId={s._id} /> : null}
            </Card>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.backgroundLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.textLight },
  footer: { alignItems: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F7' },
  footerToggle: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
});
