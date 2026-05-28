import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { FeatureFlagsService } from '../feature-flags.service';
import { FeatureFlagsRepository } from '../feature-flags.repository';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let repository: jest.Mocked<FeatureFlagsRepository>;

  const mockFlag = {
    id: 'cuid_flag_001',
    key: 'messaging',
    isEnabled: true,
    description: 'In-app messaging feature',
    updatedAt: new Date('2026-01-01'),
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

  const adminUser: AuthenticatedUser = {
    ...memberUser,
    id: 'cuid_admin_001',
    username: 'admin_boss',
    role: Role.ADMIN,
  };

  const devUser: AuthenticatedUser = {
    ...memberUser,
    id: 'cuid_dev_001',
    username: 'dev_master',
    role: Role.DEVELOPER,
  };

  beforeEach(async () => {
    const repositoryMock = {
      findAll: jest.fn(),
      findByKey: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: FeatureFlagsRepository, useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    repository = module.get(
      FeatureFlagsRepository,
    ) as unknown as jest.Mocked<FeatureFlagsRepository>;
  });

  // ============================================================
  // findAll - any authenticated user
  // ============================================================
  describe('findAll', () => {
    it('returns all flags for any authenticated user', async () => {
      repository.findAll.mockResolvedValue([mockFlag]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('messaging');
    });
  });

  // ============================================================
  // findByKey - any authenticated user
  // ============================================================
  describe('findByKey', () => {
    it('returns a flag when found', async () => {
      repository.findByKey.mockResolvedValue(mockFlag);

      const result = await service.findByKey('messaging');

      expect(result.key).toBe('messaging');
    });

    it('throws NotFoundException when flag is missing', async () => {
      repository.findByKey.mockResolvedValue(null);

      await expect(service.findByKey('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // create - developer only
  // ============================================================
  describe('create', () => {
    it('allows a developer to create a flag', async () => {
      repository.findByKey.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockFlag);

      const result = await service.create(
        {
          key: 'messaging',
          isEnabled: true,
          description: 'In-app messaging feature',
        },
        devUser,
      );

      expect(result.key).toBe('messaging');
    });

    it('forbids an admin from creating a flag', async () => {
      await expect(
        service.create({ key: 'messaging' }, adminUser),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('forbids a member from creating a flag', async () => {
      await expect(
        service.create({ key: 'messaging' }, memberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when key already exists', async () => {
      repository.findByKey.mockResolvedValue(mockFlag);

      await expect(
        service.create({ key: 'messaging' }, devUser),
      ).rejects.toThrow(ConflictException);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // update - developer only
  // ============================================================
  describe('update', () => {
    it('allows a developer to toggle a flag', async () => {
      repository.findByKey.mockResolvedValue(mockFlag);
      repository.update.mockResolvedValue({ ...mockFlag, isEnabled: false });

      const result = await service.update(
        'messaging',
        { isEnabled: false },
        devUser,
      );

      expect(result.isEnabled).toBe(false);
    });

    it('forbids an admin from updating a flag', async () => {
      await expect(
        service.update('messaging', { isEnabled: false }, adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when updating a missing flag', async () => {
      repository.findByKey.mockResolvedValue(null);

      await expect(
        service.update('ghost', { isEnabled: false }, devUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // delete - developer only
  // ============================================================
  describe('delete', () => {
    it('allows a developer to delete a flag', async () => {
      repository.findByKey.mockResolvedValue(mockFlag);
      repository.delete.mockResolvedValue(mockFlag);

      await expect(service.delete('messaging', devUser)).resolves.not.toThrow();
      expect(repository.delete).toHaveBeenCalledWith('messaging');
    });

    it('forbids a member from deleting a flag', async () => {
      await expect(service.delete('messaging', memberUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when deleting a missing flag', async () => {
      repository.findByKey.mockResolvedValue(null);

      await expect(service.delete('ghost', devUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
