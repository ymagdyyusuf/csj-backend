import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { BoqsService } from '../boqs.service';
import { BoqsRepository } from '../boqs.repository';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { AuthenticatedUser } from '../../auth/auth.types';

describe('BoqsService', () => {
  let service: BoqsService;
  let repository: jest.Mocked<BoqsRepository>;
  let cloudinary: jest.Mocked<CloudinaryService>;

  const mockBoqs = {
    id: 'cuid_boqs_001',
    audioUrl: 'https://res.cloudinary.com/csj/video/upload/boqs/boqs_001.mp3',
    text: 'Assembly in 5 minutes',
    duration: 12,
    sentById: 'cuid_admin_001',
    sentAt: new Date('2026-01-15T10:00:00Z'),
    deviceCount: 0,
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

  const validAudioFile = {
    buffer: Buffer.from('fake audio bytes'),
    originalname: 'alert.mp3',
    mimetype: 'audio/mpeg',
    size: 256 * 1024, // 256 KB
  };

  beforeEach(async () => {
    const repoMock = {
      findById: jest.fn(),
      list: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      incrementDeviceCount: jest.fn(),
    };
    const cloudinaryMock = {
      uploadAudio: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoqsService,
        { provide: BoqsRepository, useValue: repoMock },
        { provide: CloudinaryService, useValue: cloudinaryMock },
      ],
    }).compile();

    service = module.get<BoqsService>(BoqsService);
    repository = module.get(
      BoqsRepository,
    ) as unknown as jest.Mocked<BoqsRepository>;
    cloudinary = module.get(
      CloudinaryService,
    ) as unknown as jest.Mocked<CloudinaryService>;
  });

  // ============================================================
  // create
  // ============================================================
  describe('create', () => {
    it('allows an admin to upload and create a broadcast', async () => {
      cloudinary.uploadAudio.mockResolvedValue({
        url: mockBoqs.audioUrl,
        duration: 12,
        publicId: 'boqs/boqs_001',
      });
      repository.create.mockResolvedValue(mockBoqs);

      const result = await service.create(
        { text: 'Assembly in 5 minutes' },
        validAudioFile,
        adminUser,
      );

      expect(result.id).toBe('cuid_boqs_001');
      // sentById comes from auth user
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sentById: 'cuid_admin_001' }),
      );
      // duration comes from Cloudinary, not the client
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 12 }),
      );
    });

    it('forbids a member from creating a broadcast', async () => {
      await expect(
        service.create({ text: 'hi' }, validAudioFile, memberUser),
      ).rejects.toThrow(ForbiddenException);
      expect(cloudinary.uploadAudio).not.toHaveBeenCalled();
    });

    it('rejects a missing file', async () => {
      await expect(
        service.create({ text: 'hi' }, undefined, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-audio mimetype', async () => {
      const badFile = { ...validAudioFile, mimetype: 'image/jpeg' };

      await expect(
        service.create({ text: 'hi' }, badFile, adminUser),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinary.uploadAudio).not.toHaveBeenCalled();
    });

    it('rejects a file larger than 10MB', async () => {
      const bigFile = { ...validAudioFile, size: 11 * 1024 * 1024 };

      await expect(
        service.create({ text: 'hi' }, bigFile, adminUser),
      ).rejects.toThrow(BadRequestException);
      expect(cloudinary.uploadAudio).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // list / findById
  // ============================================================
  describe('list', () => {
    it('lists broadcasts for any authenticated user', async () => {
      repository.list.mockResolvedValue([mockBoqs]);
      repository.count.mockResolvedValue(1);

      const result = await service.list({}, memberUser);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('computes pagination metadata', async () => {
      repository.list.mockResolvedValue([mockBoqs]);
      repository.count.mockResolvedValue(45);

      const result = await service.list({ page: 2, pageSize: 20 }, memberUser);

      expect(result.totalPages).toBe(3);
      expect(result.page).toBe(2);
    });
  });

  describe('findById', () => {
    it('returns the broadcast when found', async () => {
      repository.findById.mockResolvedValue(mockBoqs);

      const result = await service.findById('cuid_boqs_001', memberUser);

      expect(result.id).toBe('cuid_boqs_001');
    });

    it('throws NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('ghost', memberUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ============================================================
  // incrementDeviceCount
  // ============================================================
  describe('incrementDeviceCount', () => {
    it('allows any authenticated user to bump the counter', async () => {
      repository.findById.mockResolvedValue(mockBoqs);
      repository.incrementDeviceCount.mockResolvedValue({
        ...mockBoqs,
        deviceCount: 1,
      });

      const result = await service.incrementDeviceCount(
        'cuid_boqs_001',
        memberUser,
      );

      expect(result.deviceCount).toBe(1);
    });

    it('throws NotFoundException when the broadcast is missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.incrementDeviceCount('ghost', memberUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================
  // delete
  // ============================================================
  describe('delete', () => {
    it('allows an admin to delete a broadcast and cleans up Cloudinary', async () => {
      repository.findById.mockResolvedValue(mockBoqs);
      repository.delete.mockResolvedValue(mockBoqs);

      await service.delete('cuid_boqs_001', adminUser);

      expect(repository.delete).toHaveBeenCalledWith('cuid_boqs_001');
      // Should attempt Cloudinary cleanup using a publicId derived from the URL
      expect(cloudinary.deleteFile).toHaveBeenCalled();
    });

    it('forbids a member from deleting a broadcast', async () => {
      await expect(service.delete('cuid_boqs_001', memberUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when deleting a missing broadcast', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('ghost', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
