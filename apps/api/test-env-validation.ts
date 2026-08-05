/**
 * Test to verify that the env validation fix allows Google OAuth vars through.
 * Run this to confirm the root cause is fixed.
 */

import 'reflect-metadata';
import { validateEnv } from './src/config/env.validation';

const testConfig = {
  DATABASE_URL: 'postgresql://postgres:password@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-key',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/auth/google/callback',
  WEB_URL: 'http://localhost:3000',
};

try {
  const validated = validateEnv(testConfig);
  
  console.log('✅ Validation passed!');
  console.log('\nValidated config includes:');
  console.log('- GOOGLE_CLIENT_ID:', validated.GOOGLE_CLIENT_ID);
  console.log('- GOOGLE_CLIENT_SECRET:', validated.GOOGLE_CLIENT_SECRET);
  console.log('- GOOGLE_CALLBACK_URL:', validated.GOOGLE_CALLBACK_URL);
  
  if (validated.GOOGLE_CLIENT_ID && 
      validated.GOOGLE_CLIENT_SECRET && 
      validated.GOOGLE_CALLBACK_URL) {
    console.log('\n✅ ROOT CAUSE FIXED: Google OAuth variables are now included in validated config');
    process.exit(0);
  } else {
    console.log('\n❌ BUG STILL EXISTS: Google OAuth variables are undefined after validation');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
