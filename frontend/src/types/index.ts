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
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  isAvailable: boolean;
  isVirtualTrainingAvailable?: boolean;
  videoCallPreference?: string;
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
  'Functional Fitness (55+)',
  'Mobility',
  'Sports Training',
  'Cardio',
  'Yoga',
  'Pilates',
  'CrossFit',
  'Bodybuilding',
];

export const TrainingStyleDescriptions: { [key: string]: string } = {
  'Strength Training': 'Build muscle and increase power through resistance exercises',
  'Weight Loss': 'Burn calories and shed fat with targeted workouts',
  'HIIT': 'High-Intensity Interval Training for maximum calorie burn in minimal time',
  'Boxing': 'Combat sport training for fitness, agility, and self-defense',
  'Functional Training': 'Movement-based exercises that improve daily activities',
  'Functional Fitness (55+)': 'Age-appropriate exercises focusing on balance, mobility, and strength for active aging',
  'Mobility': 'Improve flexibility, joint health, and range of motion',
  'Sports Training': 'Sport-specific conditioning and performance enhancement',
  'Cardio': 'Improve heart health and endurance through aerobic exercise',
  'Yoga': 'Mind-body practice combining poses, breathing, and meditation',
  'Pilates': 'Core-focused exercises for strength, flexibility, and posture',
  'CrossFit': 'Varied high-intensity workouts combining multiple fitness disciplines',
  'Bodybuilding': 'Muscle hypertrophy and aesthetic physique development',
};
