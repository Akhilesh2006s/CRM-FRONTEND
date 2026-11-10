import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../services/api';
import { getCurrentLocation } from '../services/location';
import { showAlert, showConfirm } from '../utils/showAlert';
import { colors } from '../theme/colors';

export type SchoolPoint = { latitude: number; longitude: number; source?: string; updatedAt?: string };

const codeKey = (code?: string | null) => String(code || '').trim().toUpperCase();

/** School points already fetched, by school code (null = asked, none saved). */
const cache = new Map<string, SchoolPoint | null>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
let pending: Set<string> = new Set();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Seed the cache from a list that already carries each school's point (My Schools). */
export function primeSchoolLocations(points: Record<string, SchoolPoint | null | undefined>) {
  Object.entries(points).forEach(([code, p]) => cache.set(codeKey(code), p || null));
  notify();
}

/** Batches lookups made in the same tick into one request. */
function request(code: string) {
  if (!code || cache.has(code) || pending.has(code)) return;
  pending.add(code);
  if (timer) return;
  timer = setTimeout(async () => {
    const codes = [...pending];
    pending = new Set();
    timer = null;
    try {
      const data = await apiService.get(`/dc-orders/school-locations?codes=${encodeURIComponent(codes.join(','))}`);
      codes.forEach((c) => cache.set(c, (data && data[c]) || null));
    } catch {
      codes.forEach((c) => cache.set(c, null));
    }
    notify();
  }, 30);
}

function useSchoolPoint(code: string): SchoolPoint | null | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    request(code);
    return () => {
      listeners.delete(fn);
    };
  }, [code]);
  return cache.has(code) ? cache.get(code) : undefined;
}

export function openInMaps(point: { latitude: number; longitude: number }, label?: string) {
  const { latitude: lat, longitude: lng } = point;
  const name = encodeURIComponent(label || 'School');
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${name}@${lat},${lng}`
      : Platform.OS === 'android'
        ? `geo:${lat},${lng}?q=${lat},${lng}(${name})`
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`));
}

/**
 * The school's captured location beside its details: tap to open Maps; "Update" sets it to where
 * the phone is now (the BDE stands at the school).
 */
export default function SchoolLocation({
  schoolCode,
  schoolName,
  canUpdate = true,
  compact,
}: {
  schoolCode?: string | null;
  schoolName?: string;
  canUpdate?: boolean;
  compact?: boolean;
}) {
  const code = codeKey(schoolCode);
  const point = useSchoolPoint(code);
  const [saving, setSaving] = useState(false);
  if (!code) return null;

  const update = () => {
    showConfirm(
      'Update school location',
      `Set ${schoolName || 'this school'}'s location to where you are now? Stand at the school before you continue.`,
      async () => {
        setSaving(true);
        try {
          const here = await getCurrentLocation();
          const saved = await apiService.put(`/dc-orders/school-location/${encodeURIComponent(code)}`, {
            latitude: here.latitude,
            longitude: here.longitude,
          });
          cache.set(code, { latitude: saved.latitude, longitude: saved.longitude, source: saved.source, updatedAt: saved.updatedAt });
          notify();
          showAlert('Location updated', 'The school location was saved.');
        } catch (e: any) {
          showAlert('Could not update location', e?.message || 'Please try again.');
        } finally {
          setSaving(false);
        }
      },
    );
  };

  return (
    <View style={[styles.row, compact && styles.compact]}>
      {point === undefined ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : point ? (
        <TouchableOpacity style={styles.link} onPress={() => openInMaps(point, schoolName)} hitSlop={8}>
          <Ionicons name="location" size={16} color={colors.primaryDark} />
          <Text style={styles.linkText}>View location on map</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.link}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.none}>Location not captured</Text>
        </View>
      )}
      {canUpdate && point !== undefined ? (
        <TouchableOpacity onPress={update} disabled={saving} hitSlop={8} style={styles.updateBtn}>
          <Text style={styles.updateText}>{saving ? 'Saving…' : point ? 'Update location' : 'Set location'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  compact: { marginTop: 4 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark, textDecorationLine: 'underline' },
  none: { fontSize: 13, color: colors.textTertiary },
  updateBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  updateText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
});
