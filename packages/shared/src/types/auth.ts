import { User } from './user';

/**
 * Auth DTOs shared between API (request validation) and Web/Mobile (form typing).
 * The API layer additionally decorates these with class-validator decorators
 * in apps/api/src/modules/auth/dto — those DTOs implement these interfaces.
 */

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface VerifyEmailDto {
  token: string;
}

/**
 * Response returned on successful login/register/refresh.
 * The refresh token itself is never included in the JSON body —
 * it is set as an httpOnly cookie by the API.
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface MessageResponse {
  message: string;
}
