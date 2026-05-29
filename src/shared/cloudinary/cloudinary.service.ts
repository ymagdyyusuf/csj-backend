import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { v2 as CloudinaryType } from 'cloudinary';
import { CLOUDINARY } from './cloudinary.provider';

/**
 * Result of a successful upload.
 */
export interface UploadResult {
  url: string;
  duration: number; // seconds, rounded
  publicId: string;
}

/**
 * CloudinaryService - the ONLY place the app touches the Cloudinary SDK.
 *
 * Shared across all media features (boqs, wall posts, lectures, avatars...).
 * Audio is uploaded under Cloudinary's "video" resource type (audio + video
 * share the same pipeline).
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryType,
  ) {}

  /**
   * Upload an audio buffer to Cloudinary.
   *
   * @param buffer    The file bytes
   * @param filename  Original filename (used for a readable public_id prefix)
   * @returns url, duration (rounded seconds), and publicId
   */
  async uploadAudio(buffer: Buffer, filename: string): Promise<UploadResult> {
    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          resource_type: 'video', // audio uses the video pipeline
          folder: 'boqs',
          public_id: `${Date.now()}_${filename.replace(/\.[^.]+$/, '')}`,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary upload failed: ${error?.message}`);
            return reject(
              new InternalServerErrorException('Audio upload failed'),
            );
          }
          resolve({
            url: result.secure_url,
            duration: Math.round(result.duration ?? 0),
            publicId: result.public_id,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }
  /**
   * Upload an image buffer to Cloudinary.
   * No duration is returned for images.
   */
  async uploadImage(buffer: Buffer, filename: string): Promise<UploadResult> {
    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: 'wall',
          public_id: `${Date.now()}_${filename.replace(/\.[^.]+$/, '')}`,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              `Cloudinary image upload failed: ${error?.message}`,
            );
            return reject(
              new InternalServerErrorException('Image upload failed'),
            );
          }
          resolve({
            url: result.secure_url,
            duration: 0, // images have no duration
            publicId: result.public_id,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }

  /**
   * Upload a video buffer to Cloudinary.
   * Cloudinary returns duration in seconds; we round it.
   */
  async uploadVideo(buffer: Buffer, filename: string): Promise<UploadResult> {
    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          resource_type: 'video',
          folder: 'wall',
          public_id: `${Date.now()}_${filename.replace(/\.[^.]+$/, '')}`,
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              `Cloudinary video upload failed: ${error?.message}`,
            );
            return reject(
              new InternalServerErrorException('Video upload failed'),
            );
          }
          resolve({
            url: result.secure_url,
            duration: Math.round(result.duration ?? 0),
            publicId: result.public_id,
          });
        },
      );

      uploadStream.end(buffer);
    });
  }
  /**
   * Delete a file from Cloudinary by its public ID.
   * Best-effort: logs but does not throw if deletion fails, so a failed
   * cleanup never blocks the main operation.
   */
  async deleteFile(publicId: string): Promise<void> {
    try {
      await this.cloudinary.uploader.destroy(publicId, {
        resource_type: 'video',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete Cloudinary file '${publicId}': ${(error as Error).message}`,
      );
    }
  }
}
