import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { FeatureFlagsService } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * FeatureFlagsController - HTTP layer for feature flags.
 *
 * All endpoints require authentication (global JwtAuthGuard).
 * Reads are open to any authenticated user; writes are gated to
 * DEVELOPER via @Roles + enforced again in the service.
 */
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  /**
   * GET /api/v1/feature-flags
   * List all flags. Any authenticated user.
   */
  @Get()
  async findAll() {
    const flags = await this.featureFlagsService.findAll();
    return { flags };
  }

  /**
   * GET /api/v1/feature-flags/:key
   * Get one flag by key. Any authenticated user.
   */
  @Get(':key')
  async findByKey(@Param('key') key: string) {
    const flag = await this.featureFlagsService.findByKey(key);
    return { flag };
  }

  /**
   * POST /api/v1/feature-flags
   * Create a flag. Developer only.
   */
  @Post()
  @Roles(Role.DEVELOPER)
  async create(
    @Body() dto: CreateFeatureFlagDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const flag = await this.featureFlagsService.create(dto, currentUser);
    return { flag };
  }

  /**
   * PATCH /api/v1/feature-flags/:key
   * Toggle / update a flag. Developer only.
   */
  @Patch(':key')
  @Roles(Role.DEVELOPER)
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const flag = await this.featureFlagsService.update(key, dto, currentUser);
    return { flag };
  }

  /**
   * DELETE /api/v1/feature-flags/:key
   * Remove a flag. Developer only. Returns 204 No Content.
   */
  @Delete(':key')
  @Roles(Role.DEVELOPER)
  @HttpCode(204)
  async delete(
    @Param('key') key: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.featureFlagsService.delete(key, currentUser);
  }
}
