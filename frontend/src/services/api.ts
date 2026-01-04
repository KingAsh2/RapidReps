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

  deleteMe: async (): Promise<{ success: boolean }> => {
    const response = await api.delete('/auth/me');
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

  getNearbyTrainees: async (): Promise<any> => {
    const response = await api.get('/trainers/nearby-trainees');
    return response.data;
  },

  toggleAvailability: async (isAvailable: boolean): Promise<any> => {
    const response = await api.patch('/trainer-profiles/toggle-availability', null, {
      params: { isAvailable },
    });
    return response.data;
  },

  getAchievements: async (): Promise<any> => {
    const response = await api.get('/trainer/achievements');
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

  getMyProfile: async (): Promise<TraineeProfile> => {
    try {
      // First get the current user to get their ID
      const userResponse = await api.get('/auth/me');
      const userId = userResponse.data._id;
      
      // Then get their trainee profile
      const response = await api.get(`/trainee-profiles/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error in getMyProfile:', error);
      throw error;
    }
  },

  updateProfile: async (profile: any): Promise<TraineeProfile> => {
    const response = await api.post('/trainee-profiles', profile);
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

  requestVirtualSession: async (traineeId: string, durationMinutes: number = 30, notes?: string): Promise<any> => {
    const response = await api.post('/virtual-sessions/request', {
      traineeId,
      durationMinutes,
      paymentMethod: 'mock',
      notes,
    });
    return response.data;
  },

  getAchievements: async (): Promise<any> => {
    const response = await api.get('/trainee/achievements');
    return response.data;
  },
};

export default api;


// Safety / Moderation API
export const safetyAPI = {
  reportUser: async (data: { reportedUserId: string; reason: string; context?: string; contentType?: string; contentId?: string; }): Promise<{ success: boolean }> => {
    const response = await api.post('/safety/report', data);
    return response.data;
  },

  blockUser: async (blockedUserId: string): Promise<{ success: boolean }> => {
    const response = await api.post(`/safety/block/${blockedUserId}`);
    return response.data;
  },

  unblockUser: async (blockedUserId: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/safety/block/${blockedUserId}`);
    return response.data;
  },

  getMyBlocks: async (): Promise<{ blockedUserIds: string[] }> => {
    const response = await api.get('/safety/blocks');
    return response.data;
  },
};

// Chat / Messaging API
export const chatAPI = {
  sendMessage: async (receiverId: string, content: string, conversationId?: string): Promise<any> => {
    const response = await api.post('/messages', {
      receiverId,
      content,
      conversationId,
    });
    return response.data;
  },

  getConversations: async (): Promise<any[]> => {
    const response = await api.get('/conversations');
    return response.data;
  },

  getMessages: async (conversationId: string): Promise<any[]> => {
    const response = await api.get(`/conversations/${conversationId}/messages`);
    return response.data;
  },

  getOrCreateConversation: async (receiverId: string): Promise<{ conversationId: string }> => {
    const response = await api.post('/conversations', null, {
      params: { receiver_id: receiverId },
    });
    return response.data;
  },
};

