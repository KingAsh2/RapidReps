// User Types
export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  roles: string[];
  isAdmin: boolean;
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// Trainer Profile Types
export interface TrainerProfile {
  id: string;
  userId: string;
  avatarUrl?: string;
  bio?: string;
  experienceYears: number;
  certifications: string[];
  trainingStyles: string[];
  gymsWorkedAt: string[];
  primaryGym?: string;
  offersInPerson: boolean;
  offersVirtual: boolean;
  sessionDurationsOffered: number[];
  ratePerMinuteCents: number;
  travelRadiusMiles?: number;
  cancellationPolicy?: string;
  averageRating: number;
  totalSessionsCompleted: number;
  isVerified: boolean;
  availability?: any;
  createdAt: string;
}

// Trainee Profile Types
export interface TraineeProfile {
  id: string;
  userId: string;
  avatarUrl?: string;
  fitnessGoals?: string;
  currentFitnessLevel: string;
  preferredTrainingStyles: string[];
  injuriesOrLimitations?: string;
  homeGymOrZipCode?: string;
  prefersInPerson: boolean;
  prefersVirtual: boolean;
  typicalAvailability?: any;
  budgetMinPerMinuteCents: number;
  budgetMaxPerMinuteCents: number;
  createdAt: string;
}

// Session Types
export interface Session {
  id: string;
  traineeId: string;
  trainerId: string;
  status: string;
  sessionDateTimeStart: string;
  sessionDateTimeEnd: string;
  durationMinutes: number;
  basePricePerMinuteCents: number;
  baseSessionPriceCents: number;
  discountType?: string;
  discountAmountCents: number;
  finalSessionPriceCents: number;
  platformFeePercent: number;
  platformFeeCents: number;
  trainerEarningsCents: number;
  locationType: string;
  locationNameOrAddress?: string;
  notes?: string;
  createdAt: string;
}

// Constants
export const UserRole = {
  TRAINER: 'trainer',
  TRAINEE: 'trainee',
  ADMIN: 'admin',
};

export const FitnessLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

export const SessionStatus = {
  REQUESTED: 'requested',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
};

export const TrainingStyles = [
  'Strength Training',
  'Weight Loss',
  'HIIT',
  'Boxing',
  'Functional Training',
  'Mobility',
  'Sports Training',
  'Cardio',
  'Yoga',
  'Pilates',
  'CrossFit',
  'Bodybuilding',
];
