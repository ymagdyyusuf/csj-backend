import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { BCRYPT_COST_FACTOR } from '../auth.types';

/**
 * Unit tests for AuthService.
 *
 * BATCH 1: Password helpers (hashPassword, verifyPassword).
 * BATCH 2: register() and validateUser() — coming next.
 * BATCH 3: login() and refresh() — coming after that.
 */
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ============================================================
  // BATCH 1: Password Helpers
  // ============================================================

  describe('hashPassword', () => {
    it('produces a bcrypt hash from a plaintext password', async () => {
      const plain = 'mySecurePass123';

      const hash = await service.hashPassword(plain);

      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(hash).toContain(`$${BCRYPT_COST_FACTOR}$`);
      expect(hash).toHaveLength(60);
    });

    it('produces different hashes for the same password (salt randomization)', async () => {
      const plain = 'samePassword';

      const hash1 = await service.hashPassword(plain);
      const hash2 = await service.hashPassword(plain);

      expect(hash1).not.toEqual(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for a matching password', async () => {
      const plain = 'correctPassword';
      const hash = await service.hashPassword(plain);

      const result = await service.verifyPassword(plain, hash);

      expect(result).toBe(true);
    });

    it('returns false for a non-matching password', async () => {
      const correctPlain = 'correctPassword';
      const wrongPlain = 'wrongPassword';
      const hash = await service.hashPassword(correctPlain);

      const result = await service.verifyPassword(wrongPlain, hash);

      expect(result).toBe(false);
    });

    it('returns false for a malformed hash', async () => {
      const plain = 'anyPassword';
      const malformedHash = 'this-is-not-a-bcrypt-hash';

      const result = await service.verifyPassword(plain, malformedHash);

      expect(result).toBe(false);
    });
  });
});
