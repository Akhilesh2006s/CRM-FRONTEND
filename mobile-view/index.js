import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { registerRootComponent } from 'expo';
import App from './App';
// Registers the all-day GPS task before the app starts (it also runs with the app closed).
import './src/services/tracking';

try {
  const errorUtils = global.ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      console.error('Uncaught error', { isFatal, message: error?.message, error });
      if (typeof previous === 'function') {
        previous(error, false);
      }
    });
  }
} catch (_) {}

registerRootComponent(App);

