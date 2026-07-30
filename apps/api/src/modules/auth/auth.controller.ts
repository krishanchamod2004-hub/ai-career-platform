import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { REFRESH_TOKEN_COOKIE_NAME, type AuthResponse, type MessageResponse } from '@ai-career/shared';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import { GoogleProfile } from './strategies/google.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/api/auth',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/api/auth' });
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { auth, refreshToken } = await this.authService.register(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(res, refreshToken.refreshToken, refreshToken.expiresAt);
    return auth;
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { auth, refreshToken } = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(res, refreshToken.refreshToken, refreshToken.expiresAt);
    return auth;
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    const { auth, refreshToken } = await this.authService.refresh(currentRefreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(res, refreshToken.refreshToken, refreshToken.expiresAt);
    return auth;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and revoke the current refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponse> {
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    await this.authService.logout(currentRefreshToken);
    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully' };
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user with profile' })
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email address using a verification token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponse> {
    await this.authService.verifyEmail(dto);
    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend the email verification link' })
  async resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<MessageResponse> {
    await this.authService.resendVerification(user.id);
    return { message: 'Verification email sent' };
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email (placeholder mail service)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<MessageResponse> {
    await this.authService.forgotPassword(dto);
    return { message: 'If an account exists for this email, a reset link has been sent' };
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponse> {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successfully' };
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth 2.0 flow' })
  async googleAuth(): Promise<void> {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Handle Google OAuth 2.0 callback and redirect to frontend' })
  async googleAuthCallback(
    @Req() req: Request & { user: GoogleProfile },
    @Res() res: Response,
  ): Promise<void> {
    const { auth, refreshToken } = await this.authService.findOrCreateGoogleUser(req.user, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Set refresh token in httpOnly cookie
    this.setRefreshCookie(res, refreshToken.refreshToken, refreshToken.expiresAt);

    // Redirect to frontend dashboard with access token in query
    // The frontend will extract it and store in memory/localStorage
    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
    const redirectUrl = `${webUrl}/dashboard?accessToken=${encodeURIComponent(auth.accessToken)}`;
    
    res.redirect(redirectUrl);
  }
}
