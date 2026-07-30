import { AuthProvider, UserRole } from '../enums';

/**
 * Canonical User shape returned by the API (never includes password hash).
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authProvider: AuthProvider;
  isEmailVerified: boolean;
  avatarUrl: string | null;
  hasCompletedOnboarding?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Extended user profile — career-specific data.
 */
export interface Profile {
  id: string;
  userId: string;
  headline: string | null;
  bio: string | null;
  skills: string[];
  yearsOfExperience: number | null;
  resumeUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  salaryExpectation: number | null;
  preferredLocations: string[];
  preferredJobTypes: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * User combined with their profile — common shape for "me" / dashboard endpoints.
 */
export interface UserWithProfile extends User {
  profile: Profile | null;
}
