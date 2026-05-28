import { Test, TestingModule } from '@nestjs/testing';
import {
  AttendanceStatus,
  AttendanceType,
  Role,
  SyncStatus,
} from '@prisma/client';
import { AttendanceController } from '../attendance.controller';
import { AttendanceService } from '../attendance.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  let service: jest.Mocked<AttendanceService>;

  const adminUser: AuthenticatedUser = {
    id: 'cuid_admin_001',
    uniqueId: 'CSJ-ADM',
    username: 'admin_boss',
    phone: '+201000000000',
    role: Role.ADMIN,
    isActive: true,
    language: 'ar',
  };

  const mockView = {
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
  };

  const mockPaginated = {
    items: [mockView],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    const serviceMock = {
      create: jest.fn(),
      createBulk: jest.fn(),
      list: jest.fn(),
      getById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: serviceMock }],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
    service = module.get(
      AttendanceService,
    ) as unknown as jest.Mocked<AttendanceService>;
  });

  describe('create', () => {
    it('creates a record wrapped in { attendance }', async () => {
      service.create.mockResolvedValue(mockView);

      const dto = {
        memberId: 'cuid_member_001',
        type: AttendanceType.SCHEDULE,
        status: AttendanceStatus.PRESENT,
        date: '2026-01-15T00:00:00.000Z',
      };
      const result = await controller.create(dto, adminUser);

      expect(result.attendance.id).toBe('cuid_att_001');
      expect(service.create).toHaveBeenCalledWith(dto, adminUser);
    });
  });

  describe('createBulk', () => {
    it('bulk-creates and returns { attendance, count }', async () => {
      service.createBulk.mockResolvedValue([mockView, mockView]);

      const dto = {
        records: [
          {
            memberId: 'cuid_member_001',
            type: AttendanceType.SCHEDULE,
            status: AttendanceStatus.PRESENT,
            date: '2026-01-15T00:00:00.000Z',
          },
        ],
      };
      const result = await controller.createBulk(dto, adminUser);

      expect(result.count).toBe(2);
      expect(result.attendance).toHaveLength(2);
      expect(service.createBulk).toHaveBeenCalledWith(dto, adminUser);
    });
  });

  describe('list', () => {
    it('returns paginated records', async () => {
      service.list.mockResolvedValue(mockPaginated);

      const result = await controller.list({}, adminUser);

      expect(result.items).toHaveLength(1);
      expect(service.list).toHaveBeenCalledWith({}, adminUser);
    });
  });

  describe('getById', () => {
    it('returns a single record wrapped in { attendance }', async () => {
      service.getById.mockResolvedValue(mockView);

      const result = await controller.getById('cuid_att_001', adminUser);

      expect(result.attendance.id).toBe('cuid_att_001');
      expect(service.getById).toHaveBeenCalledWith('cuid_att_001', adminUser);
    });
  });

  describe('update', () => {
    it('updates a record wrapped in { attendance }', async () => {
      const updated = { ...mockView, status: AttendanceStatus.LATE };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        'cuid_att_001',
        { status: AttendanceStatus.LATE },
        adminUser,
      );

      expect(result.attendance.status).toBe(AttendanceStatus.LATE);
      expect(service.update).toHaveBeenCalledWith(
        'cuid_att_001',
        { status: AttendanceStatus.LATE },
        adminUser,
      );
    });
  });

  describe('delete', () => {
    it('deletes a record', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('cuid_att_001', adminUser);

      expect(service.delete).toHaveBeenCalledWith('cuid_att_001', adminUser);
    });
  });
});
