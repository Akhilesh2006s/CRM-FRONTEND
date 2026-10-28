import { AppState, type AppStateStatus } from 'react-native';
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
