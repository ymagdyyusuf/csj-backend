import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { LocationRepository } from '../location.repository';

describe('LocationRepository', () => {
  let repository: LocationRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockLog = {
    id: 'cuid_loc_001',
    memberId: 'cuid_member_001',
    latitude: 30.0444,
    longitude: 31.2357,
    accuracy: 8.5,
    recordedAt: new Date('2026-01-15T10:00:00Z'),
  };

  beforeEach(async () => {
    const prismaMock = {
      locationLog: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repository = module.get<LocationRepository>(LocationRepository);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  describe('findById', () => {
    it('returns the log when found', async () => {
      (prisma.locationLog.findUnique as jest.Mock).mockResolvedValue(mockLog);

      const result = await repository.findById('cuid_loc_001');

      expect(result).toEqual(mockLog);
      expect(prisma.locationLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'cuid_loc_001' },
      });
    });

    it('returns null when not found', async () => {
      (prisma.locationLog.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('ghost');

      expect(result).toBeNull();
    });
  });

  describe('findMostRecentByMember', () => {
    it('returns the most recent log for a member', async () => {
      (prisma.locationLog.findFirst as jest.Mock).mockResolvedValue(mockLog);

      const result = await repository.findMostRecentByMember('cuid_member_001');

      expect(result).toEqual(mockLog);
      expect(prisma.locationLog.findFirst).toHaveBeenCalledWith({
        where: { memberId: 'cuid_member_001' },
        orderBy: { recordedAt: 'desc' },
      });
    });

    it('returns null when the member has no logs', async () => {
      (prisma.locationLog.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repository.findMostRecentByMember('cuid_member_002');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns logs newest first', async () => {
      (prisma.locationLog.findMany as jest.Mock).mockResolvedValue([mockLog]);

      const result = await repository.list({}, { skip: 0, take: 20 });

      expect(result).toEqual([mockLog]);
      expect(prisma.locationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { recordedAt: 'desc' },
        }),
      );
    });

    it('applies memberId filter', async () => {
      (prisma.locationLog.findMany as jest.Mock).mockResolvedValue([mockLog]);

      await repository.list(
        { memberId: 'cuid_member_001' },
        { skip: 0, take: 20 },
      );

      expect(prisma.locationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ memberId: 'cuid_member_001' }),
        }),
      );
    });

    it('applies date range filter', async () => {
      (prisma.locationLog.findMany as jest.Mock).mockResolvedValue([mockLog]);

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      await repository.list({ from, to }, { skip: 0, take: 20 });

      const callArgs = (prisma.locationLog.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.recordedAt.gte).toEqual(from);
      expect(callArgs.where.recordedAt.lte).toEqual(to);
    });
  });

  describe('count', () => {
    it('counts logs matching the filter', async () => {
      (prisma.locationLog.count as jest.Mock).mockResolvedValue(42);

      const result = await repository.count({ memberId: 'cuid_member_001' });

      expect(result).toBe(42);
    });
  });

  describe('findCurrentForAllMembers', () => {
    it('returns the latest log per member', async () => {
      // For each member's latest row - we expect a raw query result
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([mockLog]);

      const result = await repository.findCurrentForAllMembers();

      expect(result).toHaveLength(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a log', async () => {
      (prisma.locationLog.create as jest.Mock).mockResolvedValue(mockLog);

      const result = await repository.create({
        memberId: 'cuid_member_001',
        latitude: 30.0444,
        longitude: 31.2357,
        accuracy: 8.5,
      });

      expect(result).toEqual(mockLog);
      expect(prisma.locationLog.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a log by id', async () => {
      (prisma.locationLog.delete as jest.Mock).mockResolvedValue(mockLog);

      const result = await repository.delete('cuid_loc_001');

      expect(result).toEqual(mockLog);
      expect(prisma.locationLog.delete).toHaveBeenCalledWith({
        where: { id: 'cuid_loc_001' },
      });
    });
  });
});
