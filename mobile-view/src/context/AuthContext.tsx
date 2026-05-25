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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Debug: Log auth state
  useEffect(() => {
    console.log('Auth state:', { user: user?.email || 'null', loading, isFirstTime: user ? !user.hasCompletedFirstTimeSetup : false });
  }, [user, loading]);

  const checkAuth = async () => {
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), 3000)
      );
      
      const authPromise = (async () => {
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (token && userData) {
          apiService.setToken(token);
          const user = JSON.parse(userData);
          setUser(user);
        } else {
          // No stored auth, ensure user is null
          setUser(null);
        }
      })();

      await Promise.race([authPromise, timeoutPromise]);
    } catch (error) {
      console.error('Auth check error:', error);
      // On error, clear any invalid data and show login
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (mobile: string, password: string) => {
    try {
      console.log('Attempting login with mobile:', mobile);
      const response = await apiService.post('/auth/login', { mobile, email: mobile, password });
      const { token, ...userData } = response;
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      apiService.setToken(token);
      setUser(userData);
      console.log('Login successful for user:', userData.email);
    } catch (error: any) {
      console.error('Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
      });
      
      // Handle 401 Unauthorized (invalid credentials)
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || 'Invalid mobile number, email, or password';
        throw new Error(errorMessage);
      }
      
      // Handle network errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message?.includes('Network Error') || error.message?.includes('timeout')) {
        throw new Error('Cannot connect to server. Make sure:\n1. Backend is running on port 5000\n2. API URL is correct\n3. Device and computer are on same network\n4. Firewall allows port 5000');
      }
      
      // Handle other axios errors
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      
      // Handle custom error messages
      if (error.message && !error.message.includes('Request failed')) {
        throw error;
      }
      
      // Default error message
      throw new Error(error.message || 'Login failed. Please check your credentials and try again.');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['authToken', 'userData', 'authUser']);
    } catch (e) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('authUser');
    }
    apiService.setToken('');
    setUser(null);
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

