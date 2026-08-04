import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, UserRole, type AuthResponse, type User as SharedUser } from '@ai-career/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { TokenUtilService } from './token-util.service';
import { GoogleProfile } from './strategies/google.strategy';

export interface RefreshTokenBundle {
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly tokenUtil: TokenUtilService,
  ) {
    this.refreshTokenTtlDays = Number(this.config.get<string>('REFRESH_TOKEN_TTL_DAYS', '30'));
  }

  private toSharedUser(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    authProvider: string;
    isEmailVerified: boolean;
    avatarUrl: string | null;
    hasCompletedOnboarding?: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): SharedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      authProvider: user.authProvider as AuthProvider,
      isEmailVerified: user.isEmailVerified,
      avatarUrl: user.avatarUrl,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private signAccessToken(payload: JwtPayload): { token: string; expiresAt: Date } {
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    const token = this.jwtService.sign(payload, { expiresIn });
    const decoded = this.jwtService.decode(token) as { exp: number };
    return { token, expiresAt: new Date(decoded.exp * 1000) };
  }

  private async createRefreshToken(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<RefreshTokenBundle> {
    const rawToken = this.tokenUtil.generateOpaqueToken();
    const tokenHash = this.tokenUtil.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, userAgent, ipAddress, expiresAt },
    });

    return { refreshToken: rawToken, expiresAt };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.tokenUtil.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async refresh(
    rawRefreshToken: string | undefined,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: RefreshTokenBundle }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = this.tokenUtil.hashToken(rawRefreshToken);
    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existingToken || existingToken.revokedAt || existingToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke the old token and issue a new one (mitigates replay attacks).
    await this.prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() },
    });

    const user = existingToken.user;
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role as UserRole };
    const { token, expiresAt } = this.signAccessToken(payload);
    const newRefreshToken = await this.createRefreshToken(user.id, context.userAgent, context.ipAddress);

    return {
      auth: {
        user: this.toSharedUser(user),
        accessToken: token,
        accessTokenExpiresAt: expiresAt.toISOString(),
      },
      refreshToken: newRefreshToken,
    };
  }

  async getMe(userId: string): Promise<SharedUser & { profile: unknown }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });
    return { ...this.toSharedUser(user), profile: user.profile };
  }

  /**
   * Find or create a user from Google OAuth profile.
   * - If googleId exists → return that user
   * - If email exists → link the Google account to existing user
   * - Otherwise → create a new user with GOOGLE provider
   */
  async findOrCreateGoogleUser(
    profile: GoogleProfile,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<{ auth: AuthResponse; refreshToken: RefreshTokenBundle }> {
    // Try to find by googleId first
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    // If not found by googleId, try by email
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        // User exists with this email, link Google account
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
            authProvider: AuthProvider.GOOGLE,
            isEmailVerified: true, // Google emails are always verified
            avatarUrl: profile.avatarUrl ?? user.avatarUrl,
          },
        });
      } else {
        // Create new user with Google provider
        user = await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
            authProvider: AuthProvider.GOOGLE,
            isEmailVerified: true, // Google emails are always verified
            avatarUrl: profile.avatarUrl,
            profile: { create: {} },
          },
        });
      }
    }

    // Generate tokens and return auth response
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role as UserRole };
    const { token, expiresAt } = this.signAccessToken(payload);
    const refreshToken = await this.createRefreshToken(user.id, context.userAgent, context.ipAddress);

    return {
      auth: {
        user: this.toSharedUser(user),
        accessToken: token,
        accessTokenExpiresAt: expiresAt.toISOString(),
      },
      refreshToken,
    };
  }
}
