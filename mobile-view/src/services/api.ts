import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Same production host as `navbar-landing/lib/api.ts` */
export const PROD_API_URL = 'https://crm-backend-production-c967.up.railway.app/api';

const LOCAL_API_URL = 'http://localhost:5001/api';

const getDevHostFromExpo = (): string | null => {
  try {
    const Constants = require('expo-constants').default;
    const manifest = Constants.expoConfig ?? Constants.manifest ?? Constants.manifest2;
    const hostUri = manifest?.hostUri ?? manifest?.extra?.expoGo?.debuggerHost;
    const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost ?? hostUri;
    if (debuggerHost && typeof debuggerHost === 'string') {
      const host = debuggerHost.split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
    }
    if (hostUri && typeof hostUri === 'string') {
      const host = hostUri.split(':')[0]?.replace(/^\/+/, '');
      if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
    }
  } catch (_) {}
  return null;
};

/** Local backend only when `EXPO_PUBLIC_USE_PRODUCTION=false` in `.env` */
export function useLocalBackend(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env?.EXPO_PUBLIC_USE_PRODUCTION === 'false'
  );
}

function isLocalhostWeb() {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * API base URL (includes `/api` suffix).
 * Default: production Railway (same as web). Override with `EXPO_PUBLIC_API_URL`.
 * Local dev: set `EXPO_PUBLIC_USE_PRODUCTION=false` in `mobile-view/.env`.
 * Expo web on localhost uses the local backend so Cursor/browser login is not blocked by CORS.
 */
export const getApiUrl = (): string => {
  if (isLocalhostWeb()) {
    return LOCAL_API_URL;
  }

  const envUrl =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    const url = String(envUrl).trim().replace(/\/$/, '');
    return url.includes('/api') ? url : `${url}/api`;
  }

  if (!useLocalBackend()) {
    return PROD_API_URL;
  }

  const isWeb =
    Platform.OS === 'web' ||
    (typeof window !== 'undefined' && typeof document !== 'undefined');
  if (isWeb) {
    return LOCAL_API_URL;
  }

  const envIp = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_IP;
  const ip = envIp || getDevHostFromExpo();
  if (ip) return `http://${ip}:5001/api`;

  return LOCAL_API_URL;
};

const API_BASE_URL = getApiUrl();

/** @deprecated Use getApiUrl() */
export const DEV_API_URL = API_BASE_URL;

class ApiService {
  private baseURL: string;
  private token: string = '';

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    if (!this.token) {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (storedToken) {
        headers.Authorization = `Bearer ${storedToken}`;
      }
    }

    return headers;
  }

  private connectionErrorHint(): string {
    const local = this.baseURL.includes('localhost') || this.baseURL.includes('127.0.0.1');
    if (local || useLocalBackend()) {
      return `Cannot reach the local API at ${this.baseURL}. Make sure the backend is running (npm start in backend).`;
    }
    return `Cannot connect to production API (${this.baseURL}). Check internet connection and try again.`;
  }

  async get(endpoint: string, { timeout = 15000 }: { timeout?: number } = {}) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers,
        timeout,
      });
      return response.data;
    } catch (error: any) {
      // The server was reached but did not answer in time: not a connection problem.
      if (error.code === 'ECONNABORTED' && error.message?.includes('timeout')) {
        throw new Error('The server is taking too long to respond. Pull down to try again.');
      }
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout')
      ) {
        throw new Error(this.connectionErrorHint());
      }
      throw error;
    }
  }

  async post(endpoint: string, data: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(`${this.baseURL}${endpoint}`, data, {
        headers,
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout')
      ) {
        throw new Error(this.connectionErrorHint());
      }
      throw error;
    }
  }

  async put(endpoint: string, data: any) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.put(`${this.baseURL}${endpoint}`, data, {
        headers,
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      if (error.response?.status) {
        throw new Error(
          error.response?.data?.error ||
            `Request failed with status code ${error.response.status}`
        );
      }
      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout')
      ) {
        throw new Error(this.connectionErrorHint());
      }
      throw error;
    }
  }

  async upload(endpoint: string, formData: FormData) {
    const headers = await this.getHeaders();
    delete (headers as Record<string, string>)['Content-Type'];
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers as Record<string, string>,
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const text = await response.text();
      if (!response.ok) {
        let message = `Upload failed (${response.status})`;
        try {
          const data = text ? JSON.parse(text) : {};
          if (data.message) message = data.message;
        } catch (_) {}
        throw new Error(message);
      }
      return text ? JSON.parse(text) : {};
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Upload timed out. Check your connection and try again.');
      }
      if (err.message?.includes('Upload failed')) throw err;
      if (
        err.message?.includes('Network request failed') ||
        err.message?.includes('Failed to fetch')
      ) {
        throw new Error(this.connectionErrorHint());
      }
      throw err;
    }
  }

  async delete(endpoint: string) {
    const headers = await this.getHeaders();
    const response = await axios.delete(`${this.baseURL}${endpoint}`, { headers });
    return response.data;
  }
}

export const apiService = new ApiService(API_BASE_URL);
export default ApiService;
