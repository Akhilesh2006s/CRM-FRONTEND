import { Alert, AppState, Linking, Platform, type AppStateStatus } from 'react-native';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiService } from './api';
import { getCurrentLocation, LocationPermissionError } from './location';

const PING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes (within 2–5 min range)

export type PingSource = 'foreground' | 'background' | 'manual';

/** Battery % and charging state for the Admin map; empty when the phone does not tell. */
async function batteryInfo(): Promise<{ batteryLevel?: number; charging?: boolean }> {
  try {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    return {
      batteryLevel: level >= 0 ? Math.round(level * 100) : undefined,
      charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  } catch {
    return {};
  }
}

/** Battery and GPS on/off to /tracking/status (Admin sees it on the employee's pin). */
export async function sendDeviceStatus(): Promise<void> {
  try {
    const gpsEnabled = await Location.hasServicesEnabledAsync().catch(() => undefined);
    await apiService.post('/tracking/status', { ...(await batteryInfo()), gpsEnabled });
  } catch {
    // Next tick tries again.
  }
}

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
      ...(await batteryInfo()),
    });
    return true;
  } catch (err) {
    // GPS off or permission denied: still report battery and GPS status to Admin.
    void sendDeviceStatus();
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
  if (error) {
    // Usually GPS turned off: let Admin see GPS Off.
    await sendDeviceStatus();
    return;
  }
  const locations = ((data as { locations?: Location.LocationObject[] })?.locations || []);
  if (!locations.length) return;
  try {
    const battery = await batteryInfo();
    await apiService.post('/tracking/ping', {
      pings: locations.map((l, i) => ({
        ...(i === locations.length - 1 ? battery : {}),
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

export type LiveGpsState = 'on' | 'gps_off' | 'needs_always' | 'starting';

/** Live GPS for the running day: on, phone GPS off, or "Allow all the time" not given. */
export async function liveGpsState(): Promise<LiveGpsState> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return 'gps_off';
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return 'needs_always';
    return (await Location.hasStartedLocationUpdatesAsync(DAY_GPS_TASK)) ? 'on' : 'starting';
  } catch {
    return 'needs_always';
  }
}

/** Android shows "Allow all the time" only on the app's settings page; explain it first. */
function explainAlwaysAllow(): Promise<void> {
  return new Promise((resolve) =>
    Alert.alert(
      'Allow location all the time',
      'Your location is tracked from Start Day to End Day, also when the app is closed. On the next screen choose "Allow all the time".',
      [{ text: 'Continue', onPress: () => resolve() }],
      { cancelable: false }
    )
  );
}

/** Turn live GPS on: phone GPS, then "Allow all the time", then start the day's tracking. */
export async function enableLiveGps(): Promise<LiveGpsState> {
  try {
    if (!(await Location.hasServicesEnabledAsync()) && Platform.OS === 'android') {
      await Location.enableNetworkProviderAsync().catch(() => undefined);
    }
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && !bg.canAskAgain) {
      await explainAlwaysAllow();
      await Linking.openSettings();
      return 'needs_always';
    }
  } catch {
    // fall through to startDayTracking
  }
  await startDayTracking({ explain: true });
  void sendDeviceStatus();
  return liveGpsState();
}

/**
 * Start Day: keep GPS on until End Day. Asks for "Allow all the time" location; when the
 * employee refuses it, GPS still runs while the app is open.
 * @returns whether background GPS is on
 */
export async function startDayTracking({ explain = true }: { explain?: boolean } = {}): Promise<boolean> {
  startForegroundTracking();
  void sendDeviceStatus();
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
      const asked = await Location.requestForegroundPermissionsAsync();
      if (asked.status !== 'granted') return false;
    }
    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== 'granted' && bg.canAskAgain) {
      if (explain && Platform.OS === 'android') await explainAlwaysAllow();
      bg = await Location.requestBackgroundPermissionsAsync();
    }
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
  // On app open: start quietly; the home card asks for "Allow all the time" when it is missing.
  if (attendance && !attendance.endTime) await startDayTracking({ explain: false });
  else await stopDayTracking();
}
