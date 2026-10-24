import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { apiService } from './api';

/**
 * Bike / Car work trips tracked by GPS between Start Trip and End Trip.
 * Points are recorded while the app is open, kept on the phone until uploaded, and
 * sent in batches. While the app is closed nothing is recorded; the gap counts as the
 * straight line between the last and next fix (the server works out the distance).
 */

export type TripVehicle = 'Bike' | 'Car';
export type TripSummary = {
  _id: string;
  vehicle: TripVehicle;
  purpose?: string;
  status: 'active' | 'ended';
  startedAt: string;
  endedAt?: string;
  fromPlace?: string;
  toPlace?: string;
  distanceKm: number;
  ratePerKm?: number;
  amount: number;
  expenseId?: string;
  pointCount?: number;
};
type Point = { latitude: number; longitude: number; accuracy?: number; recordedAt: string };

const PENDING_KEY = 'trip.pendingPoints';
const FLUSH_EVERY_POINTS = 10;
const FLUSH_EVERY_MS = 60 * 1000;

let activeTrip: TripSummary | null = null;
let watcher: Location.LocationSubscription | null = null;
let pending: Point[] = [];
let lastFlush = 0;
let flushing = false;
let localKm = 0;
let lastPoint: Point | null = null;
const listeners = new Set<(trip: TripSummary | null, liveKm: number) => void>();

const toRad = (d: number) => (d * Math.PI) / 180;
function kmBetween(a: Point, b: Point) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance shown while driving: the server's figure plus what is not uploaded yet. */
export function liveKm() {
  return Math.round(((activeTrip?.distanceKm || 0) + localKm) * 100) / 100;
}

function emit() {
  listeners.forEach((fn) => fn(activeTrip, liveKm()));
}

export function subscribeTrip(fn: (trip: TripSummary | null, liveKm: number) => void) {
  listeners.add(fn);
  fn(activeTrip, liveKm());
  return () => {
    listeners.delete(fn);
  };
}

async function savePending() {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ tripId: activeTrip?._id, points: pending }));
  } catch {
    // Storage is best effort; points stay in memory.
  }
}

async function loadPending(tripId: string) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    pending = saved?.tripId === tripId && Array.isArray(saved.points) ? saved.points : [];
  } catch {
    pending = [];
  }
}

async function flush(force = false) {
  if (!activeTrip || flushing || pending.length === 0) return;
  if (!force && pending.length < FLUSH_EVERY_POINTS && Date.now() - lastFlush < FLUSH_EVERY_MS) return;
  flushing = true;
  const batch = pending.slice(0, 500);
  try {
    const updated: TripSummary = await apiService.post(`/trips/${activeTrip._id}/points`, { points: batch });
    pending = pending.slice(batch.length);
    activeTrip = updated;
    localKm = 0;
    lastFlush = Date.now();
    await savePending();
    emit();
  } catch {
    // Offline: keep the points and try again on the next fix.
  } finally {
    flushing = false;
  }
}

function onFix(loc: Location.LocationObject) {
  const point: Point = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? undefined,
    recordedAt: new Date(loc.timestamp || Date.now()).toISOString(),
  };
  if ((point.accuracy ?? 0) > 100) return;
  if (lastPoint) {
    const step = kmBetween(lastPoint, point);
    if (step < 0.02) return;
    localKm += step;
  }
  lastPoint = point;
  pending.push(point);
  void savePending();
  emit();
  void flush();
}

async function startWatching() {
  if (watcher || !activeTrip) return;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission is needed to track the trip.');
  watcher = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 30, timeInterval: 10000 },
    onFix
  );
}

function stopWatching() {
  watcher?.remove();
  watcher = null;
}

async function currentPoint(): Promise<Point | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? undefined,
      recordedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Pick up a trip that was running when the app was last closed. */
export async function resumeActiveTrip(): Promise<TripSummary | null> {
  try {
    const res = await apiService.get('/trips/active');
    activeTrip = res?.trip || null;
    localKm = 0;
    lastPoint = null;
    if (activeTrip) {
      await loadPending(activeTrip._id);
      await startWatching().catch(() => {});
      void flush(true);
    } else {
      stopWatching();
    }
  } catch {
    // Keep whatever is known locally.
  }
  emit();
  return activeTrip;
}

export async function startTrip(vehicle: TripVehicle, purpose: string, fromPlace: string): Promise<TripSummary> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission is needed to track the trip.');
  const first = await currentPoint();
  const trip: TripSummary = await apiService.post('/trips/start', {
    vehicle,
    purpose,
    fromPlace,
    points: first ? [first] : [],
  });
  activeTrip = trip;
  pending = [];
  localKm = 0;
  lastPoint = first;
  await savePending();
  await startWatching();
  emit();
  return trip;
}

export async function endTrip(toPlace: string): Promise<TripSummary> {
  if (!activeTrip) throw new Error('No trip is running.');
  const last = await currentPoint();
  if (last) pending.push(last);
  stopWatching();
  const ended: TripSummary = await apiService.post(`/trips/${activeTrip._id}/end`, { points: pending.slice(0, 500), toPlace });
  activeTrip = null;
  pending = [];
  localKm = 0;
  lastPoint = null;
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  emit();
  return ended;
}

export async function cancelTrip() {
  if (!activeTrip) return;
  await apiService.post(`/trips/${activeTrip._id}/cancel`, {});
  stopWatching();
  activeTrip = null;
  pending = [];
  localKm = 0;
  lastPoint = null;
  await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  emit();
}

/** Raise the travel expense for an ended trip; km and amount come from the trip. */
export async function claimTrip(trip: TripSummary, remarks: string) {
  return apiService.post('/expenses/create', {
    tripId: trip._id,
    category: 'travel',
    transportType: trip.vehicle,
    approxKms: trip.distanceKm,
    amount: trip.amount,
    date: trip.startedAt,
    travelFrom: trip.fromPlace,
    travelTo: trip.toPlace,
    employeeRemarks: remarks,
    title: `${trip.vehicle} trip ${trip.distanceKm} km`,
  });
}

// Coming back to the app restarts tracking for a running trip.
AppState.addEventListener('change', (next) => {
  if (next === 'active' && activeTrip) {
    void startWatching().catch(() => {});
    void flush(true);
  }
});
