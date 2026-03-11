import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeRole: string | null;
  isDemoMode: boolean;
  signup: (data: any) => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setActiveRole: (role: string) => Promise<void>;
  setDemoMode: (role: 'trainee' | 'trainer') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      // Check if in demo mode first
      const demoRole = await AsyncStorage.getItem('demo_role');
      if (demoRole) {
        setIsDemoMode(true);
        setActiveRoleState(demoRole);
        // Create a mock user for demo mode
        setUser({
          id: 'demo-user',
          fullName: demoRole === 'trainer' ? 'Demo Trainer' : 'Demo Trainee',
          email: demoRole === 'trainer' ? 'demo@trainer.com' : 'demo@trainee.com',
          phone: '+15551234567',
          roles: [demoRole],
          isAdmin: false,
          createdAt: new Date().toISOString(),
        });
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      const token = await AsyncStorage.getItem('auth_token');
      const savedRole = await AsyncStorage.getItem('active_role');
      
      if (token) {
        try {
          const userData = await authAPI.getMe();
          setUser(userData);
          
          if (savedRole && userData.roles.includes(savedRole)) {
            setActiveRoleState(savedRole);
          } else if (userData.roles.length > 0) {
            setActiveRoleState(userData.roles[0]);
          }
        } catch (apiError: any) {
          // Only clear token on 401 Unauthorized — keep session alive on network/timeout errors
          if (apiError?.response?.status === 401) {
            console.error('Token expired or invalid, clearing auth');
            await AsyncStorage.removeItem('auth_token');
          } else {
            console.error('Transient error fetching user (keeping token):', apiError?.message);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  const setDemoMode = async (role: 'trainee' | 'trainer') => {
    setIsDemoMode(true);
    setActiveRoleState(role);
    await AsyncStorage.setItem('demo_role', role);
    
    // Create a mock user for demo mode
    setUser({
      id: 'demo-user',
      fullName: role === 'trainer' ? 'Demo Trainer' : 'Demo Trainee',
      email: role === 'trainer' ? 'demo@trainer.com' : 'demo@trainee.com',
      phone: '+15551234567',
      roles: [role],
      isAdmin: false,
      createdAt: new Date().toISOString(),
    });
  };

  const signup = async (data: any) => {
    const response = await authAPI.signup(data);
    await AsyncStorage.setItem('auth_token', response.access_token);
    await AsyncStorage.removeItem('demo_role'); // Clear demo mode
    setIsDemoMode(false);
    setUser(response.user);
    
    // Set initial active role
    if (response.user.roles.length > 0) {
      const initialRole = response.user.roles[0];
      setActiveRoleState(initialRole);
      await AsyncStorage.setItem('active_role', initialRole);
    }
  };

  const login = async (email: string, password: string): Promise<User> => {
    let response;
    try {
      response = await authAPI.login(email, password);
    } catch (apiErr) {
      // Re-throw API errors as-is (axios errors with response/status)
      throw apiErr;
    }
    
    try {
      await AsyncStorage.setItem('auth_token', response.access_token);
    } catch (storageErr: any) {
      throw new Error(`TOKEN_STORAGE_FAILED: ${storageErr?.message || 'Unknown'}`);
    }
    
    try {
      await AsyncStorage.removeItem('demo_role');
    } catch (_) {
      // Non-critical, ignore
    }
    
    setIsDemoMode(false);
    setUser(response.user);
    
    // Set active role
    try {
      const savedRole = await AsyncStorage.getItem('active_role');
      if (savedRole && response.user.roles?.includes(savedRole)) {
        setActiveRoleState(savedRole);
      } else if (response.user.roles?.length > 0) {
        const initialRole = response.user.roles[0];
        setActiveRoleState(initialRole);
        await AsyncStorage.setItem('active_role', initialRole);
      }
    } catch (roleErr: any) {
      // Non-critical - role setting failed but login succeeded
      console.error('Role setting error:', roleErr);
    }
    
    return response.user;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('active_role');
    await AsyncStorage.removeItem('demo_role');
    setUser(null);
    setActiveRoleState(null);
    setIsDemoMode(false);
    // Navigation to '/' is handled by the root layout detecting null user
  };

  const setActiveRole = async (role: string) => {
    if (user && user.roles.includes(role)) {
      setActiveRoleState(role);
      await AsyncStorage.setItem('active_role', role);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeRole,
        isDemoMode,
        signup,
        login,
        logout,
        setActiveRole,
        setDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Return safe defaults if context is not available (during app initialization)
  if (!context) {
    return {
      user: null,
      loading: true,
      activeRole: null,
      isDemoMode: false,
      signup: async () => { throw new Error('Auth not initialized'); },
      login: async () => { throw new Error('Auth not initialized'); },
      logout: async () => {},
      setActiveRole: async () => {},
      setDemoMode: () => {},
    };
  }
  return context;
};
