import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { BoqsService } from './boqs.service';
import { CreateBoqsDto } from './dto/create-boqs.dto';
import { ListBoqsQueryDto } from './dto/list-boqs-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { BoqsListFilter, UploadedAudioFile } from './boqs.types';

/**
 * BoqsController - HTTP layer for audio broadcasts.
 *
 * Writes (create, delete) are ADMIN/DEVELOPER only.
 * Reads + incrementDeviceCount are open to any authenticated user.
 *
 * POST /boqs accepts a multipart upload via FileInterceptor('audio'):
 * the file field MUST be named "audio" and the text comes as a form field.
 */
@Controller('boqs')
export class BoqsController {
  constructor(private readonly boqsService: BoqsService) {}

  /**
   * POST /api/v1/boqs (multipart/form-data)
   *
   * Form fields:
   *   - audio: the audio file
   *   - text:  the caption (string, 1-300 chars)
   */
  @Post()
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @UseInterceptors(FileInterceptor('audio'))
  async create(
    @Body() dto: CreateBoqsDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    // Adapt Multer's file shape to our framework-agnostic interface.
    const adapted: UploadedAudioFile | undefined = file
      ? {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        }
      : undefined;

    const boqs = await this.boqsService.create(dto, adapted, currentUser);
    return { boqs };
  }

  /**
   * GET /api/v1/boqs
   * List broadcasts with optional filters. Any authenticated user.
   */
  @Get()
  async list(
    @Query() query: ListBoqsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const filter: BoqsListFilter = {
      sentById: query.sentById,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    };
    return this.boqsService.list(filter, currentUser);
  }

  /**
   * GET /api/v1/boqs/:id
   * Get one broadcast. Any authenticated user.
   */
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const boqs = await this.boqsService.findById(id, currentUser);
    return { boqs };
  }

  /**
   * PATCH /api/v1/boqs/:id/device-count
   * App reports that a device received the broadcast. Bumps the counter
   * atomically. Any authenticated user.
   */
  @Patch(':id/device-count')
  async incrementDeviceCount(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const boqs = await this.boqsService.incrementDeviceCount(id, currentUser);
    return { boqs };
  }

  /**
   * DELETE /api/v1/boqs/:id
   * Remove a broadcast (and best-effort delete its Cloudinary file).
   * Admin/Developer only. Returns 204.
   */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @HttpCode(204)
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.boqsService.delete(id, currentUser);
  }
}
