import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BCRYPT_COST_FACTOR } from './auth.types';

/**
 * AuthService — the brain of authentication.
 *
 * Per Clean Architecture (Law 1):
 * - Service: Business logic only. Zero direct DB calls.
 * - All DB operations go through AuthRepository.
 *
 * BATCH 1 (CURRENT):    hashPassword, verifyPassword
 * BATCH 2 (PENDING):    register, validateUser
 *   — will inject AuthRepository, EventBusService
 * BATCH 3 (PENDING):    login, refresh
 *   — will inject JwtService, ConfigService
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ============================================================
  // PASSWORD HELPERS
  // ============================================================

  /**
   * Hash a plaintext password using bcrypt with cost factor 12.
   *
   * @param plain  Plaintext password (will be salted and hashed)
   * @returns The bcrypt hash string (60 characters)
   */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST_FACTOR);
  }

  /**
   * Verify a plaintext password against a stored bcrypt hash.
   *
   * Returns false (not throws) on malformed hashes — this prevents
   * denial-of-service attacks via bad input.
   *
   * @param plain  The plaintext password to check
   * @param hash   The stored bcrypt hash from the database
   * @returns true if the password matches, false otherwise
   */
  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plain, hash);
    } catch (error) {
      this.logger.warn(
        `Password verification failed: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
