import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { FeatureFlagsController } from '../feature-flags.controller';
import { FeatureFlagsService } from '../feature-flags.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('FeatureFlagsController', () => {
  let controller: FeatureFlagsController;
  let service: jest.Mocked<FeatureFlagsService>;

  const devUser: AuthenticatedUser = {
    id: 'cuid_dev_001',
    uniqueId: 'CSJ-DEV',
    username: 'dev_master',
    phone: '+201000000000',
    role: Role.DEVELOPER,
    isActive: true,
    language: 'ar',
  };

  const mockFlagView = {
    id: 'cuid_flag_001',
    key: 'messaging',
    isEnabled: true,
    description: 'In-app messaging feature',
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const serviceMock = {
      findAll: jest.fn(),
      findByKey: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagsController],
      providers: [{ provide: FeatureFlagsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<FeatureFlagsController>(FeatureFlagsController);
    service = module.get(
      FeatureFlagsService,
    ) as unknown as jest.Mocked<FeatureFlagsService>;
  });

  describe('findAll', () => {
    it('returns all flags wrapped in { flags }', async () => {
      service.findAll.mockResolvedValue([mockFlagView]);

      const result = await controller.findAll();

      expect(result.flags).toHaveLength(1);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findByKey', () => {
    it('returns a single flag wrapped in { flag }', async () => {
      service.findByKey.mockResolvedValue(mockFlagView);

      const result = await controller.findByKey('messaging');

      expect(result.flag.key).toBe('messaging');
      expect(service.findByKey).toHaveBeenCalledWith('messaging');
    });
  });

  describe('create', () => {
    it('creates a flag and returns it wrapped in { flag }', async () => {
      service.create.mockResolvedValue(mockFlagView);

      const result = await controller.create(
        {
          key: 'messaging',
          isEnabled: true,
          description: 'In-app messaging feature',
        },
        devUser,
      );

      expect(result.flag.key).toBe('messaging');
      expect(service.create).toHaveBeenCalledWith(
        {
          key: 'messaging',
          isEnabled: true,
          description: 'In-app messaging feature',
        },
        devUser,
      );
    });
  });

  describe('update', () => {
    it('updates a flag and returns it wrapped in { flag }', async () => {
      const updated = { ...mockFlagView, isEnabled: false };
      service.update.mockResolvedValue(updated);

      const result = await controller.update(
        'messaging',
        { isEnabled: false },
        devUser,
      );

      expect(result.flag.isEnabled).toBe(false);
      expect(service.update).toHaveBeenCalledWith(
        'messaging',
        { isEnabled: false },
        devUser,
      );
    });
  });

  describe('delete', () => {
    it('deletes a flag', async () => {
      service.delete.mockResolvedValue(undefined);

      await controller.delete('messaging', devUser);

      expect(service.delete).toHaveBeenCalledWith('messaging', devUser);
    });
  });
});
