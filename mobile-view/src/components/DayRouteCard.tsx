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
import { routeMapHtml, legDirectionsUrl, legKmText, dayKmText, type DayRoute } from '../lib/routeMapHtml';

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

  // Google Maps road view when the server has a Google key; else our map of the GPS points.
  const googleUrl = route ? (focus != null ? route.legs[focus]?.embedUrl : route.embedUrl) || null : null;
  const html = useMemo(() => {
    if (!route) return '';
    if (googleUrl) {
      return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${googleUrl.replace(/"/g, '&quot;')}" allowfullscreen></iframe></body></html>`;
    }
    return routeMapHtml(route, focus);
  }, [route, focus, googleUrl]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {route ? <Text style={styles.km}>{dayKmText(route)}</Text> : null}
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
          {/* Route line: Start Day → each school → End Day, with the time and km between stops. */}
          {route.stops.length === 0 ? <Text style={styles.muted}>No travel recorded yet.</Text> : null}
          {route.stops.map((stop, i) => {
            const leg = route.legs[i];
            const last = i === route.stops.length - 1;
            const color = stop.kind === 'start' ? '#16A34A' : stop.kind === 'end' || stop.kind === 'last' ? '#DC2626' : '#7C3AED';
            const label = stop.kind === 'start' ? 'S' : stop.kind === 'end' || stop.kind === 'last' ? 'E' : String(i);
            return (
              <View key={i} style={styles.stopRow}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: color }]}>
                    <Text style={styles.dotText}>{label}</Text>
                  </View>
                  {!last ? <View style={styles.railLine} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: last ? 0 : 6 }}>
                  <Text style={styles.legTitle}>
                    {stop.name}
                    <Text style={styles.legMeta}>{`  ${time(stop.at)}${stop.endAt && stop.endAt !== stop.at ? ` – ${time(stop.endAt)}` : ''}`}</Text>
                  </Text>
                  {leg && !last ? (
                    <View style={[styles.legBox, focus === i && styles.legOn]}>
                      <Text style={styles.legMeta}>{`↓ ${duration(leg.minutes)} · ${legKmText(leg)}`}</Text>
                      <View style={styles.legBtns}>
                        <TouchableOpacity onPress={() => setFocus(focus === i ? undefined : i)}>
                          <Text style={styles.link}>{focus === i ? 'Show whole day' : 'Show on map'}</Text>
                        </TouchableOpacity>
                        {legDirectionsUrl(leg) ? (
                          <TouchableOpacity onPress={() => void Linking.openURL(legDirectionsUrl(leg))}>
                            <Text style={styles.link}>Google Maps</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          <Text style={styles.note}>
            {route.roadKm
              ? 'Km is the shortest road distance in Google Maps from the start point to each school. The same km is used in Expenses and Field Day.'
              : 'The same km is used in Expenses and Field Day.'}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight, padding: 14, marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  km: { fontSize: 14, fontWeight: '700', color: colors.primary, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  meta: { fontSize: 12, color: colors.textSecondary, marginTop: 4, marginBottom: 10 },
  map: { height: 280, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderLight, marginBottom: 10 },
  stopRow: { flexDirection: 'row', gap: 10 },
  rail: { width: 24, alignItems: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  railLine: { flex: 1, width: 3, backgroundColor: '#3B82F6', marginVertical: 2 },
  legBox: { paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8 },
  legOn: { backgroundColor: '#EFF6FF' },
  legTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  legMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  legBtns: { flexDirection: 'row', gap: 18, marginTop: 6 },
  link: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.textSecondary },
  note: { fontSize: 11, color: colors.textTertiary, marginTop: 8 },
  error: { fontSize: 13, color: colors.error },
});
