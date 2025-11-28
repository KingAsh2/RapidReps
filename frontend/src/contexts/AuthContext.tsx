import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeRole: string | null;
  signup: (data: any) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveRole: (role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
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
        } catch (apiError) {
          console.error('Error fetching user data:', apiError);
          await AsyncStorage.removeItem('auth_token');
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  const signup = async (data: any) => {
    const response = await authAPI.signup(data);
    await AsyncStorage.setItem('auth_token', response.access_token);
    setUser(response.user);
    
    // Set initial active role
    if (response.user.roles.length > 0) {
      const initialRole = response.user.roles[0];
      setActiveRoleState(initialRole);
      await AsyncStorage.setItem('active_role', initialRole);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    await AsyncStorage.setItem('auth_token', response.access_token);
    setUser(response.user);
    
    // Set active role
    const savedRole = await AsyncStorage.getItem('active_role');
    if (savedRole && response.user.roles.includes(savedRole)) {
      setActiveRoleState(savedRole);
    } else if (response.user.roles.length > 0) {
      const initialRole = response.user.roles[0];
      setActiveRoleState(initialRole);
      await AsyncStorage.setItem('active_role', initialRole);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('active_role');
    setUser(null);
    setActiveRoleState(null);
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
        signup,
        login,
        logout,
        setActiveRole,
      }}
    >
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
