import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { BCRYPT_COST_FACTOR } from '../auth.types';
import { AuthEventNames } from '../auth.events';

/**
 * Unit tests for AuthService — full coverage.
 *
 * BATCH 1: Password helpers (5 tests)
 * BATCH 2: register, validateUser (11 tests)
 * BATCH 3: login, refresh (adding now)
 */
describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<AuthRepository>;
  let eventBus: jest.Mocked<EventBusService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'cuid_test_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    passwordHash: '$2b$12$fakehashfakehashfakehashfakehas',
    role: Role.MEMBER,
    isActive: true,
    qrCode: 'qr_test_001',
    avatarUrl: null,
    language: 'ar',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

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
    const eventBusMock = { emit: jest.fn(), on: jest.fn() };
    const jwtServiceMock = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };
    const configServiceMock = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-jwt-secret',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repositoryMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repository = module.get(
      AuthRepository,
    ) as unknown as jest.Mocked<AuthRepository>;
    eventBus = module.get(
      EventBusService,
    ) as unknown as jest.Mocked<EventBusService>;
    jwtService = module.get(JwtService) as unknown as jest.Mocked<JwtService>;
  });

  // ============================================================
  // BATCH 1: Password Helpers (5 tests)
  // ============================================================

  describe('hashPassword', () => {
    it('produces a bcrypt hash', async () => {
      const hash = await service.hashPassword('mySecurePass123');
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(hash).toContain(`$${BCRYPT_COST_FACTOR}$`);
      expect(hash).toHaveLength(60);
    });
    it('produces different hashes for the same password', async () => {
      const h1 = await service.hashPassword('samePassword');
      const h2 = await service.hashPassword('samePassword');
      expect(h1).not.toEqual(h2);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password', async () => {
      const hash = await service.hashPassword('correctPassword');
      expect(await service.verifyPassword('correctPassword', hash)).toBe(true);
    });
    it('returns false for non-matching password', async () => {
      const hash = await service.hashPassword('correctPassword');
      expect(await service.verifyPassword('wrongPassword', hash)).toBe(false);
    });
    it('returns false for malformed hash', async () => {
      expect(await service.verifyPassword('any', 'not-a-bcrypt-hash')).toBe(
        false,
      );
    });
  });

  // ============================================================
  // BATCH 2: register
  // ============================================================

  describe('register', () => {
    const validDto = {
      username: 'new_scout',
      phone: '+201111111111',
      password: 'validPass123',
    };

    it('creates a new user when username and phone are unique', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        ...mockUser,
        username: validDto.username,
        phone: validDto.phone,
      });
      const result = await service.register(validDto);
      expect(result.username).toBe(validDto.username);
      expect(result.role).toBe(Role.MEMBER);
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it('always creates with role=MEMBER (security)', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      const dtoWithRole = { ...validDto, role: 'DEVELOPER' as never };
      await service.register(dtoWithRole);
      expect(repository.create.mock.calls[0][0].role).toBe(Role.MEMBER);
    });

    it('hashes the password before storage', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      await service.register(validDto);
      const createCall = repository.create.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe(validDto.password);
      expect(createCall.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it('rejects when username is already taken', async () => {
      repository.findByUsername.mockResolvedValue(mockUser);
      await expect(service.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects when phone is already taken', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(mockUser);
      await expect(service.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('emits UserRegisteredEvent on success', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      await service.register(validDto);
      expect(eventBus.emit).toHaveBeenCalledWith(
        AuthEventNames.USER_REGISTERED,
        expect.objectContaining({
          userId: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
        }),
      );
    });

    it('returns user view WITHOUT passwordHash', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      const result = await service.register(validDto);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('qrCode');
    });
  });

  // ============================================================
  // BATCH 2: validateUser
  // ============================================================

  describe('validateUser', () => {
    const validPayload = {
      sub: 'cuid_test_001',
      role: Role.MEMBER,
      username: 'ahmed_scout',
    };

    it('returns the user view when valid and active', async () => {
      repository.findById.mockResolvedValue(mockUser);
      const result = await service.validateUser(validPayload);
      expect(result.id).toBe(mockUser.id);
      expect(result.username).toBe(mockUser.username);
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.validateUser(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      repository.findById.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.validateUser(validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns user view WITHOUT passwordHash or qrCode', async () => {
      repository.findById.mockResolvedValue(mockUser);
      const result = await service.validateUser(validPayload);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('qrCode');
    });
  });

  // ============================================================
  // BATCH 3: login
  // ============================================================

  describe('login', () => {
    let testHash: string;

    beforeEach(async () => {
      // Pre-hash a known password for login tests
      testHash = await service.hashPassword('correctPassword');
      jwtService.signAsync.mockResolvedValue('mock.jwt.token');
    });

    it('returns tokens and user on successful login', async () => {
      const userWithRealHash = { ...mockUser, passwordHash: testHash };
      repository.findByIdentifier.mockResolvedValue(userWithRealHash);

      const result = await service.login({
        identifier: 'ahmed_scout',
        password: 'correctPassword',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toBe('mock.jwt.token');
      expect(result.user.username).toBe(mockUser.username);
    });

    it('throws UnauthorizedException when user not found', async () => {
      repository.findByIdentifier.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'ghost', password: 'anyPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const userWithRealHash = { ...mockUser, passwordHash: testHash };
      repository.findByIdentifier.mockResolvedValue(userWithRealHash);

      await expect(
        service.login({ identifier: 'ahmed_scout', password: 'wrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is disabled', async () => {
      const disabledUser = {
        ...mockUser,
        passwordHash: testHash,
        isActive: false,
      };
      repository.findByIdentifier.mockResolvedValue(disabledUser);

      await expect(
        service.login({
          identifier: 'ahmed_scout',
          password: 'correctPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('emits UserLoggedInEvent on successful login', async () => {
      const userWithRealHash = { ...mockUser, passwordHash: testHash };
      repository.findByIdentifier.mockResolvedValue(userWithRealHash);

      await service.login({
        identifier: 'ahmed_scout',
        password: 'correctPassword',
      });

      expect(eventBus.emit).toHaveBeenCalledWith(
        AuthEventNames.USER_LOGGED_IN,
        expect.objectContaining({
          userId: mockUser.id,
          username: mockUser.username,
        }),
      );
    });

    it('emits LoginFailedEvent on wrong password', async () => {
      const userWithRealHash = { ...mockUser, passwordHash: testHash };
      repository.findByIdentifier.mockResolvedValue(userWithRealHash);

      await service
        .login({ identifier: 'ahmed_scout', password: 'wrongPassword' })
        .catch(() => undefined);

      expect(eventBus.emit).toHaveBeenCalledWith(
        AuthEventNames.LOGIN_FAILED,
        expect.objectContaining({
          username: 'ahmed_scout',
          reason: 'WRONG_PASSWORD',
        }),
      );
    });

    it('returns user view WITHOUT passwordHash', async () => {
      const userWithRealHash = { ...mockUser, passwordHash: testHash };
      repository.findByIdentifier.mockResolvedValue(userWithRealHash);

      const result = await service.login({
        identifier: 'ahmed_scout',
        password: 'correctPassword',
      });

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('qrCode');
    });
  });

  // ============================================================
  // BATCH 3: refresh
  // ============================================================

  describe('refresh', () => {
    beforeEach(() => {
      jwtService.signAsync.mockResolvedValue('mock.new.token');
    });

    it('returns new tokens when refresh token is valid', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        tokenVersion: 0,
      });
      repository.findById.mockResolvedValue(mockUser);

      const result = await service.refresh('valid.refresh.token');

      expect(result.accessToken).toBe('mock.new.token');
      expect(result.refreshToken).toBe('mock.new.token');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('throws UnauthorizedException when refresh token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

      await expect(service.refresh('bad.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user no longer exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'deleted_user',
        tokenVersion: 0,
      });
      repository.findById.mockResolvedValue(null);

      await expect(service.refresh('valid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user account is disabled', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        tokenVersion: 0,
      });
      repository.findById.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.refresh('valid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('emits TokenRefreshedEvent on success', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: mockUser.id,
        tokenVersion: 0,
      });
      repository.findById.mockResolvedValue(mockUser);

      await service.refresh('valid.refresh.token');

      expect(eventBus.emit).toHaveBeenCalledWith(
        AuthEventNames.TOKEN_REFRESHED,
        expect.objectContaining({ userId: mockUser.id }),
      );
    });
  });
});
