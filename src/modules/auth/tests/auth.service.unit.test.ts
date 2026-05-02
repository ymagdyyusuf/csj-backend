import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from '../auth.service';
import { AuthRepository } from '../auth.repository';
import { EventBusService } from '../../../shared/events/event-bus.service';
import { BCRYPT_COST_FACTOR } from '../auth.types';
import { AuthEventNames } from '../auth.events';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<AuthRepository>;
  let eventBus: jest.Mocked<EventBusService>;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repositoryMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    repository = module.get(AuthRepository) as unknown as jest.Mocked<AuthRepository>;
    eventBus = module.get(EventBusService) as unknown as jest.Mocked<EventBusService>;
  });

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
      expect(await service.verifyPassword('any', 'not-a-bcrypt-hash')).toBe(false);
    });
  });

  describe('register', () => {
    const validDto = { username: 'new_scout', phone: '+201111111111', password: 'validPass123' };

    it('creates a new user when username and phone are unique', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(null);
      repository.create.mockResolvedValue({ ...mockUser, username: validDto.username, phone: validDto.phone });
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
      await expect(service.register(validDto)).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects when phone is already taken', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(mockUser);
      await expect(service.register(validDto)).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('emits UserRegisteredEvent on success', async () => {
      repository.findByUsername.mockResolvedValue(null);
      repository.findByPhone.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockUser);
      await service.register(validDto);
      expect(eventBus.emit).toHaveBeenCalledWith(
        AuthEventNames.USER_REGISTERED,
        expect.objectContaining({ userId: mockUser.id, username: mockUser.username, role: mockUser.role }),
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

  describe('validateUser', () => {
    const validPayload = { sub: 'cuid_test_001', role: Role.MEMBER, username: 'ahmed_scout' };

    it('returns the user view when valid and active', async () => {
      repository.findById.mockResolvedValue(mockUser);
      const result = await service.validateUser(validPayload);
      expect(result.id).toBe(mockUser.id);
      expect(result.username).toBe(mockUser.username);
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.validateUser(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      repository.findById.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.validateUser(validPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('returns user view WITHOUT passwordHash or qrCode', async () => {
      repository.findById.mockResolvedValue(mockUser);
      const result = await service.validateUser(validPayload);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('qrCode');
    });
  });
});
