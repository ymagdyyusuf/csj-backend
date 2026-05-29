import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { LocationController } from '../location.controller';
import { LocationService } from '../location.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('LocationController', () => {
  let controller: LocationController;
  let service: jest.Mocked<LocationService>;

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
    id: 'cuid_loc_001',
    memberId: 'cuid_member_001',
    latitude: 30.0444,
    longitude: 31.2357,
    accuracy: 8.5,
    recordedAt: new Date('2026-01-15'),
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
      list: jest.fn(),
      findCurrent: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationController],
      providers: [{ provide: LocationService, useValue: serviceMock }],
    }).compile();

    controller = module.get<LocationController>(LocationController);
    service = module.get(
      LocationService,
    ) as unknown as jest.Mocked<LocationService>;
  });

  describe('create', () => {
    it('creates a log wrapped in { location }', async () => {
      service.create.mockResolvedValue(mockView);

      const dto = { latitude: 30.0444, longitude: 31.2357, accuracy: 8.5 };
      const result = await controller.create(dto, adminUser);

      expect(result.location.id).toBe('cuid_loc_001');
      expect(service.create).toHaveBeenCalledWith(dto, adminUser);
    });
  });

  describe('findCurrent', () => {
    it('returns the live roster wrapped in { locations }', async () => {
      service.findCurrent.mockResolvedValue([mockView]);

      const result = await controller.findCurrent(adminUser);

      expect(result.locations).toHaveLength(1);
      expect(service.findCurrent).toHaveBeenCalledWith(adminUser);
    });
  });

  describe('list', () => {
    it('returns paginated logs', async () => {
      service.list.mockResolvedValue(mockPaginated);

      const result = await controller.list({}, adminUser);

      expect(result.items).toHaveLength(1);
      expect(service.list).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns one log wrapped in { location }', async () => {
      service.findById.mockResolvedValue(mockView);

      const result = await controller.findById('cuid_loc_001', adminUser);

      expect(result.location.id).toBe('cuid_loc_001');
      expect(service.findById).toHaveBeenCalledWith('cuid_loc_001', adminUser);
    });
  });

  describe('delete', () => {
    it('deletes a log', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('cuid_loc_001', adminUser);

      expect(service.delete).toHaveBeenCalledWith('cuid_loc_001', adminUser);
    });
  });
});
