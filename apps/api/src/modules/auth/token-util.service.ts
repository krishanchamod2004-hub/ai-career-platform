import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

/**
 * Utility for generating opaque, cryptographically random tokens (refresh tokens,
 * email verification tokens, password reset tokens) and hashing them for storage.
 * We never store raw tokens in the DB — only their SHA-256 hash — so a DB leak
 * does not expose usable tokens.
 */
@Injectable()
export class TokenUtilService {
  generateOpaqueToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
