import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { MembersController } from '../members.controller';
import { MembersService } from '../members.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('MembersController', () => {
  let controller: MembersController;
  let service: jest.Mocked<MembersService>;

  const adminUser: AuthenticatedUser = {
    id: 'cuid_admin_001',
    uniqueId: 'CSJ-ADM',
    username: 'admin_boss',
    phone: '+201000000000',
    role: Role.ADMIN,
    isActive: true,
    language: 'ar',
  };

  const mockMemberView = {
    id: 'cuid_member_001',
    uniqueId: 'CSJ-001',
    username: 'ahmed_scout',
    phone: '+201234567890',
    role: Role.MEMBER,
    isActive: true,
    avatarUrl: null,
    language: 'ar',
    createdAt: new Date('2026-01-01'),
  };

  const mockPaginatedResult = {
    items: [mockMemberView],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  beforeEach(async () => {
    const serviceMock = {
      getById: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [{ provide: MembersService, useValue: serviceMock }],
    }).compile();

    controller = module.get<MembersController>(MembersController);
    service = module.get(
      MembersService,
    ) as unknown as jest.Mocked<MembersService>;
  });

  describe('list', () => {
    it('returns paginated members', async () => {
      service.list.mockResolvedValue(mockPaginatedResult);

      const result = await controller.list({}, adminUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(service.list).toHaveBeenCalledWith({}, adminUser);
    });

    it('passes query filters to the service', async () => {
      service.list.mockResolvedValue(mockPaginatedResult);

      await controller.list({ role: Role.MEMBER, page: 2 }, adminUser);

      expect(service.list).toHaveBeenCalledWith(
        { role: Role.MEMBER, page: 2 },
        adminUser,
      );
    });
  });

  describe('getById', () => {
    it('returns a single member', async () => {
      service.getById.mockResolvedValue(mockMemberView);

      const result = await controller.getById('cuid_member_001', adminUser);

      expect(result.member.id).toBe('cuid_member_001');
      expect(service.getById).toHaveBeenCalledWith(
        'cuid_member_001',
        adminUser,
      );
    });
  });

  describe('update', () => {
    it('updates a member and returns the result', async () => {
      const updated = { ...mockMemberView, language: 'en' };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        'cuid_member_001',
        { language: 'en' },
        adminUser,
      );

      expect(result.member.language).toBe('en');
      expect(service.update).toHaveBeenCalledWith(
        'cuid_member_001',
        { language: 'en' },
        adminUser,
      );
    });
  });
});
