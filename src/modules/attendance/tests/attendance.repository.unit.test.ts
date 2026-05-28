import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceStatus, AttendanceType, SyncStatus } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AttendanceRepository } from '../attendance.repository';

describe('AttendanceRepository', () => {
  let repository: AttendanceRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockRecord = {
    id: 'cuid_att_001',
    memberId: 'cuid_member_001',
    scheduleId: 'cuid_sched_001',
    eventId: null,
    type: AttendanceType.SCHEDULE,
    status: AttendanceStatus.PRESENT,
    date: new Date('2026-01-15'),
    markedById: 'cuid_admin_001',
    isOffline: false,
    syncStatus: SyncStatus.SYNCED,
    syncedAt: null,
    notes: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
  };

  beforeEach(async () => {
    const prismaMock = {
      attendance: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        createMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceRepository,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    repository = module.get<AttendanceRepository>(AttendanceRepository);
    prisma = module.get(PrismaService) as unknown as jest.Mocked<PrismaService>;
  });

  describe('findById', () => {
    it('returns the record when found', async () => {
      (prisma.attendance.findUnique as jest.Mock).mockResolvedValue(mockRecord);

      const result = await repository.findById('cuid_att_001');

      expect(result).toEqual(mockRecord);
      expect(prisma.attendance.findUnique).toHaveBeenCalledWith({
        where: { id: 'cuid_att_001' },
      });
    });

    it('returns null when not found', async () => {
      (prisma.attendance.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById('ghost');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns records with default ordering', async () => {
      (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockRecord]);

      const result = await repository.list({}, { skip: 0, take: 20 });

      expect(result).toEqual([mockRecord]);
      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { date: 'desc' },
        }),
      );
    });

    it('applies memberId filter', async () => {
      (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockRecord]);

      await repository.list(
        { memberId: 'cuid_member_001' },
        { skip: 0, take: 20 },
      );

      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ memberId: 'cuid_member_001' }),
        }),
      );
    });

    it('applies type and status filters', async () => {
      (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockRecord]);

      await repository.list(
        { type: AttendanceType.EVENT, status: AttendanceStatus.ABSENT },
        { skip: 0, take: 20 },
      );

      expect(prisma.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: AttendanceType.EVENT,
            status: AttendanceStatus.ABSENT,
          }),
        }),
      );
    });

    it('applies date range filter', async () => {
      (prisma.attendance.findMany as jest.Mock).mockResolvedValue([mockRecord]);

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      await repository.list({ from, to }, { skip: 0, take: 20 });

      const callArgs = (prisma.attendance.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.where.date.gte).toEqual(from);
      expect(callArgs.where.date.lte).toEqual(to);
    });
  });

  describe('count', () => {
    it('counts records matching the filter', async () => {
      (prisma.attendance.count as jest.Mock).mockResolvedValue(7);

      const result = await repository.count({ memberId: 'cuid_member_001' });

      expect(result).toBe(7);
    });
  });

  describe('create', () => {
    it('creates a record with the given data', async () => {
      (prisma.attendance.create as jest.Mock).mockResolvedValue(mockRecord);

      const result = await repository.create({
        memberId: 'cuid_member_001',
        type: AttendanceType.SCHEDULE,
        status: AttendanceStatus.PRESENT,
        date: new Date('2026-01-15'),
        markedById: 'cuid_admin_001',
      });

      expect(result).toEqual(mockRecord);
      expect(prisma.attendance.create).toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    it('creates many records in a transaction', async () => {
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        mockRecord,
        mockRecord,
      ]);

      const records = [
        {
          memberId: 'cuid_member_001',
          type: AttendanceType.SCHEDULE,
          status: AttendanceStatus.PRESENT,
          date: new Date('2026-01-15'),
          markedById: 'cuid_admin_001',
        },
        {
          memberId: 'cuid_member_002',
          type: AttendanceType.SCHEDULE,
          status: AttendanceStatus.ABSENT,
          date: new Date('2026-01-15'),
          markedById: 'cuid_admin_001',
        },
      ];

      const result = await repository.createMany(records);

      expect(result).toHaveLength(2);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates a record by id', async () => {
      const updated = { ...mockRecord, status: AttendanceStatus.LATE };
      (prisma.attendance.update as jest.Mock).mockResolvedValue(updated);

      const result = await repository.update('cuid_att_001', {
        status: AttendanceStatus.LATE,
      });

      expect(result.status).toBe(AttendanceStatus.LATE);
      expect(prisma.attendance.update).toHaveBeenCalledWith({
        where: { id: 'cuid_att_001' },
        data: { status: AttendanceStatus.LATE },
      });
    });
  });

  describe('delete', () => {
    it('deletes a record by id', async () => {
      (prisma.attendance.delete as jest.Mock).mockResolvedValue(mockRecord);

      const result = await repository.delete('cuid_att_001');

      expect(result).toEqual(mockRecord);
      expect(prisma.attendance.delete).toHaveBeenCalledWith({
        where: { id: 'cuid_att_001' },
      });
    });
  });
});
