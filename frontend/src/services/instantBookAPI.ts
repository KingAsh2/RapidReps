/**
 * instantBookAPI — iter118x
 *
 * Thin wrapper around the backend Instant Book endpoint. Kept in its own
 * file so the existing services/api.ts (already very large) doesn't need
 * another surgery.
 */
import api from './api';

export type InstantBookPayload = {
  trainerId: string;
  sessionType?: 'outdoor' | 'in_home' | 'virtual';
  durationMin?: number;
  currentLat?: number;
  currentLng?: number;
  meetingLocation?: string;
};

export type InstantBookResult = {
  sessionId: string;
  trainerId: string;
  trainerName: string;
  sessionType: string;
  durationMin: number;
  status: string;
  scheduledAt: string;
};

export const instantBookAPI = {
  async book(payload: InstantBookPayload): Promise<InstantBookResult> {
    const res = await api.post('/sessions/instant-book', payload);
    return res.data;
  },
};

export default instantBookAPI;
