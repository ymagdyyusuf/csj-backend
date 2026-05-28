import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary.service';
import { CLOUDINARY } from '../cloudinary.provider';

/**
 * Unit tests for CloudinaryService.
 *
 * We inject a mock of the Cloudinary SDK (via the CLOUDINARY token)
 * so no real network calls happen.
 */
describe('CloudinaryService', () => {
  let service: CloudinaryService;
  let uploadStreamMock: jest.Mock;
  let destroyMock: jest.Mock;

  beforeEach(async () => {
    // Mock the Cloudinary SDK shape we use
    uploadStreamMock = jest.fn();
    destroyMock = jest.fn();

    const cloudinaryMock = {
      uploader: {
        upload_stream: uploadStreamMock,
        destroy: destroyMock,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        { provide: CLOUDINARY, useValue: cloudinaryMock },
      ],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  describe('uploadAudio', () => {
    it('resolves with url, duration and publicId on success', async () => {
      // upload_stream(options, callback) -> returns a writable stream.
      // We simulate success by invoking the callback with a result.
      uploadStreamMock.mockImplementation((_options, callback) => {
        callback(null, {
          secure_url: 'https://res.cloudinary.com/csj/audio/boqs_123.mp3',
          duration: 12.5,
          public_id: 'boqs/boqs_123',
        });
        // Return a fake stream with an end() method
        return { end: jest.fn() };
      });

      const result = await service.uploadAudio(
        Buffer.from('fake audio'),
        'alert.mp3',
      );

      expect(result.url).toBe(
        'https://res.cloudinary.com/csj/audio/boqs_123.mp3',
      );
      expect(result.duration).toBe(13); // rounded
      expect(result.publicId).toBe('boqs/boqs_123');
    });

    it('throws InternalServerErrorException when Cloudinary errors', async () => {
      uploadStreamMock.mockImplementation((_options, callback) => {
        callback(new Error('Cloudinary down'), undefined);
        return { end: jest.fn() };
      });

      await expect(
        service.uploadAudio(Buffer.from('fake audio'), 'alert.mp3'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('deleteFile', () => {
    it('calls destroy with the publicId', async () => {
      destroyMock.mockResolvedValue({ result: 'ok' });

      await service.deleteFile('boqs/boqs_123');

      expect(destroyMock).toHaveBeenCalledWith('boqs/boqs_123', {
        resource_type: 'video',
      });
    });

    it('does not throw if destroy fails (best-effort cleanup)', async () => {
      destroyMock.mockRejectedValue(new Error('not found'));

      await expect(service.deleteFile('ghost')).resolves.not.toThrow();
    });
  });
});
