import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { BoqsController } from '../boqs.controller';
import { BoqsService } from '../boqs.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('BoqsController', () => {
  let controller: BoqsController;
  let service: jest.Mocked<BoqsService>;

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
    id: 'cuid_boqs_001',
    audioUrl: 'https://res.cloudinary.com/csj/video/upload/boqs/boqs_001.mp3',
    text: 'Assembly in 5 minutes',
    duration: 12,
    sentById: 'cuid_admin_001',
    sentAt: new Date('2026-01-15'),
    deviceCount: 0,
  };

  const mockPaginated = {
    items: [mockView],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  // Mock of an Express.Multer.File - just the fields the controller passes through
  const mockFile = {
    buffer: Buffer.from('audio bytes'),
    originalname: 'alert.mp3',
    mimetype: 'audio/mpeg',
    size: 1024,
  } as Express.Multer.File;

  beforeEach(async () => {
    const serviceMock = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      incrementDeviceCount: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoqsController],
      providers: [{ provide: BoqsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<BoqsController>(BoqsController);
    service = module.get(BoqsService) as unknown as jest.Mocked<BoqsService>;
  });

  describe('create', () => {
    it('creates a broadcast wrapped in { boqs }', async () => {
      service.create.mockResolvedValue(mockView);

      const result = await controller.create(
        { text: 'Assembly in 5 minutes' },
        mockFile,
        adminUser,
      );

      expect(result.boqs.id).toBe('cuid_boqs_001');
      // The controller should forward the file fields the service expects
      const serviceCallArg = service.create.mock.calls[0][1];
      expect(serviceCallArg).toBeDefined();
      expect(serviceCallArg!.originalname).toBe('alert.mp3');
      expect(serviceCallArg!.mimetype).toBe('audio/mpeg');
    });
  });

  describe('list', () => {
    it('returns paginated broadcasts', async () => {
      service.list.mockResolvedValue(mockPaginated);

      const result = await controller.list({}, adminUser);

      expect(result.items).toHaveLength(1);
      expect(service.list).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns one broadcast wrapped in { boqs }', async () => {
      service.findById.mockResolvedValue(mockView);

      const result = await controller.findById('cuid_boqs_001', adminUser);

      expect(result.boqs.id).toBe('cuid_boqs_001');
      expect(service.findById).toHaveBeenCalledWith('cuid_boqs_001', adminUser);
    });
  });

  describe('incrementDeviceCount', () => {
    it('bumps the counter', async () => {
      const updated = { ...mockView, deviceCount: 1 };
      service.incrementDeviceCount.mockResolvedValue(updated);

      const result = await controller.incrementDeviceCount(
        'cuid_boqs_001',
        adminUser,
      );

      expect(result.boqs.deviceCount).toBe(1);
      expect(service.incrementDeviceCount).toHaveBeenCalledWith(
        'cuid_boqs_001',
        adminUser,
      );
    });
  });

  describe('delete', () => {
    it('deletes a broadcast', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('cuid_boqs_001', adminUser);

      expect(service.delete).toHaveBeenCalledWith('cuid_boqs_001', adminUser);
    });
  });
});
