import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Boqs, Role } from '@prisma/client';
import { BoqsRepository } from './boqs.repository';
import { CloudinaryService } from '../../shared/cloudinary/cloudinary.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateBoqsDto } from './dto/create-boqs.dto';
import {
  BoqsListFilter,
  BoqsView,
  PaginatedResult,
  PAGINATION_DEFAULTS,
  UploadedAudioFile,
} from './boqs.types';

/**
 * Maximum allowed audio file size in bytes (10 MB).
 */
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Mimetype prefixes accepted for Boqs uploads.
 */
const ALLOWED_AUDIO_MIME_PREFIX = 'audio/';

/**
 * BoqsService - orchestrates Cloudinary upload + Postgres metadata for broadcasts.
 *
 * Authorization:
 *  - reads + incrementDeviceCount: any authenticated user
 *  - create + delete: ADMIN or DEVELOPER only
 *
 * Validation (fail-fast, BEFORE upload):
 *  - file present
 *  - mimetype starts with "audio/"
 *  - size <= 10 MB
 */
@Injectable()
export class BoqsService {
  constructor(
    private readonly repository: BoqsRepository,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ============================================================
  // create
  // ============================================================
  async create(
    dto: CreateBoqsDto,
    file: UploadedAudioFile | undefined,
    currentUser: AuthenticatedUser,
  ): Promise<BoqsView> {
    this.assertPrivileged(currentUser);
    this.assertValidAudioFile(file);

    // file is now guaranteed non-undefined by assertValidAudioFile
    const safe = file as UploadedAudioFile;

    const uploaded = await this.cloudinary.uploadAudio(
      safe.buffer,
      safe.originalname,
    );

    const record = await this.repository.create({
      audioUrl: uploaded.url,
      text: dto.text,
      duration: uploaded.duration,
      sentById: currentUser.id,
    });

    return this.toView(record);
  }

  // ============================================================
  // list
  // ============================================================
  async list(
    filter: BoqsListFilter,
    _currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<BoqsView>> {
    const page = filter.page ?? PAGINATION_DEFAULTS.PAGE;
    const pageSize = Math.min(
      filter.pageSize ?? PAGINATION_DEFAULTS.PAGE_SIZE,
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      this.repository.list(filter, { skip, take: pageSize }),
      this.repository.count(filter),
    ]);

    return {
      items: records.map((r) => this.toView(r)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ============================================================
  // findById
  // ============================================================
  async findById(
    id: string,
    _currentUser: AuthenticatedUser,
  ): Promise<BoqsView> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException('Broadcast not found');
    }
    return this.toView(record);
  }

  // ============================================================
  // incrementDeviceCount
  // ============================================================
  async incrementDeviceCount(
    id: string,
    _currentUser: AuthenticatedUser,
  ): Promise<BoqsView> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Broadcast not found');
    }
    const updated = await this.repository.incrementDeviceCount(id);
    return this.toView(updated);
  }

  // ============================================================
  // delete
  // ============================================================
  async delete(id: string, currentUser: AuthenticatedUser): Promise<void> {
    this.assertPrivileged(currentUser);

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Broadcast not found');
    }

    await this.repository.delete(id);

    // Best-effort Cloudinary cleanup (errors are swallowed by deleteFile)
    const publicId = this.extractPublicIdFromUrl(existing.audioUrl);
    if (publicId) {
      await this.cloudinary.deleteFile(publicId);
    }
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private assertPrivileged(user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && user.role !== Role.DEVELOPER) {
      throw new ForbiddenException(
        'Only admins can broadcast or delete a Boqs',
      );
    }
  }

  private assertValidAudioFile(file: UploadedAudioFile | undefined): void {
    if (!file) {
      throw new BadRequestException('Audio file is required');
    }
    if (!file.mimetype.startsWith(ALLOWED_AUDIO_MIME_PREFIX)) {
      throw new BadRequestException('File must be an audio type');
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      throw new BadRequestException('Audio file must not exceed 10 MB');
    }
  }

  /**
   * Extract Cloudinary publicId from a delivery URL.
   *
   * Cloudinary URL shape:
   *   https://res.cloudinary.com/{cloud}/{resource}/upload/[v123/]{publicId}.{ext}
   *
   * Stage 1 workaround - in a later step we can add a `publicId` column
   * to the Boqs schema and store it directly instead of parsing.
   */
  private extractPublicIdFromUrl(url: string): string | null {
    try {
      const uploadMarker = '/upload/';
      const i = url.indexOf(uploadMarker);
      if (i < 0) return null;
      let tail = url.slice(i + uploadMarker.length);
      // Strip optional version segment like "v1700000000/"
      tail = tail.replace(/^v\d+\//, '');
      // Strip file extension
      const lastDot = tail.lastIndexOf('.');
      if (lastDot > 0) tail = tail.slice(0, lastDot);
      return tail || null;
    } catch {
      return null;
    }
  }

  private toView(record: Boqs): BoqsView {
    return {
      id: record.id,
      audioUrl: record.audioUrl,
      text: record.text,
      duration: record.duration,
      sentById: record.sentById,
      sentAt: record.sentAt,
      deviceCount: record.deviceCount,
    };
  }
}
