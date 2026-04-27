import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AuthRepository } from '../auth.repository';

/**
 * Unit tests for AuthRepository.
 *
 * Strategy: We mock PrismaService so tests run instantly without hitting
 * the real database. Each test verifies the repository calls Prisma
 * with the right arguments and returns the right shape.
 *
 * Coverage target: 70% (per the spec's repository test rules).
 */
describe('AuthRepository', () => {
  let repository: AuthRepository;
  let prisma: jest.Mocked<PrismaService>;

  // A reusable fake user for tests. Matches the Prisma User shape.
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
    // Create a fully mocked PrismaService. Each `user.X` method is a Jest mock.
    const prismaMock = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepository,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    repository = module.get<AuthRepository>(AuthRepository);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  // ============================================================
  // findById
  // ============================================================
  describe('findById', () => {
    it('returns the user when found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await repository.findById('cuid_test_001');

      // Assert
      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'cuid_test_001' },
      });
    });

    it('returns null when no user matches', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // findByUsername
  // ============================================================
  describe('findByUsername', () => {
    it('returns the user when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.findByUsername('ahmed_scout');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'ahmed_scout' },
      });
    });

    it('returns null when no user matches', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByUsername('ghost_user');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // findByPhone
  // ============================================================
  describe('findByPhone', () => {
    it('returns the user when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.findByPhone('+201234567890');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+201234567890' },
      });
    });

    it('returns null when no user matches', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByPhone('+209999999999');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // findByIdentifier (login flow: tries username, then phone)
  // ============================================================
  describe('findByIdentifier', () => {
    it('returns the user when username matches', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.findByIdentifier('ahmed_scout');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ username: 'ahmed_scout' }, { phone: 'ahmed_scout' }],
        },
      });
    });

    it('returns the user when phone matches', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.findByIdentifier('+201234567890');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ username: '+201234567890' }, { phone: '+201234567890' }],
        },
      });
    });

    it('returns null when neither matches', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByIdentifier('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    it('creates a user with the provided data and returns the new record', async () => {
      const createInput = {
        uniqueId: 'CSJ-002',
        username: 'fatima_scout',
        phone: '+201234567891',
        passwordHash: '$2b$12$anotherhash',
        role: Role.MEMBER,
        qrCode: 'qr_test_002',
        language: 'ar',
      };

      const createdUser = {
        ...mockUser,
        ...createInput,
        id: 'cuid_test_002',
      };

      (prisma.user.create as jest.Mock).mockResolvedValue(createdUser);

      const result = await repository.create(createInput);

      expect(result).toEqual(createdUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: createInput,
      });
    });

    it('defaults role to MEMBER when not provided', async () => {
      const createInput = {
        uniqueId: 'CSJ-003',
        username: 'omar_scout',
        phone: '+201234567892',
        passwordHash: '$2b$12$thirdhash',
        qrCode: 'qr_test_003',
        language: 'ar',
      };

      const createdUser = {
        ...mockUser,
        ...createInput,
        id: 'cuid_test_003',
        role: Role.MEMBER,
      };

      (prisma.user.create as jest.Mock).mockResolvedValue(createdUser);

      await repository.create(createInput);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { ...createInput, role: Role.MEMBER },
      });
    });
  });

  // ============================================================
  // updatePasswordHash
  // ============================================================
  describe('updatePasswordHash', () => {
    it('updates the password hash and returns the updated user', async () => {
      const newHash = '$2b$12$brandnewhash';
      const updatedUser = { ...mockUser, passwordHash: newHash };

      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await repository.updatePasswordHash('cuid_test_001', newHash);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid_test_001' },
        data: { passwordHash: newHash },
      });
    });
  });

  // ============================================================
  // setActive
  // ============================================================
  describe('setActive', () => {
    it('disables the user when isActive is false', async () => {
      const disabledUser = { ...mockUser, isActive: false };
      (prisma.user.update as jest.Mock).mockResolvedValue(disabledUser);

      const result = await repository.setActive('cuid_test_001', false);

      expect(result.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid_test_001' },
        data: { isActive: false },
      });
    });

    it('enables the user when isActive is true', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await repository.setActive('cuid_test_001', true);

      expect(result.isActive).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid_test_001' },
        data: { isActive: true },
      });
    });
  });
});
