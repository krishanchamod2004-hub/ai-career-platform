import { TokenUtilService } from '../src/modules/auth/token-util.service';

describe('TokenUtilService', () => {
  const service = new TokenUtilService();

  it('generates a hex token of the expected length', () => {
    const token = service.generateOpaqueToken(32);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces a deterministic SHA-256 hash for the same input', () => {
    const token = 'sample-token-value';
    expect(service.hashToken(token)).toBe(service.hashToken(token));
  });

  it('produces different hashes for different tokens', () => {
    expect(service.hashToken('token-a')).not.toBe(service.hashToken('token-b'));
  });
});
