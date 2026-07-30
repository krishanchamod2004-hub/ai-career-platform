import { UserRole } from '@ai-career/shared';

/** Shape encoded in the access token JWT payload. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}

/** Attached to Request.user by JwtStrategy after successful validation. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
