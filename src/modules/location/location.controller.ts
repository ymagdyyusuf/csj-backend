import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { LocationService } from './location.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { ListLocationQueryDto } from './dto/list-location-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { LocationListFilter } from './location.types';

/**
 * LocationController - HTTP layer for GPS logs.
 *
 * Reads: any authenticated user (members are clamped to their own
 * records inside the service). /current is admin-only.
 * Writes (POST, DELETE): see role guards below.
 *
 * IMPORTANT ROUTING: the static "current" path MUST come BEFORE the
 * dynamic ":id" path so NestJS doesn't try to match "current" as an id.
 */
@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  /**
   * POST /api/v1/location
   * Any authenticated member logs their own location.
   * memberId is taken from @CurrentUser - never the body.
   * Service enforces a 60-second throttle.
   */
  @Post()
  async create(
    @Body() dto: CreateLocationDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const location = await this.locationService.create(dto, currentUser);
    return { location };
  }

  /**
   * GET /api/v1/location/current
   * Live roster - latest location per member.
   * MUST come before /:id route.
   * Admin/Developer only.
   */
  @Get('current')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  async findCurrent(@CurrentUser() currentUser: AuthenticatedUser) {
    const locations = await this.locationService.findCurrent(currentUser);
    return { locations };
  }

  /**
   * GET /api/v1/location
   * List logs with filters. Members are clamped to their own.
   */
  @Get()
  async list(
    @Query() query: ListLocationQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const filter: LocationListFilter = {
      memberId: query.memberId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    };
    return this.locationService.list(filter, currentUser);
  }

  /**
   * GET /api/v1/location/:id
   * Get one log. Members can only get their own (service enforces).
   */
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const location = await this.locationService.findById(id, currentUser);
    return { location };
  }

  /**
   * DELETE /api/v1/location/:id
   * Remove a log. Admin/Developer only. Returns 204.
   */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @HttpCode(204)
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.locationService.delete(id, currentUser);
  }
}
