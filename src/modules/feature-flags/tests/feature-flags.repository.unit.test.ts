import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { FeatureFlagsRepository } from '../feature-flags.repository';

describe('FeatureFlagsRepository', () => {
  let repository: FeatureFlagsRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockFlag = {
    id: 'cuid_flag_001',
    key: 'messaging',
    isEnabled: true,
    description: 'In-app messaging feature',
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const prismaMock = {
      featureFlag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repository = module.get<FeatureFlagsRepository>(FeatureFlagsRepository);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  describe('findAll', () => {
    it('returns all flags ordered by key', async () => {
      (prisma.featureFlag.findMany as jest.Mock).mockResolvedValue([mockFlag]);

      const result = await repository.findAll();

      expect(result).toEqual([mockFlag]);
      expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('findByKey', () => {
    it('returns the flag when found', async () => {
      (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(mockFlag);

      const result = await repository.findByKey('messaging');

      expect(result).toEqual(mockFlag);
      expect(prisma.featureFlag.findUnique).toHaveBeenCalledWith({
        where: { key: 'messaging' },
      });
    });

    it('returns null when no flag matches', async () => {
      (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByKey('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a flag with the given data', async () => {
      (prisma.featureFlag.create as jest.Mock).mockResolvedValue(mockFlag);

      const result = await repository.create({
        key: 'messaging',
        isEnabled: true,
        description: 'In-app messaging feature',
      });

      expect(result).toEqual(mockFlag);
      expect(prisma.featureFlag.create).toHaveBeenCalledWith({
        data: {
          key: 'messaging',
          isEnabled: true,
          description: 'In-app messaging feature',
        },
      });
    });
  });

  describe('update', () => {
    it('updates a flag by key', async () => {
      const updated = { ...mockFlag, isEnabled: false };
      (prisma.featureFlag.update as jest.Mock).mockResolvedValue(updated);

      const result = await repository.update('messaging', { isEnabled: false });

      expect(result).toEqual(updated);
      expect(prisma.featureFlag.update).toHaveBeenCalledWith({
        where: { key: 'messaging' },
        data: { isEnabled: false },
      });
    });
  });

  describe('delete', () => {
    it('deletes a flag by key', async () => {
      (prisma.featureFlag.delete as jest.Mock).mockResolvedValue(mockFlag);

      const result = await repository.delete('messaging');

      expect(result).toEqual(mockFlag);
      expect(prisma.featureFlag.delete).toHaveBeenCalledWith({
        where: { key: 'messaging' },
      });
    });
  });
});
