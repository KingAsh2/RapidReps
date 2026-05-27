import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { AuthResponse, User, TrainerProfile, TraineeProfile, Session } from '../types';

// Get the backend URL - supports both development and production
const getBackendUrl = (): string => {
  // First try expo-constants (works in production builds)
  const extraBackendUrl = Constants.expoConfig?.extra?.backendUrl;
  if (extraBackendUrl) return extraBackendUrl;
  
  // Then try environment variable (works in development)
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl) return envUrl;
  
  // No fallback - URL must come from environment
  return '';
};

const API_BASE_URL = `${getBackendUrl()}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors — clear token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (__DEV__) {
      console.error('[API] Error:', error.config?.url, error.response?.status, error.message);
    }
    if (error?.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
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
    referralCode?: string;
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

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },

  socialLogin: async (provider: 'google' | 'apple' | 'facebook', data: any): Promise<AuthResponse & { isNewUser: boolean }> => {
    const response = await api.post(`/auth/social/${provider}`, data);
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

  // Search trainees by name, email, or phone (nationwide — bypasses proximity)
  searchTrainees: async (q: string): Promise<{ trainees: any[]; count: number }> => {
    const response = await api.get('/trainees/search', { params: { q } });
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

  setRates: async (rates: {
    offersInPerson?: boolean;
    offersVirtual?: boolean;
    offersInHome?: boolean;
    outdoorRateCents?: number;
    virtualRateCents?: number;
    inHomeRateCents?: number;
    // Per-duration pricing
    outdoor30Cents?: number;
    outdoor60Cents?: number;
    outdoor90Cents?: number;
    virtual30Cents?: number;
    virtual60Cents?: number;
    virtual90Cents?: number;
    inHome30Cents?: number;
    inHome60Cents?: number;
    inHome90Cents?: number;
  }): Promise<any> => {
    const response = await api.post('/trainer/set-rates', rates);
    return response.data;
  },

  // Location & Availability APIs (Uber-style)
  updateLocation: async (latitude: number, longitude: number): Promise<any> => {
    const response = await api.put('/trainer/location', { latitude, longitude });
    return response.data;
  },

  goLive: async (): Promise<any> => {
    const response = await api.post('/trainer/go-live');
    return response.data;
  },

  goOffline: async (): Promise<any> => {
    const response = await api.post('/trainer/go-offline');
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

  // Stripe Connect
  connectOnboard: async (): Promise<{ url?: string; accountId?: string; alreadyOnboarded?: boolean; message?: string }> => {
    const response = await api.post('/trainer/connect/onboard');
    return response.data;
  },

  connectStatus: async (): Promise<{ connected: boolean; onboarded: boolean; accountId?: string }> => {
    const response = await api.get('/trainer/connect/status');
    return response.data;
  },

  getZelleInfo: async (): Promise<{ zelleEmail: string; zellePhone: string; hasZelleInfo: boolean }> => {
    const response = await api.get('/trainer/zelle-info');
    return response.data;
  },

  connectDashboard: async (): Promise<{ url: string }> => {
    const response = await api.get('/trainer/connect/dashboard');
    return response.data;
  },

  // Propose outdoor location for a session
  proposeLocation: async (sessionId: string, proposedLocation: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/propose-location`, {
      proposedLocation,
    });
    return response.data;
  },

  // Confirm arrival at session location
  confirmArrival: async (sessionId: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/trainer-arrived`);
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
      const userId = userResponse.data.id;
      
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

  // Convenience features
  getRecentTrainers: async (): Promise<any> => {
    const response = await api.get('/trainee/recent-trainers');
    return response.data;
  },

  getStreak: async (): Promise<any> => {
    const response = await api.get('/trainee/streak');
    return response.data;
  },

  createRecurringSessions: async (data: {
    trainerId: string;
    locationType?: string;
    durationMinutes?: number;
    dayOfWeek: number;
    timeSlot: string;
    recurrenceType?: string;
    numberOfSessions?: number;
    locationNameOrAddress?: string;
  }): Promise<any> => {
    const response = await api.post('/sessions/recurring', data);
    return response.data;
  },

  getFavoriteAvailability: async (): Promise<any> => {
    const response = await api.get('/trainee/favorite-availability');
    return response.data;
  },

  toggleFavorite: async (trainerId: string): Promise<any> => {
    const response = await api.post(`/trainee/toggle-favorite/${trainerId}`);
    return response.data;
  },

  getSavedTrainers: async (): Promise<any> => {
    const response = await api.get('/trainee/saved-trainers');
    return response.data;
  },

  // Outdoor location agreement - Trainee responds to trainer's location proposal
  agreeToLocation: async (sessionId: string, agreed: boolean, counterProposal?: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/agree-location`, {
      agreed,
      counterProposal,
    });
    return response.data;
  },

  // Confirm arrival at session location
  confirmArrival: async (sessionId: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/trainee-arrived`);
    return response.data;
  },
};

// Sessions API - for shared session operations
export const sessionsAPI = {
  // Get session by ID
  getSession: async (sessionId: string): Promise<any> => {
    const response = await api.get(`/sessions/${sessionId}`);
    return response.data;
  },

  // Propose outdoor location (trainer)
  proposeLocation: async (sessionId: string, proposedLocation: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/propose-location`, {
      proposedLocation,
    });
    return response.data;
  },

  // Agree to location (trainee)
  agreeToLocation: async (sessionId: string, agreed: boolean, counterProposal?: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/agree-location`, {
      agreed,
      counterProposal,
    });
    return response.data;
  },

  // Confirm arrival
  confirmArrival: async (sessionId: string, role: 'trainer' | 'trainee'): Promise<any> => {
    const endpoint = role === 'trainer' ? 'trainer-arrived' : 'trainee-arrived';
    const response = await api.post(`/sessions/${sessionId}/${endpoint}`);
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

// Streaks / Consistency Points API
export const streaksAPI = {
  getMyStreaks: async (): Promise<any> => {
    const response = await api.get('/streaks/me');
    return response.data;
  },
  getLeaderboard: async (): Promise<any> => {
    const response = await api.get('/leaderboard/weekly');
    return response.data;
  },
};

// Push Notifications API
export const notificationsAPI = {
  registerToken: async (token: string, deviceId?: string): Promise<any> => {
    const response = await api.post('/push-tokens/register', { token, deviceId });
    return response.data;
  },
  unregisterToken: async (token: string): Promise<any> => {
    const response = await api.delete('/push-tokens/unregister', { data: { token } });
    return response.data;
  },
  getNotifications: async (): Promise<any> => {
    const response = await api.get('/notifications');
    return response.data;
  },
  markAllRead: async (): Promise<any> => {
    const response = await api.post('/notifications/mark-read');
    return response.data;
  },
  getPreferences: async (): Promise<any> => {
    const response = await api.get('/notification-preferences');
    return response.data;
  },
  updatePreferences: async (prefs: any): Promise<any> => {
    const response = await api.put('/notification-preferences', prefs);
    return response.data;
  },
};

// Weekly Digest API
export const digestAPI = {
  getWeeklyDigest: async (): Promise<any> => {
    const response = await api.get('/weekly-digest');
    return response.data;
  },
};

// Referral API
export const referralAPI = {
  getMyCode: async (): Promise<{ referralCode: string }> => {
    const response = await api.get('/referral/my-code');
    return response.data;
  },
  getStats: async (): Promise<any> => {
    const response = await api.get('/referral/stats');
    return response.data;
  },
  validateCode: async (code: string): Promise<{ valid: boolean; referrerName?: string; message?: string }> => {
    const response = await api.get(`/referral/validate/${code}`);
    return response.data;
  },
  getCredits: async (): Promise<{ availableCredits: number }> => {
    const response = await api.get('/referral/credits');
    return response.data;
  },
  trackInvite: async (params: {
    channel: 'sms' | 'email' | 'share';
    audience?: 'trainer' | 'trainee';
    targetQuery?: string;
  }): Promise<{ success: boolean }> => {
    const response = await api.post('/referral/track-invite', params);
    return response.data;
  },
  getInviteStats: async (): Promise<{
    total: number;
    byChannel: { sms: number; email: number; share: number };
  }> => {
    const response = await api.get('/referral/invite-stats');
    return response.data;
  },
};

// Admin Payouts API
export const adminPayoutsAPI = {
  getPending: async (): Promise<any> => {
    const response = await api.get('/admin/payouts/pending');
    return response.data;
  },
  payTrainer: async (trainerId: string, amountCents?: number, notes?: string): Promise<any> => {
    const response = await api.post('/admin/payouts/pay-trainer', { trainerId, amountCents, notes });
    return response.data;
  },
  payAll: async (): Promise<any> => {
    const response = await api.post('/admin/payouts/pay-all');
    return response.data;
  },
  getHistory: async (limit?: number): Promise<any> => {
    const response = await api.get('/admin/payouts/history', { params: { limit: limit || 50 } });
    return response.data;
  },
};

// Session Tracking API (en-route + GPS)
export const sessionTrackingAPI = {
  startEnRoute: async (sessionId: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/start-en-route`);
    return response.data;
  },
  gpsUpdate: async (sessionId: string, latitude: number, longitude: number, accuracy: number = 0): Promise<any> => {
    const response = await api.post(
      `/sessions/${sessionId}/gps-update`,
      null,
      { params: { latitude, longitude, accuracy } }
    );
    return response.data;
  },
  getGpsTrack: async (sessionId: string): Promise<any> => {
    const response = await api.get(`/sessions/${sessionId}/gps-track`);
    return response.data;
  },
  startSession: async (sessionId: string): Promise<any> => {
    const response = await api.post(`/sessions/${sessionId}/start-session`);
    return response.data;
  },
};


// Ranked Trainer Search (ETA-weighted)
export const rankedSearchAPI = {
  search: async (lat: number, lng: number, sessionType: string = 'outdoor', maxDistance: number = 20, specialty?: string): Promise<any> => {
    const params: any = { latitude: lat, longitude: lng, session_type: sessionType, max_distance: maxDistance };
    if (specialty) params.specialty = specialty;
    const response = await api.get('/trainers/ranked-search', { params });
    return response.data;
  },
};

// Instant Workout Match
export const instantMatchAPI = {
  start: async (lat: number, lng: number, sessionType: string = 'outdoor', duration: number = 30): Promise<any> => {
    const response = await api.post('/sessions/instant-match', { latitude: lat, longitude: lng, sessionType, durationMinutes: duration, maxDistanceMiles: 10 });
    return response.data;
  },
  getStatus: async (matchId: string): Promise<any> => {
    const response = await api.get(`/sessions/instant-match/${matchId}/status`);
    return response.data;
  },
  accept: async (matchId: string): Promise<any> => {
    const response = await api.post(`/sessions/instant-match/${matchId}/accept`);
    return response.data;
  },
  decline: async (matchId: string): Promise<any> => {
    const response = await api.post(`/sessions/instant-match/${matchId}/decline`);
    return response.data;
  },
  cancel: async (matchId: string): Promise<any> => {
    const response = await api.post(`/sessions/instant-match/${matchId}/cancel`);
    return response.data;
  },
  virtualInstant: async (duration: number = 30): Promise<any> => {
    const response = await api.post(`/sessions/virtual-instant?duration_minutes=${duration}`);
    return response.data;
  },
};

// Trainer Tools
export const trainerToolsAPI = {
  // Workout Plans
  createPlan: async (data: any): Promise<any> => { const r = await api.post('/trainer-tools/workout-plans', data); return r.data; },
  listPlans: async (traineeId?: string): Promise<any> => { const r = await api.get('/trainer-tools/workout-plans', { params: traineeId ? { trainee_id: traineeId } : {} }); return r.data; },
  getPlan: async (id: string): Promise<any> => { const r = await api.get(`/trainer-tools/workout-plans/${id}`); return r.data; },
  updatePlan: async (id: string, data: any): Promise<any> => { const r = await api.put(`/trainer-tools/workout-plans/${id}`, data); return r.data; },
  deletePlan: async (id: string): Promise<any> => { const r = await api.delete(`/trainer-tools/workout-plans/${id}`); return r.data; },
  // Session Notes
  createNote: async (data: any): Promise<any> => { const r = await api.post('/trainer-tools/session-notes', data); return r.data; },
  listNotes: async (traineeId?: string): Promise<any> => { const r = await api.get('/trainer-tools/session-notes', { params: traineeId ? { trainee_id: traineeId } : {} }); return r.data; },
  deleteNote: async (id: string): Promise<any> => { const r = await api.delete(`/trainer-tools/session-notes/${id}`); return r.data; },
  // Client Progress
  updateProgress: async (traineeId: string, data: any): Promise<any> => { const r = await api.post(`/trainer-tools/client-progress/${traineeId}`, data); return r.data; },
  getProgress: async (traineeId: string): Promise<any> => { const r = await api.get(`/trainer-tools/client-progress/${traineeId}`); return r.data; },
  // My Clients
  getClients: async (): Promise<any> => { const r = await api.get('/trainer-tools/my-clients'); return r.data; },
};

// Community Feed
export const feedAPI = {
  getFeed: async (page: number = 1): Promise<any> => { const r = await api.get('/feed', { params: { page } }); return r.data; },
  toggleLike: async (postId: string): Promise<any> => { const r = await api.post(`/feed/${postId}/like`); return r.data; },
  createPost: async (content: string, postType: string = 'user_post'): Promise<any> => { const r = await api.post(`/feed?content=${encodeURIComponent(content)}&post_type=${postType}`); return r.data; },
};

// Group Sessions
export const groupSessionAPI = {
  create: async (data: any): Promise<any> => { const r = await api.post('/group-sessions', data); return r.data; },
  list: async (status?: string, page?: number): Promise<any> => { const r = await api.get('/group-sessions', { params: { status: status || 'upcoming', page: page || 1 } }); return r.data; },
  get: async (id: string): Promise<any> => { const r = await api.get(`/group-sessions/${id}`); return r.data; },
  join: async (id: string): Promise<any> => { const r = await api.post(`/group-sessions/${id}/join`); return r.data; },
  leave: async (id: string): Promise<any> => { const r = await api.post(`/group-sessions/${id}/leave`); return r.data; },
  start: async (id: string): Promise<any> => { const r = await api.post(`/group-sessions/${id}/start`); return r.data; },
  complete: async (id: string): Promise<any> => { const r = await api.post(`/group-sessions/${id}/complete`); return r.data; },
  edit: async (id: string, data: any): Promise<any> => { const r = await api.put(`/group-sessions/${id}`, data); return r.data; },
};

// Progress Tracking
export const progressAPI = {
  get: async (userId: string): Promise<any> => { const r = await api.get(`/progress/${userId}`); return r.data; },
  getHistory: async (userId: string, limit?: number): Promise<any> => { const r = await api.get(`/progress/${userId}/history`, { params: { limit: limit || 30 } }); return r.data; },
};

// Safety Check - QR Verification System
export const safetyCheckAPI = {
  generateToken: async (sessionId: string): Promise<any> => {
    const r = await api.post(`/safety-check/generate-token/${sessionId}`);
    return r.data;
  },
  verify: async (token: string): Promise<any> => {
    const r = await api.post('/safety-check/verify', { token });
    return r.data;
  },
  getBadgeData: async (sessionId: string): Promise<any> => {
    const r = await api.get(`/safety-check/badge/${sessionId}`);
    return r.data;
  },
  getActiveSession: async (): Promise<any> => {
    const r = await api.get('/safety-check/active-session');
    return r.data;
  },
  getTimerStatus: async (sessionId: string): Promise<any> => {
    const r = await api.get(`/safety-check/timer/${sessionId}`);
    return r.data;
  },
  completeTimer: async (sessionId: string): Promise<any> => {
    const r = await api.post(`/safety-check/timer/${sessionId}/complete`);
    return r.data;
  },
  canStart: async (sessionId: string): Promise<any> => {
    const r = await api.get(`/safety-check/can-start/${sessionId}`);
    return r.data;
  },
  // Admin endpoints
  adminActiveSessions: async (): Promise<any> => {
    const r = await api.get('/safety-check/admin/active-sessions');
    return r.data;
  },
  adminVerificationLog: async (limit?: number, skip?: number): Promise<any> => {
    const r = await api.get('/safety-check/admin/verification-log', { params: { limit: limit || 50, skip: skip || 0 } });
    return r.data;
  },
  adminSafetyEvents: async (): Promise<any> => {
    const r = await api.get('/safety-check/admin/safety-events');
    return r.data;
  },
  adminDurationTracking: async (): Promise<any> => {
    const r = await api.get('/safety-check/admin/duration-tracking');
    return r.data;
  },
  adminOverride: async (sessionId: string, reason: string): Promise<any> => {
    const r = await api.post('/safety-check/admin/override', { sessionId, reason });
    return r.data;
  },
};

