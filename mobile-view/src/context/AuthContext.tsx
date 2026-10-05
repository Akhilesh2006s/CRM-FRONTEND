import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  hasCompletedFirstTimeSetup?: boolean;
}

interface AuthContextType {
  user: User | null;
  isFirstTime: boolean;
  loading: boolean;
  login: (mobile: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Survives Fast Refresh so the app does not flash to login / a blank screen. */
let sessionUser: User | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(sessionUser);
  const [loading, setLoading] = useState(!sessionUser);

  const setUser = (next: User | null) => {
    sessionUser = next;
    setUserState(next);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    console.log('Auth state:', { user: user?.email || 'null', loading, isFirstTime: user ? !user.hasCompletedFirstTimeSetup : false });
  }, [user, loading]);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');

      if (token && userData) {
        apiService.setToken(token);
        const parsed = JSON.parse(userData);
        const id = parsed?._id || parsed?.id;
        if (id) {
          setUser({ ...parsed, _id: id });
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (mobile: string, password: string) => {
    try {
      console.log('Attempting login with mobile:', mobile);
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      const response = await apiService.post('/auth/login', {
        mobile,
        password,
        deviceId,
      });
      const { token, ...userData } = response;

      if (!token) {
        throw new Error('No token received from server');
      }

      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      apiService.setToken(token);
      const id = userData?._id || userData?.id;
      setUser(id ? { ...userData, _id: id } : userData);
      console.log('Login successful for user:', userData.email);
    } catch (error: any) {
      console.error('Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });

      if (error.response?.status === 403) {
        throw new Error(error.response?.data?.message || 'Device not authorized. Contact admin to reset device.');
      }

      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || 'Invalid mobile number, email, or password';
        throw new Error(errorMessage);
      }

      if (
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout')
      ) {
        throw new Error('Cannot connect to server. Make sure the backend is running on port 5000.');
      }

      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }

      if (error.message && !error.message.includes('Request failed')) {
        throw error;
      }

      throw new Error(error.message || 'Login failed. Please check your credentials and try again.');
    }
  };

  const logout = async () => {
    setUser(null);
    apiService.setToken('');
    try {
      await AsyncStorage.multiRemove(['authToken', 'userData', 'authUser', 'adminSessionBackup']);
    } catch (e) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('authUser');
      await AsyncStorage.removeItem('adminSessionBackup');
    }
  };

  const isFirstTime = user ? !user.hasCompletedFirstTimeSetup : false;

  return (
    <AuthContext.Provider value={{ user, isFirstTime, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
