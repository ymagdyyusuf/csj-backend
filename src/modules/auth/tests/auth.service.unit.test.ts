import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import { EventBusService } from '../../../shared/events/event-bus.service';
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
    const repositoryMock = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByPhone: jest.fn(),
      findByIdentifier: jest.fn(),
      create: jest.fn(),
      updatePasswordHash: jest.fn(),
      setActive: jest.fn(),
    };

    const jwtServiceMock = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const eventBusMock = {
      emit: jest.fn(),
      on: jest.fn(),
    };

    const configServiceMock = {
      get: jest.fn((key: string): string | undefined => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-jwt-secret-do-not-use-in-production',
          JWT_REFRESH_SECRET: 'test-refresh-secret-do-not-use-in-production',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repositoryMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
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