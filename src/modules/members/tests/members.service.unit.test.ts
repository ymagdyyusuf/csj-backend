import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MembersService } from '../members.service';
import { MembersRepository } from '../members.repository';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('MembersService', () => {
  let service: MembersService;
  let repository: jest.Mocked<MembersRepository>;

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

  // Three actors for permission tests
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
    username: 'someone_else',
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
      findById: jest.fn(),
      findByUsername: jest.fn(),
      list: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: MembersRepository, useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    repository = module.get(
      MembersRepository,
    ) as unknown as jest.Mocked<MembersRepository>;
  });

  // ============================================================
  // getById
  // ============================================================
  describe('getById', () => {
    it('allows a member to get their OWN profile', async () => {
      repository.findById.mockResolvedValue(mockMember);

      const result = await service.getById('cuid_member_001', memberUser);

      expect(result.id).toBe('cuid_member_001');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('forbids a member from getting ANOTHER member profile', async () => {
      repository.findById.mockResolvedValue(mockMember);

      await expect(
        service.getById('cuid_member_001', otherMemberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an admin to get ANY member profile', async () => {
      repository.findById.mockResolvedValue(mockMember);

      const result = await service.getById('cuid_member_001', adminUser);

      expect(result.id).toBe('cuid_member_001');
    });

    it('throws NotFoundException when member does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getById('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // list
  // ============================================================
  describe('list', () => {
    it('allows admin to list members', async () => {
      repository.list.mockResolvedValue([mockMember]);
      repository.count.mockResolvedValue(1);

      const result = await service.list({}, adminUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('allows developer to list members', async () => {
      repository.list.mockResolvedValue([mockMember]);
      repository.count.mockResolvedValue(1);

      const result = await service.list({}, devUser);

      expect(result.items).toHaveLength(1);
    });

    it('forbids a member from listing members', async () => {
      await expect(service.list({}, memberUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.list).not.toHaveBeenCalled();
    });

    it('computes pagination metadata correctly', async () => {
      repository.list.mockResolvedValue([mockMember]);
      repository.count.mockResolvedValue(45);

      const result = await service.list({ page: 2, pageSize: 20 }, adminUser);

      expect(result.total).toBe(45);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(3); // ceil(45/20)
    });

    it('strips passwordHash from listed members', async () => {
      repository.list.mockResolvedValue([mockMember]);
      repository.count.mockResolvedValue(1);

      const result = await service.list({}, adminUser);

      expect(result.items[0]).not.toHaveProperty('passwordHash');
      expect(result.items[0]).not.toHaveProperty('qrCode');
    });
  });

  // ============================================================
  // update
  // ============================================================
  describe('update', () => {
    it('allows a member to update their OWN language', async () => {
      repository.findById.mockResolvedValue(mockMember);
      repository.update.mockResolvedValue({ ...mockMember, language: 'en' });

      const result = await service.update(
        'cuid_member_001',
        { language: 'en' },
        memberUser,
      );

      expect(result.language).toBe('en');
    });

    it('forbids a member from updating ANOTHER member', async () => {
      repository.findById.mockResolvedValue(mockMember);

      await expect(
        service.update('cuid_member_001', { language: 'en' }, otherMemberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids a member from changing their own role', async () => {
      repository.findById.mockResolvedValue(mockMember);

      await expect(
        service.update('cuid_member_001', { role: Role.DEVELOPER }, memberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('forbids a member from changing isActive', async () => {
      repository.findById.mockResolvedValue(mockMember);

      await expect(
        service.update('cuid_member_001', { isActive: false }, memberUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an admin to update another member username and isActive', async () => {
      repository.findById.mockResolvedValue(mockMember);
      repository.update.mockResolvedValue({
        ...mockMember,
        username: 'new_name',
        isActive: false,
      });

      const result = await service.update(
        'cuid_member_001',
        { username: 'new_name', isActive: false },
        adminUser,
      );

      expect(result.username).toBe('new_name');
    });

    it('forbids an admin from changing role (only developer can)', async () => {
      repository.findById.mockResolvedValue(mockMember);

      await expect(
        service.update('cuid_member_001', { role: Role.ADMIN }, adminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a developer to change role', async () => {
      repository.findById.mockResolvedValue(mockMember);
      repository.update.mockResolvedValue({ ...mockMember, role: Role.ADMIN });

      const result = await service.update(
        'cuid_member_001',
        { role: Role.ADMIN },
        devUser,
      );

      expect(result.role).toBe(Role.ADMIN);
    });

    it('throws NotFoundException when updating non-existent member', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('ghost', { language: 'en' }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
