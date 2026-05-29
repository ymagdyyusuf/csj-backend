import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { LocationService } from '../location.service';
import { LocationRepository } from '../location.repository';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('LocationService', () => {
  let service: LocationService;
  let repository: jest.Mocked<LocationRepository>;

  const mockLog = {
    id: 'cuid_loc_001',
    memberId: 'cuid_member_001',
    latitude: 30.0444,
    longitude: 31.2357,
    accuracy: 8.5,
    recordedAt: new Date('2026-01-15T10:00:00Z'),
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
    const repoMock = {
      findById: jest.fn(),
      findMostRecentByMember: jest.fn(),
      findCurrentForAllMembers: jest.fn(),
      list: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationService,
        { provide: LocationRepository, useValue: repoMock },
      ],
    }).compile();

    service = module.get<LocationService>(LocationService);
    repository = module.get(
      LocationRepository,
    ) as unknown as jest.Mocked<LocationRepository>;
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    const dto = {
      latitude: 30.0444,
      longitude: 31.2357,
      accuracy: 8.5,
    };

    it('creates a log when no recent ping exists', async () => {
      repository.findMostRecentByMember.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockLog);

      const result = await service.create(dto, memberUser);

      expect(result.id).toBe('cuid_loc_001');
      // memberId comes from the auth user
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: 'cuid_member_001' }),
      );
    });

    it('creates a log when the last ping is older than 60s', async () => {
      const oldLog = {
        ...mockLog,
        recordedAt: new Date(Date.now() - 120_000), // 2 minutes ago
      };
      repository.findMostRecentByMember.mockResolvedValue(oldLog);
      repository.create.mockResolvedValue(mockLog);

      const result = await service.create(dto, memberUser);

      expect(result.id).toBe('cuid_loc_001');
    });

    it('rejects when the last ping is less than 60s ago (429)', async () => {
      const recentLog = {
        ...mockLog,
        recordedAt: new Date(Date.now() - 30_000), // 30 seconds ago
      };
      repository.findMostRecentByMember.mockResolvedValue(recentLog);

      const promise = service.create(dto, memberUser);

      await expect(promise).rejects.toThrow(HttpException);
      // Status code 429
      try {
        await service.create(dto, memberUser);
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(429);
      }
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    it('allows admin to list any records', async () => {
      repository.list.mockResolvedValue([mockLog]);
      repository.count.mockResolvedValue(1);

      const result = await service.list({}, adminUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('forces a member to only see their OWN records (clamp)', async () => {
      repository.list.mockResolvedValue([mockLog]);
      repository.count.mockResolvedValue(1);

      await service.list({ memberId: 'cuid_other_999' }, memberUser);

      // The service should override the requested memberId
      const listFilter = repository.list.mock.calls[0][0];
      expect(listFilter.memberId).toBe('cuid_member_001');
    });

    it('computes pagination metadata', async () => {
      repository.list.mockResolvedValue([mockLog]);
      repository.count.mockResolvedValue(45);

      const result = await service.list({ page: 2, pageSize: 20 }, adminUser);

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });
  });

  // ============================================================
  // findCurrent (admin roster)
  // ============================================================
  describe('findCurrent', () => {
    it('returns the current location for every member when admin', async () => {
      repository.findCurrentForAllMembers.mockResolvedValue([mockLog]);

      const result = await service.findCurrent(adminUser);

      expect(result).toHaveLength(1);
    });

    it('forbids a member from calling findCurrent (403)', async () => {
      await expect(service.findCurrent(memberUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.findCurrentForAllMembers).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // findById
  // ============================================================
  describe('findById', () => {
    it('allows a member to get their OWN log', async () => {
      repository.findById.mockResolvedValue(mockLog);

      const result = await service.findById('cuid_loc_001', memberUser);

      expect(result.id).toBe('cuid_loc_001');
    });

    it('forbids a member from getting another member log (403)', async () => {
      repository.findById.mockResolvedValue(mockLog);

      await expect(
        service.findById('cuid_loc_001', otherMemberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an admin to get any log', async () => {
      repository.findById.mockResolvedValue(mockLog);

      const result = await service.findById('cuid_loc_001', adminUser);

      expect(result.id).toBe('cuid_loc_001');
    });

    it('throws NotFoundException when the log is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // delete
  // ============================================================
  describe('delete', () => {
    it('allows an admin to delete a log', async () => {
      repository.findById.mockResolvedValue(mockLog);
      repository.delete.mockResolvedValue(mockLog);

      await expect(
        service.delete('cuid_loc_001', adminUser),
      ).resolves.not.toThrow();
    });

    it('forbids a member from deleting (403)', async () => {
      await expect(service.delete('cuid_loc_001', memberUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when the log is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
