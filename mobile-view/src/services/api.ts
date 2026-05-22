import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Get dev machine IP from Expo - when running on physical device, Expo knows the dev server's IP
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

// API URL - set EXPO_PUBLIC_API_URL in .env to override
// For web: always localhost. For device: Expo IP or EXPO_PUBLIC_API_IP
const getApiUrl = (): string => {
  const envUrl = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    const url = String(envUrl).trim().replace(/\/$/, '');
    return url.includes('/api') ? url : `${url}/api`;
  }
  // Default: local backend on port 5000 (for both web and device via Expo dev tools)

  // Web (browser) or React Native Web - always use localhost
  const isWeb = Platform.OS === 'web' || (typeof window !== 'undefined' && typeof document !== 'undefined');
  if (isWeb) {
    return 'http://localhost:5001/api';
  }

  // Native (iOS/Android) - use Expo dev host IP so device can reach backend on same WiFi
  const envIp = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_IP;
  const ip = envIp || getDevHostFromExpo();
  if (ip) return `http://${ip}:5001/api`;

  const fallbackIp = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_IP;
  if (fallbackIp) return `http://${String(fallbackIp).trim()}:5001/api`;
  return 'http://localhost:5001/api';
};

const DEV_API_URL = getApiUrl();

export { getApiUrl, DEV_API_URL };

// Production API URL (Railway backend) - used only when explicitly configured
const PROD_API_URL = 'https://crm-backend-production-fc85.up.railway.app/api';

// Use local/dev URL by default; switch to PROD_API_URL only when env flag is set
const API_BASE_URL =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_USE_PRODUCTION === 'true'
    ? PROD_API_URL
    : DEV_API_URL;

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
    const headers: any = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Try to get token from storage if not set
    if (!this.token) {
      const storedToken = await AsyncStorage.getItem('authToken');
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }
    }

    return headers;
  }

  async get(endpoint: string) {
    try {
      const headers = await this.getHeaders();
      const response = await axios.get(`${this.baseURL}${endpoint}`, { 
        headers,
        timeout: 10000, // 10 second timeout
      });
      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('Network Error') || error.message?.includes('timeout')) {
        throw new Error(`Cannot connect to server. Make sure:\n1. Backend is running on port 5001\n2. API URL is correct (currently: ${this.baseURL})\n3. Device and computer are on same network\n4. Firewall allows port 5001`);
      }
      throw error;
    }
  }

  async post(endpoint: string, data: any) {
    try {
      const headers = await this.getHeaders();
      console.log(`POST ${this.baseURL}${endpoint}`, { data: { ...data, password: '***' } });
      const response = await axios.post(`${this.baseURL}${endpoint}`, data, { 
        headers,
        timeout: 30000, // 30 second timeout for posts (may have image uploads)
      });
      return response.data;
    } catch (error: any) {
      // Log error details for debugging
      if (error.response) {
        console.error(`API Error [${error.response.status}]:`, {
          endpoint: `${this.baseURL}${endpoint}`,
          status: error.response.status,
          data: error.response.data,
        });
      } else {
        console.error('Network Error:', {
          endpoint: `${this.baseURL}${endpoint}`,
          code: error.code,
          message: error.message,
        });
      }
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('Network Error') || error.message?.includes('timeout')) {
        throw new Error(`Cannot connect to server. Make sure:\n1. Backend is running on port 5001\n2. API URL is correct (currently: ${this.baseURL})\n3. Device and computer are on same network\n4. Firewall allows port 5001`);
      }
      // Throw with backend error message so UI can display it
      const backendMsg = error.response?.data?.message;
      if (backendMsg) {
        throw new Error(backendMsg);
      }
      throw error;
    }
  }

  async put(endpoint: string, data: any) {
    const headers = await this.getHeaders();
    const response = await axios.put(`${this.baseURL}${endpoint}`, data, { headers });
    return response.data;
  }

  /** Upload file (FormData). Uses fetch for reliable React Native file uploads (axios can fail with file URIs). */
  async upload(endpoint: string, formData: FormData) {
    const headers = await this.getHeaders();
    delete (headers as any)['Content-Type'];
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
      const data = text ? JSON.parse(text) : {};
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Upload timed out. Check your connection and try again.');
      }
      if (err.message?.includes('Upload failed')) throw err;
      if (err.message?.includes('Network request failed') || err.message?.includes('Failed to fetch')) {
        throw new Error(`Cannot connect to server. Ensure backend is running and API URL is correct (${this.baseURL}).`);
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

