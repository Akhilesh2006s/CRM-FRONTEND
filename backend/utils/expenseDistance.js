/**
 * Route distance helper for travel expense GPS verification.
 * Uses Google Distance Matrix when MAPS_DISTANCE_API_KEY is set.
 */
async function calculateRouteDistanceKm(fromLocation, toLocation) {
  const from = String(fromLocation || '').trim();
  const to = String(toLocation || '').trim();
  if (!from || !to) {
    return { gpsDistance: null, gpsProvider: null, error: 'From and To locations are required.' };
  }

  const apiKey = process.env.MAPS_DISTANCE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      gpsDistance: null,
      gpsProvider: 'none',
      error: 'GPS distance API is not configured. Set MAPS_DISTANCE_API_KEY on the server.',
    };
  }

  try {
    const params = new URLSearchParams({
      origins: from,
      destinations: to,
      units: 'metric',
      key: apiKey,
    });
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') {
      return {
        gpsDistance: null,
        gpsProvider: 'google',
        error: data.error_message || data.status || 'Distance API failed',
      };
    }
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      return {
        gpsDistance: null,
        gpsProvider: 'google',
        error: element?.status || 'Could not calculate distance for these locations',
      };
    }
    const meters = element.distance?.value || 0;
    const km = Math.round((meters / 1000) * 10) / 10;
    return {
      gpsDistance: km,
      gpsProvider: 'google',
      gpsCalculatedAt: new Date(),
      error: null,
    };
  } catch (e) {
    return {
      gpsDistance: null,
      gpsProvider: 'google',
      error: e.message || 'Distance calculation failed',
    };
  }
}

module.exports = { calculateRouteDistanceKm };
