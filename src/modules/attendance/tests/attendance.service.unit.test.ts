import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  AttendanceType,
  Role,
  SyncStatus,
} from '@prisma/client';
import { AttendanceService } from '../attendance.service';
import { AttendanceRepository } from '../attendance.repository';
import { MembersRepository } from '../../members/members.repository';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let attendanceRepo: jest.Mocked<AttendanceRepository>;
  let membersRepo: jest.Mocked<MembersRepository>;

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

  const mockMember = {
    id: 'cuid_member_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    passwordHash: 'hash',
    role: Role.MEMBER,
    isActive: true,
    qrCode: 'qr',
    avatarUrl: null,
    language: 'ar',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const memberUser: AuthenticatedUser = {
    id: 'cuid_member_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    role: Role.MEMBER,
    isActive: true,
    language: 'ar',
  };

  const otherMemberUser: AuthenticatedUser = {
    ...memberUser,
    id: 'cuid_other_999',
  };

  const adminUser: AuthenticatedUser = {
    ...memberUser,
    id: 'cuid_admin_001',
    username: 'admin_boss',
    role: Role.ADMIN,
  };

  beforeEach(async () => {
    const attendanceRepoMock = {
      findById: jest.fn(),
      list: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const membersRepoMock = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceRepository, useValue: attendanceRepoMock },
        { provide: MembersRepository, useValue: membersRepoMock },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    attendanceRepo = module.get(
      AttendanceRepository,
    ) as unknown as jest.Mocked<AttendanceRepository>;
    membersRepo = module.get(
      MembersRepository,
    ) as unknown as jest.Mocked<MembersRepository>;
  });

  // ============================================================
  // create (single)
  // ============================================================
  describe('create', () => {
    const dto = {
      memberId: 'cuid_member_001',
      type: AttendanceType.SCHEDULE,
      status: AttendanceStatus.PRESENT,
      date: '2026-01-15T00:00:00.000Z',
    };

    it('allows an admin to create a record', async () => {
      membersRepo.findById.mockResolvedValue(mockMember);
      attendanceRepo.create.mockResolvedValue(mockRecord);

      const result = await service.create(dto, adminUser);

      expect(result.id).toBe('cuid_att_001');
      // markedById should be set from the current user
      expect(attendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ markedById: 'cuid_admin_001' }),
      );
    });

    it('forbids a member from creating a record', async () => {
      await expect(service.create(dto, memberUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(attendanceRepo.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when member does not exist', async () => {
      membersRepo.findById.mockResolvedValue(null);

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(attendanceRepo.create).not.toHaveBeenCalled();
    });

    it('converts the ISO date string to a Date', async () => {
      membersRepo.findById.mockResolvedValue(mockMember);
      attendanceRepo.create.mockResolvedValue(mockRecord);

      await service.create(dto, adminUser);

      const callArg = attendanceRepo.create.mock.calls[0][0];
      expect(callArg.date).toBeInstanceOf(Date);
    });
  });

  // ============================================================
  // createBulk
  // ============================================================
  describe('createBulk', () => {
    const bulkDto = {
      records: [
        {
          memberId: 'cuid_member_001',
          type: AttendanceType.SCHEDULE,
          status: AttendanceStatus.PRESENT,
          date: '2026-01-15T00:00:00.000Z',
        },
        {
          memberId: 'cuid_member_002',
          type: AttendanceType.SCHEDULE,
          status: AttendanceStatus.ABSENT,
          date: '2026-01-15T00:00:00.000Z',
        },
      ],
    };

    it('allows an admin to bulk-create when all members exist', async () => {
      membersRepo.findById.mockResolvedValue(mockMember);
      attendanceRepo.createMany.mockResolvedValue([mockRecord, mockRecord]);

      const result = await service.createBulk(bulkDto, adminUser);

      expect(result).toHaveLength(2);
      expect(attendanceRepo.createMany).toHaveBeenCalled();
    });

    it('forbids a member from bulk-creating', async () => {
      await expect(service.createBulk(bulkDto, memberUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if ANY member is missing (all-or-nothing)', async () => {
      // First member exists, second does not
      membersRepo.findById
        .mockResolvedValueOnce(mockMember)
        .mockResolvedValueOnce(null);

      await expect(service.createBulk(bulkDto, adminUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(attendanceRepo.createMany).not.toHaveBeenCalled();
    });

    it('rejects an empty batch', async () => {
      await expect(
        service.createBulk({ records: [] }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    it('allows admin to list all records', async () => {
      attendanceRepo.list.mockResolvedValue([mockRecord]);
      attendanceRepo.count.mockResolvedValue(1);

      const result = await service.list({}, adminUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('forces a member to only see their OWN records', async () => {
      attendanceRepo.list.mockResolvedValue([mockRecord]);
      attendanceRepo.count.mockResolvedValue(1);

      await service.list({ memberId: 'cuid_other_999' }, memberUser);

      // Service must override memberId with the requesting member's id
      const listFilter = attendanceRepo.list.mock.calls[0][0];
      expect(listFilter.memberId).toBe('cuid_member_001');
    });

    it('computes pagination metadata', async () => {
      attendanceRepo.list.mockResolvedValue([mockRecord]);
      attendanceRepo.count.mockResolvedValue(50);

      const result = await service.list({ page: 2, pageSize: 20 }, adminUser);

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });
  });

  // ============================================================
  // getById
  // ============================================================
  describe('getById', () => {
    it('allows a member to get their OWN record', async () => {
      attendanceRepo.findById.mockResolvedValue(mockRecord);

      const result = await service.getById('cuid_att_001', memberUser);

      expect(result.id).toBe('cuid_att_001');
    });

    it('forbids a member from getting ANOTHER member record', async () => {
      attendanceRepo.findById.mockResolvedValue(mockRecord);

      await expect(
        service.getById('cuid_att_001', otherMemberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an admin to get any record', async () => {
      attendanceRepo.findById.mockResolvedValue(mockRecord);

      const result = await service.getById('cuid_att_001', adminUser);

      expect(result.id).toBe('cuid_att_001');
    });

    it('throws NotFoundException when record is missing', async () => {
      attendanceRepo.findById.mockResolvedValue(null);

      await expect(service.getById('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // update
  // ============================================================
  describe('update', () => {
    it('allows an admin to update a record', async () => {
      attendanceRepo.findById.mockResolvedValue(mockRecord);
      attendanceRepo.update.mockResolvedValue({
        ...mockRecord,
        status: AttendanceStatus.LATE,
      });

      const result = await service.update(
        'cuid_att_001',
        { status: AttendanceStatus.LATE },
        adminUser,
      );

      expect(result.status).toBe(AttendanceStatus.LATE);
    });

    it('forbids a member from updating a record', async () => {
      await expect(
        service.update(
          'cuid_att_001',
          { status: AttendanceStatus.LATE },
          memberUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when updating a missing record', async () => {
      attendanceRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('ghost', { status: AttendanceStatus.LATE }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // delete
  // ============================================================
  describe('delete', () => {
    it('allows an admin to delete a record', async () => {
      attendanceRepo.findById.mockResolvedValue(mockRecord);
      attendanceRepo.delete.mockResolvedValue(mockRecord);

      await expect(
        service.delete('cuid_att_001', adminUser),
      ).resolves.not.toThrow();
    });

    it('forbids a member from deleting a record', async () => {
      await expect(service.delete('cuid_att_001', memberUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when deleting a missing record', async () => {
      attendanceRepo.findById.mockResolvedValue(null);

      await expect(service.delete('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
