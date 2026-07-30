import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, displayName, emails, photos } = profile;

    // Google always returns at least one email, and it's always verified
    const email = emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email found in Google profile'), undefined);
    }

    const googleProfile: GoogleProfile = {
      googleId: id,
      email,
      name: displayName || email.split('@')[0],
      avatarUrl: photos?.[0]?.value,
    };

    done(null, googleProfile);
  }
}
