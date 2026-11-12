import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiService } from '../services/api';
import { colors } from '../theme/colors';
import { WebButton } from '../ui/WebPrimitives';
import { Badge, type Tone } from '../ui/Kit';
import { dmy, time12, type Reminder, type Reminders } from '../lib/pjp';

const KIND_TONE: Record<string, Tone> = {
  'Follow-up': 'info',
  'Visit due': 'info',
  Training: 'warning',
  Service: 'warning',
  'PJP visit': 'success',
};

/** Shown once per app run and day. */
const shown = new Set<string>();

function Row({ r, showDate }: { r: Reminder; showDate?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.school}>{r.schoolName}</Text>
        <Badge label={r.kind} tone={KIND_TONE[r.kind] || 'neutral'} />
      </View>
      <Text style={styles.meta}>
        🕒 {showDate ? `${dmy(r.date)} · ` : ''}
        {r.time ? time12(r.time) : 'Any time'}
      </Text>
      {r.location ? <Text style={styles.meta}>📍 {r.location}</Text> : null}
      {r.detail ? <Text style={styles.detail}>{r.detail}</Text> : null}
    </View>
  );
}

/** Home pop-up: today's follow-ups (BDE), trainings / services (Trainer) and PJP visits. */
export default function TodayRemindersModal({ userId }: { userId?: string }) {
  const [data, setData] = useState<Reminders | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    apiService
      .get('/dashboard/today-reminders')
      .then((r: Reminders) => {
        if (cancelled || !r || (!r.todayItems?.length && !r.upcomingItems?.length)) return;
        const key = `${userId}:${r.today}`;
        if (shown.has(key)) return;
        shown.add(key);
        setData(r);
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data) return null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Today, {dmy(data.today)}</Text>
          <ScrollView style={{ maxHeight: 460 }}>
            {data.todayItems.length ? (
              data.todayItems.map((r) => <Row key={`${r.kind}-${r.id}-${r.time}`} r={r} />)
            ) : (
              <Text style={styles.detail}>Nothing scheduled for today.</Text>
            )}
            {data.upcomingItems.length ? (
              <>
                <Text style={styles.section}>Coming up</Text>
                {data.upcomingItems.map((r) => (
                  <Row key={`${r.kind}-${r.id}-${r.date}`} r={r} showDate />
                ))}
              </>
            ) : null}
          </ScrollView>
          <WebButton title="OK" onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.backgroundLight, borderRadius: 16, padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  section: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 8, marginBottom: 6 },
  row: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, marginBottom: 8, gap: 3 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  school: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  meta: { fontSize: 13, color: colors.textSecondary },
  detail: { fontSize: 12, color: colors.textTertiary },
});
