import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { BoqsRepository } from '../boqs.repository';

describe('BoqsRepository', () => {
  let repository: BoqsRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockBoqs = {
    id: 'cuid_boqs_001',
    audioUrl: 'https://res.cloudinary.com/csj/audio/boqs_001.mp3',
    text: 'Assembly in 5 minutes',
    duration: 12,
    sentById: 'cuid_admin_001',
    sentAt: new Date('2026-01-15T10:00:00Z'),
    deviceCount: 0,
  };

  beforeEach(async () => {
    const prismaMock = {
      boqs: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoqsRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repository = module.get<BoqsRepository>(BoqsRepository);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  describe('findById', () => {
    it('returns the broadcast when found', async () => {
      (prisma.boqs.findUnique as jest.Mock).mockResolvedValue(mockBoqs);

      const result = await repository.findById('cuid_boqs_001');

      expect(result).toEqual(mockBoqs);
      expect(prisma.boqs.findUnique).toHaveBeenCalledWith({
        where: { id: 'cuid_boqs_001' },
      });
    });

    it('returns null when not found', async () => {
      (prisma.boqs.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('ghost');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns broadcasts newest first', async () => {
      (prisma.boqs.findMany as jest.Mock).mockResolvedValue([mockBoqs]);

      const result = await repository.list({}, { skip: 0, take: 20 });

      expect(result).toEqual([mockBoqs]);
      expect(prisma.boqs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { sentAt: 'desc' },
        }),
      );
    });

    it('applies sentById filter', async () => {
      (prisma.boqs.findMany as jest.Mock).mockResolvedValue([mockBoqs]);

      await repository.list(
        { sentById: 'cuid_admin_001' },
        { skip: 0, take: 20 },
      );

      expect(prisma.boqs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sentById: 'cuid_admin_001' }),
        }),
      );
    });

    it('applies date range filter', async () => {
      (prisma.boqs.findMany as jest.Mock).mockResolvedValue([mockBoqs]);

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      await repository.list({ from, to }, { skip: 0, take: 20 });

      const callArgs = (prisma.boqs.findMany as jest.Mock).mock.calls[0][0];
      expect(callArgs.where.sentAt.gte).toEqual(from);
      expect(callArgs.where.sentAt.lte).toEqual(to);
    });
  });

  describe('count', () => {
    it('counts broadcasts matching the filter', async () => {
      (prisma.boqs.count as jest.Mock).mockResolvedValue(3);

      const result = await repository.count({ sentById: 'cuid_admin_001' });

      expect(result).toBe(3);
    });
  });

  describe('create', () => {
    it('creates a broadcast', async () => {
      (prisma.boqs.create as jest.Mock).mockResolvedValue(mockBoqs);

      const result = await repository.create({
        audioUrl: 'https://res.cloudinary.com/csj/audio/boqs_001.mp3',
        text: 'Assembly in 5 minutes',
        duration: 12,
        sentById: 'cuid_admin_001',
      });

      expect(result).toEqual(mockBoqs);
      expect(prisma.boqs.create).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a broadcast and returns the record', async () => {
      (prisma.boqs.delete as jest.Mock).mockResolvedValue(mockBoqs);

      const result = await repository.delete('cuid_boqs_001');

      expect(result).toEqual(mockBoqs);
      expect(prisma.boqs.delete).toHaveBeenCalledWith({
        where: { id: 'cuid_boqs_001' },
      });
    });
  });

  describe('incrementDeviceCount', () => {
    it('atomically increments deviceCount', async () => {
      const updated = { ...mockBoqs, deviceCount: 1 };
      (prisma.boqs.update as jest.Mock).mockResolvedValue(updated);

      const result = await repository.incrementDeviceCount('cuid_boqs_001');

      expect(result.deviceCount).toBe(1);
      expect(prisma.boqs.update).toHaveBeenCalledWith({
        where: { id: 'cuid_boqs_001' },
        data: { deviceCount: { increment: 1 } },
      });
    });
  });
});
