/**
 * Daily Travel Report for one employee and day: the GPS route on a map (roads, like Google Maps),
 * each leg as "Start Day → School · 15 min · 4.2 km", total km (same as Expenses), battery and GPS.
 * Web: components/tracking/DayRouteView.tsx.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { apiService } from '../services/api';
import { colors } from '../theme/colors';
import { routeMapHtml, legDirectionsUrl, type DayRoute } from '../lib/routeMapHtml';

const time = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—';
const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

export default function DayRouteCard({
  employeeId,
  date,
  refreshKey,
  title = "Today's route",
}: {
  employeeId: string;
  /** YYYY-MM-DD; today when omitted. */
  date?: string;
  /** Change it to reload (e.g. after a pull-to-refresh). */
  refreshKey?: unknown;
  title?: string;
}) {
  const [route, setRoute] = useState<DayRoute | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError('');
    try {
      setRoute(await apiService.get(`/tracking/${employeeId}/day-route${date ? `?date=${date}` : ''}`));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Could not load the route');
    } finally {
      setLoading(false);
    }
  }, [employeeId, date]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const html = useMemo(() => (route ? routeMapHtml(route, focus) : ''), [route, focus]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {route ? <Text style={styles.km}>{route.km} km</Text> : null}
      </View>
      {route ? (
        <Text style={styles.meta}>
          {`Start ${time(route.signInAt)} · ${route.signOutAt ? `End ${time(route.signOutAt)}` : 'Running'}`}
          {route.batteryLevel != null ? ` · Battery ${route.batteryLevel}%` : ''}
          {route.gpsStatus ? ` · GPS ${route.gpsStatus === 'on' ? 'On' : 'Off'}` : ''}
        </Text>
      ) : null}
      {loading && !route ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {route ? (
        <>
          <View style={styles.map}>
            <WebView originWhitelist={['*']} source={{ html }} style={{ flex: 1 }} nestedScrollEnabled />
          </View>
          {route.legs.length === 0 ? <Text style={styles.muted}>No travel recorded yet.</Text> : null}
          {route.legs.map((leg, i) => (
            <View key={i} style={[styles.leg, focus === i && styles.legOn]}>
              <Text style={styles.legTitle}>
                {leg.from} → {leg.to}
              </Text>
              <Text style={styles.legMeta}>
                {time(leg.startAt)} – {time(leg.endAt)} · {duration(leg.minutes)} · {leg.km} km
              </Text>
              <View style={styles.legBtns}>
                <TouchableOpacity onPress={() => setFocus(focus === i ? undefined : i)}>
                  <Text style={styles.link}>{focus === i ? 'Show whole day' : 'Show on map'}</Text>
                </TouchableOpacity>
                {legDirectionsUrl(leg) ? (
                  <TouchableOpacity onPress={() => void Linking.openURL(legDirectionsUrl(leg))}>
                    <Text style={styles.link}>Open in Google Maps</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
          <Text style={styles.note}>The same km is used in Expenses and Field Day.</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  km: { fontSize: 16, fontWeight: '700', color: colors.primary },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4, marginBottom: 10 },
  map: { height: 280, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, marginBottom: 10 },
  leg: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  legOn: { backgroundColor: '#EFF6FF' },
  legTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  legMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  legBtns: { flexDirection: 'row', gap: 18, marginTop: 6 },
  link: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textSecondary },
  note: { fontSize: 11, color: colors.textTertiary, marginTop: 8 },
  error: { fontSize: 13, color: colors.error },
});
