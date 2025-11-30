import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthResponse, User, TrainerProfile, TraineeProfile, Session } from '../types';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_BASE_URL = `${EXPO_PUBLIC_BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  signup: async (data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    roles: string[];
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Trainer Profile API
export const trainerAPI = {
  createProfile: async (profile: any): Promise<TrainerProfile> => {
    const response = await api.post('/trainer-profiles', profile);
    return response.data;
  },

  getProfile: async (userId: string): Promise<TrainerProfile> => {
    const response = await api.get(`/trainer-profiles/${userId}`);
    return response.data;
  },

  updateProfile: async (profile: any): Promise<TrainerProfile> => {
    const response = await api.post('/trainer-profiles', profile);
    return response.data;
  },

  getMyProfile: async (): Promise<TrainerProfile> => {
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (!user) throw new Error('User not found');
    const response = await api.get(`/trainer-profiles/${user.id}`);
    return response.data;
  },

  searchTrainers: async (filters: any): Promise<TrainerProfile[]> => {
    const response = await api.get('/trainers/search', { params: filters });
    return response.data;
  },

  getSessions: async (status?: string): Promise<Session[]> => {
    const response = await api.get('/trainer/sessions', { params: { status } });
    return response.data;
  },

  acceptSession: async (sessionId: string): Promise<Session> => {
    const response = await api.patch(`/sessions/${sessionId}/accept`);
    return response.data;
  },

  declineSession: async (sessionId: string): Promise<Session> => {
    const response = await api.patch(`/sessions/${sessionId}/decline`);
    return response.data;
  },

  completeSession: async (sessionId: string): Promise<Session> => {
    const response = await api.patch(`/sessions/${sessionId}/complete`);
    return response.data;
  },

  getEarnings: async (): Promise<any> => {
    const response = await api.get('/trainer/earnings');
    return response.data;
  },

  getRatings: async (trainerId: string): Promise<any[]> => {
    const response = await api.get(`/trainers/${trainerId}/ratings`);
    return response.data;
  },
};

// Trainee Profile API
export const traineeAPI = {
  createProfile: async (profile: any): Promise<TraineeProfile> => {
    const response = await api.post('/trainee-profiles', profile);
    return response.data;
  },

  getProfile: async (userId: string): Promise<TraineeProfile> => {
    const response = await api.get(`/trainee-profiles/${userId}`);
    return response.data;
  },

  getSessions: async (status?: string): Promise<Session[]> => {
    const response = await api.get('/trainee/sessions', { params: { status } });
    return response.data;
  },

  createSession: async (session: any): Promise<Session> => {
    const response = await api.post('/sessions', session);
    return response.data;
  },

  createRating: async (rating: any): Promise<any> => {
    const response = await api.post('/ratings', rating);
    return response.data;
  },
};

export default api;
