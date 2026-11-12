import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import ScreenShell from '../../ui/ScreenShell';
import { Card, EmptyState, Badge } from '../../ui/Kit';
import { apiService } from '../../services/api';
import { showAlert } from '../../utils/showAlert';
import { colors } from '../../theme/colors';

type Holiday = { _id: string; date: string; name: string; year: number };
type HolidaysResponse = { year: number | null; holidays: Holiday[]; perYear: number };

const longDay = (key: string) => {
  const d = new Date(`${key}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
const todayKey = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

/** Company holiday calendar (same as the web Holiday Calendar). HR / Admin add holidays on the web. */
export default function HolidayCalendarScreen() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<HolidaysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiService.get(`/holidays?year=${year}`));
    } catch (e: any) {
      showAlert('Error', e?.message || 'Could not load holidays');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);
  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const holidays = data?.holidays || [];
  const today = todayKey();
  return (
    <ScreenShell
      title="Holiday Calendar"
      subtitle="Company paid holidays. Working on a company holiday or a Sunday is marked Holiday Worked and earns a comp-off."
      loading={loading && !refreshing}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <View style={styles.yearRow}>
        <TouchableOpacity onPress={() => setYear((y) => y - 1)} style={styles.yearBtn} accessibilityLabel="Previous year">
          <Text style={styles.yearArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.year}>{year}</Text>
        <TouchableOpacity onPress={() => setYear((y) => y + 1)} style={styles.yearBtn} accessibilityLabel="Next year">
          <Text style={styles.yearArrow}>›</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.count}>
        Company Holidays ({holidays.length}
        {data?.perYear ? ` / ${data.perYear}` : ''})
      </Text>
      {holidays.length === 0 ? <EmptyState icon="🎉" title="No holidays added for this year" /> : null}
      {holidays.map((h) => {
        const past = h.date.slice(0, 10) < today;
        return (
          <Card key={h._id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, past && styles.past]}>{h.name}</Text>
                <Text style={styles.date}>{longDay(h.date.slice(0, 10))}</Text>
              </View>
              {h.date.slice(0, 10) === today ? <Badge label="Today" tone="success" /> : past ? null : <Badge label="Upcoming" tone="info" />}
            </View>
          </Card>
        );
      })}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 },
  yearBtn: { paddingHorizontal: 14, paddingVertical: 4 },
  yearArrow: { fontSize: 26, color: colors.primary, fontWeight: '700' },
  year: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  count: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  past: { color: colors.textTertiary },
  date: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
