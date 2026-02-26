import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AuthResponse, User, TrainerProfile, TraineeProfile, Session } from '../types';

// Get the backend URL - supports both development and production
const getBackendUrl = (): string => {
  // First try expo-constants (works in production builds)
  const extraBackendUrl = Constants.expoConfig?.extra?.backendUrl;
  if (extraBackendUrl) {
    console.log('[API] Using backend URL from Constants.extra:', extraBackendUrl);
    return extraBackendUrl;
  }
  
  // Then try environment variable (works in development)
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) {
    console.log('[API] Using backend URL from env:', envUrl);
    return envUrl;
  }
  
  // Fallback - use relative URL (works when backend and frontend are on same domain)
  // In production, EXPO_PUBLIC_BACKEND_URL will be set by the deployment system
  console.log('[API] Using relative URL fallback (same-origin deployment)');
  return '';
};

const API_BASE_URL = `${getBackendUrl()}/api`;

console.log('[API] Final backend URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000, // 15 second timeout
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('[API] Request:', config.method?.toUpperCase(), config.url);
  return config;
});

// Add response/error logging
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response OK:', response.config.url);
    return response;
  },
  (error) => {
    console.error('[API] Error:', error.config?.url, error.message);
    if (error.response) {
      console.error('[API] Status:', error.response.status, error.response.data);
    }
    throw error;
  }
);

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
    try {
      // First get the current user to get their ID
      const userResponse = await api.get('/auth/me');
      const userId = userResponse.data.id;  // Fixed: was _id, now id
      
      // Then get their trainer profile
      const response = await api.get(`/trainer-profiles/${userId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error in trainer getMyProfile:', error);
      throw error;
    }
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

  cancelSession: async (sessionId: string): Promise<any> => {
    const response = await api.patch(`/sessions/${sessionId}/cancel`);
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

  // Location & Availability APIs (Uber-style)
  updateLocation: async (latitude: number, longitude: number): Promise<any> => {
    const response = await api.put('/trainer/location', { latitude, longitude });
    return response.data;
  },

  updateAvailability: async (isAvailable: boolean, latitude?: number, longitude?: number): Promise<any> => {
    const response = await api.put('/trainer/availability', { 
      isAvailable, 
      latitude, 
      longitude 
    });
    return response.data;
  },

  getLocationStatus: async (): Promise<any> => {
    const response = await api.get('/trainer/my-location-status');
    return response.data;
  },

  // NEW: Trainer Onboarding & Verification APIs (PRD Rules)
  getOnboardingStatus: async (): Promise<{
    canGoLive: boolean;
    profileExists: boolean;
    missingRequirements: string[];
    completedRequirements: string[];
    verificationStatus: string;
    trainerTier: string;
    totalReviews: number;
    averageRating: number;
  }> => {
    const response = await api.get('/trainer/onboarding-status');
    return response.data;
  },

  getPricingLimits: async (): Promise<{
    trainerTier: string;
    totalReviews: number;
    averageRating: number;
    pricingLimits: {
      virtual: { minCents: number; maxCents: number };
      outdoor: { minCents: number; maxCents: number };
      inHome: { minCents: number; maxCents: number };
    };
    travelFees: Record<string, number>;
    cancellationFees: { virtual: number; outdoor: number; inHome: number };
    platformFeePercent: number;
  }> => {
    const response = await api.get('/trainer/pricing-limits');
    return response.data;
  },

  uploadIntroVideo: async (videoUrl: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/trainer/upload-intro-video', null, {
      params: { video_url: videoUrl }
    });
    return response.data;
  },

  updateVerification: async (
    verificationType: 'government_id' | 'ssn_check' | 'background_check' | 'sex_offender_check' | 'cpr_aed_cert' | 'fitness_cert',
    passed: boolean = true
  ): Promise<{
    success: boolean;
    verificationType: string;
    passed: boolean;
    canGoLive: boolean;
    missingRequirements: string[];
  }> => {
    const response = await api.post('/trainer/update-verification', null, {
      params: { verification_type: verificationType, passed }
    });
    return response.data;
  },

  // NEW: Session Safety PIN Flow (PRD Rule #7, #12)
  verifySessionPin: async (sessionId: string, pin: string): Promise<{
    success: boolean;
    message: string;
    sessionStartedAt?: string;
  }> => {
    const response = await api.post(`/sessions/${sessionId}/verify-pin`, null, {
      params: { pin }
    });
    return response.data;
  },

  confirmGpsArrival: async (sessionId: string, latitude: number, longitude: number): Promise<{
    success: boolean;
    message: string;
    distanceMiles?: number;
  }> => {
    const response = await api.post(`/sessions/${sessionId}/confirm-gps`, null, {
      params: { latitude, longitude }
    });
    return response.data;
  },

  endSession: async (sessionId: string): Promise<{
    success: boolean;
    message: string;
    sessionEndedAt: string;
  }> => {
    const response = await api.post(`/sessions/${sessionId}/end`);
    return response.data;
  },

  clientConfirmEnd: async (sessionId: string): Promise<{
    success: boolean;
    message: string;
    trainerEarningsCents: number;
  }> => {
    const response = await api.post(`/sessions/${sessionId}/client-confirm-end`);
    return response.data;
  },

  markNoShow: async (sessionId: string): Promise<{
    success: boolean;
    session: Session;
    noShowFeeCents: number;
    trainerEarningsCents: number;
    message: string;
  }> => {
    const response = await api.patch(`/sessions/${sessionId}/no-show`);
    return response.data;
  },

  // Verification Flow
  getVerificationStatus: async (): Promise<{
    steps: Record<string, string>;
    canGoLive: boolean;
    missingRequirements?: string[];
  }> => {
    const response = await api.get('/trainer/verification-status');
    return response.data;
  },

  submitVerificationStep: async (stepId: string, fileUri?: string, fileName?: string): Promise<{
    success: boolean;
    stepId: string;
    canGoLive: boolean;
    missingRequirements: string[];
  }> => {
    const response = await api.post('/trainer/submit-verification-step', {
      stepId,
      fileUri: fileUri || null,
      fileName: fileName || null,
    });
    return response.data;
  },

  submitAllVerification: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/trainer/submit-all-verification');
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

  cancelSession: async (sessionId: string): Promise<any> => {
    const response = await api.patch(`/sessions/${sessionId}/cancel`);
    return response.data;
  },

  // Get nearby available trainers (Uber-style)
  getNearbyTrainers: async (latitude: number, longitude: number, radiusMiles: number = 25): Promise<any> => {
    const response = await api.get('/trainers/nearby', {
      params: { latitude, longitude, radius_miles: radiusMiles }
    });
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

