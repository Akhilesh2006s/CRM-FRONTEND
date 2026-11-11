/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: 'Viswam Edutech',
  slug: 'crm-mobile-app',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.crm.forge.mobile',
    buildNumber: '1',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    package: 'com.crm.forge.mobile',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'RECORD_AUDIO',
    ],
    // Location is "While using the app" only; never ask for "Allow all the time".
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
  },
  extra: {
    eas: {
      projectId: '6fbb940c-2bbd-4d25-ae08-68d19179063c',
    },
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL ||
      'https://crm-backend-production-c967.up.railway.app/api',
  },
  plugins: [
    [
      'expo-location',
      {
        // "While using the app" only (no "Allow all the time": it uses more battery). The day's GPS runs
        // as a foreground service with a notification, which needs only this permission.
        locationWhenInUsePermission: 'Allow CRM Forge to use your location for attendance and your day route.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'CRM Forge accesses photos for attendance and DC uploads.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'CRM Forge uses the camera to capture attendance and DC photos.',
      },
    ],
    '@react-native-community/datetimepicker',
    'expo-secure-store',
  ],
});
