import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { MembersRepository } from '../members.repository';

/**
 * Unit tests for MembersRepository.
 *
 * Strategy: Mock PrismaService. Test that repository calls Prisma
 * with the correct arguments and returns the correct shape.
 */
describe('MembersRepository', () => {
  let repository: MembersRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockMember = {
    id: 'cuid_member_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    passwordHash: '$2b$12$hashhashhashhashhashhashhashhashhash',
    role: Role.MEMBER,
    isActive: true,
    qrCode: 'qr_001',
    avatarUrl: null,
    language: 'ar',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repository = module.get<MembersRepository>(MembersRepository);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  describe('findById', () => {
    it('returns the member when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockMember);

      const result = await repository.findById('cuid_member_001');

      expect(result).toEqual(mockMember);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'cuid_member_001' },
      });
    });

    it('returns null when no member matches', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('returns the member when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockMember);

      const result = await repository.findByUsername('ahmed_scout');

      expect(result).toEqual(mockMember);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'ahmed_scout' },
      });
    });

    it('returns null when no match', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByUsername('ghost');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns members with default pagination', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockMember]);

      const result = await repository.list({}, { skip: 0, take: 20 });

      expect(result).toEqual([mockMember]);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('applies role filter when provided', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockMember]);

      await repository.list({ role: Role.MEMBER }, { skip: 0, take: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: Role.MEMBER }),
        }),
      );
    });

    it('applies isActive filter when provided', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockMember]);

      await repository.list({ isActive: true }, { skip: 0, take: 20 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('applies search filter to both username and phone', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockMember]);

      await repository.list({ search: 'ahmed' }, { skip: 0, take: 20 });

      const callArgs = (prisma.user.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
      expect(callArgs.where.OR).toHaveLength(2);
    });
  });

  describe('count', () => {
    it('counts members matching the filter', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(42);

      const result = await repository.count({ role: Role.MEMBER });

      expect(result).toBe(42);
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: Role.MEMBER }),
        }),
      );
    });

    it('counts all members when no filter', async () => {
      (prisma.user.count as jest.Mock).mockResolvedValue(100);

      const result = await repository.count({});

      expect(result).toBe(100);
    });
  });

  describe('update', () => {
    it('updates the member and returns the updated record', async () => {
      const updated = { ...mockMember, language: 'en' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updated);

      const result = await repository.update('cuid_member_001', {
        language: 'en',
      });

      expect(result).toEqual(updated);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid_member_001' },
        data: { language: 'en' },
      });
    });
  });
});
