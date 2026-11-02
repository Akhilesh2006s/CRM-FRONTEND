import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiService } from './api';
import { getCurrentLocation, LocationPermissionError } from './location';

const PING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes (within 2–5 min range)

export type PingSource = 'foreground' | 'background' | 'manual';

let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let running = false;

/**
 * Capture GPS and POST a single ping to /tracking/ping.
 * Automatic pings only use existing foreground permission. Manual pings may ask.
 * Swallows permission/network errors so callers never crash.
 */
export async function sendLocationPing(source: PingSource): Promise<boolean> {
  // Foreground permission does not authorize location access after backgrounding.
  if (source === 'background' || AppState.currentState !== 'active') return false;
  try {
    const loc = await getCurrentLocation({ requestPermission: source === 'manual' });
    if (AppState.currentState !== 'active') return false;
    await apiService.post('/tracking/ping', {
      latitude: loc.latitude,
      longitude: loc.longitude,
      recordedAt: new Date().toISOString(),
      source,
    });
    return true;
  } catch (err) {
    // Denial is a normal permission state; retry silently when permission changes.
    if (err instanceof LocationPermissionError) return false;
    console.warn('[tracking] ping failed:', (err as Error)?.message || err);
    return false;
  }
}

async function tick(source: PingSource) {
  if (!running) return;
  if (AppState.currentState !== 'active' && source === 'foreground') return;
  await sendLocationPing(source);
}

function clearIntervalOnly() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Start periodic GPS pings while the app is in the foreground.
 * Safe to call multiple times; no-ops if already running.
 * Does not throw if location is denied.
 */
export function startForegroundTracking(): void {
  if (running) return;
  running = true;

  const onAppState = (next: AppStateStatus) => {
    if (next === 'active') {
      void tick('foreground');
      if (!intervalId) {
        intervalId = setInterval(() => void tick('foreground'), PING_INTERVAL_MS);
      }
    } else {
      // App backgrounded — stop the interval; true background tasks need expo-task-manager.
      clearIntervalOnly();
    }
  };

  appStateSub = AppState.addEventListener('change', onAppState);

  if (AppState.currentState === 'active') {
    void tick('foreground');
    intervalId = setInterval(() => void tick('foreground'), PING_INTERVAL_MS);
  }
}

export function stopForegroundTracking(): void {
  running = false;
  clearIntervalOnly();
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

export function isForegroundTrackingRunning(): boolean {
  return running;
}

/* ------------------------------------------------------------------------------------------
 * All-day GPS: runs from Start Day to End Day, also while the app is closed or the screen is
 * off (Android foreground service). Points are sent in batches to /tracking/ping.
 * ---------------------------------------------------------------------------------------- */
export const DAY_GPS_TASK = 'crm-day-gps';

TaskManager.defineTask(DAY_GPS_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = ((data as { locations?: Location.LocationObject[] })?.locations || []);
  if (!locations.length) return;
  try {
    await apiService.post('/tracking/ping', {
      pings: locations.map((l) => ({
        latitude: l.coords.latitude,
        longitude: l.coords.longitude,
        accuracy: l.coords.accuracy ?? undefined,
        speed: l.coords.speed ?? undefined,
        recordedAt: new Date(l.timestamp).toISOString(),
        source: 'background',
      })),
    });
  } catch {
    // No network: the next batch carries on; the day's distance uses what reached the server.
  }
});

/**
 * Start Day: keep GPS on until End Day. Asks for "Allow all the time" location; when the
 * employee refuses it, GPS still runs while the app is open.
 * @returns whether background GPS is on
 */
export async function startDayTracking(): Promise<boolean> {
  startForegroundTracking();
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const asked = await Location.requestForegroundPermissionsAsync();
      if (asked.status !== 'granted') return false;
    }
    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return false;
    if (await Location.hasStartedLocationUpdatesAsync(DAY_GPS_TASK)) return true;
    await Location.startLocationUpdatesAsync(DAY_GPS_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 2 * 60 * 1000,
      distanceInterval: 50,
      deferredUpdatesInterval: 5 * 60 * 1000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Viswam CRM: your day has started',
        notificationBody: 'Location is tracked until you tap End Day.',
        notificationColor: '#2563EB',
      },
    });
    return true;
  } catch (err) {
    console.warn('[tracking] background GPS failed:', (err as Error)?.message || err);
    return false;
  }
}

/** End Day (or logout): stop all GPS. */
export async function stopDayTracking(): Promise<void> {
  stopForegroundTracking();
  try {
    if (await Location.hasStartedLocationUpdatesAsync(DAY_GPS_TASK)) {
      await Location.stopLocationUpdatesAsync(DAY_GPS_TASK);
    }
  } catch {
    // Already stopped.
  }
}

/** Match GPS to the attendance: on while today's day is started and not ended. */
export async function syncDayTracking(attendance: { endTime?: string | null } | null | undefined): Promise<void> {
  if (attendance && !attendance.endTime) await startDayTracking();
  else await stopDayTracking();
}
