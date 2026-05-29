import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationLog, Role } from '@prisma/client';
import { LocationRepository } from './location.repository';
import { CreateLocationDto } from './dto/create-location.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  LocationListFilter,
  LocationView,
  MIN_PING_INTERVAL_SECONDS,
  PaginatedResult,
  PAGINATION_DEFAULTS,
} from './location.types';

/**
 * LocationService - GPS log management with throttling + role-based reads.
 *
 * Authorization:
 *  - create: any authenticated user (memberId is forced to currentUser.id)
 *  - list / findById: admins see all, members see only their own
 *  - findCurrent (admin roster): ADMIN/DEVELOPER only
 *  - delete: ADMIN/DEVELOPER only
 *
 * Throttle: reject new pings if the last one for this member was less
 * than MIN_PING_INTERVAL_SECONDS (60s) ago. Protects the DB from being
 * flooded by chatty clients.
 */
@Injectable()
export class LocationService {
  constructor(private readonly repository: LocationRepository) {}

  // ============================================================
  // create
  // ============================================================
  async create(
    dto: CreateLocationDto,
    currentUser: AuthenticatedUser,
  ): Promise<LocationView> {
    // Throttle check FIRST so we fail fast without an unnecessary insert
    const lastLog = await this.repository.findMostRecentByMember(
      currentUser.id,
    );
    if (lastLog) {
      const elapsedMs = Date.now() - lastLog.recordedAt.getTime();
      const minIntervalMs = MIN_PING_INTERVAL_SECONDS * 1000;
      if (elapsedMs < minIntervalMs) {
        const waitSeconds = Math.ceil((minIntervalMs - elapsedMs) / 1000);
        throw new HttpException(
          `Too many location pings. Try again in ${waitSeconds}s.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const created = await this.repository.create({
      memberId: currentUser.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy,
    });

    return this.toView(created);
  }

  // ============================================================
  // list
  // ============================================================
  async list(
    filter: LocationListFilter,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<LocationView>> {
    // Members are clamped to their own records
    const effectiveFilter: LocationListFilter = { ...filter };
    if (!this.isPrivileged(currentUser)) {
      effectiveFilter.memberId = currentUser.id;
    }

    const page = effectiveFilter.page ?? PAGINATION_DEFAULTS.PAGE;
    const pageSize = Math.min(
      effectiveFilter.pageSize ?? PAGINATION_DEFAULTS.PAGE_SIZE,
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      this.repository.list(effectiveFilter, { skip, take: pageSize }),
      this.repository.count(effectiveFilter),
    ]);

    return {
      items: logs.map((l) => this.toView(l)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ============================================================
  // findCurrent (admin roster view)
  // ============================================================
  async findCurrent(currentUser: AuthenticatedUser): Promise<LocationView[]> {
    if (!this.isPrivileged(currentUser)) {
      throw new ForbiddenException('Only admins can view the live roster');
    }
    const logs = await this.repository.findCurrentForAllMembers();
    return logs.map((l) => this.toView(l));
  }

  // ============================================================
  // findById
  // ============================================================
  async findById(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<LocationView> {
    const log = await this.repository.findById(id);
    if (!log) {
      throw new NotFoundException('Location log not found');
    }

    // Members can only access their own logs
    if (!this.isPrivileged(currentUser) && log.memberId !== currentUser.id) {
      throw new ForbiddenException(
        'You can only access your own location logs',
      );
    }

    return this.toView(log);
  }

  // ============================================================
  // delete
  // ============================================================
  async delete(id: string, currentUser: AuthenticatedUser): Promise<void> {
    if (!this.isPrivileged(currentUser)) {
      throw new ForbiddenException('Only admins can delete location logs');
    }

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Location log not found');
    }

    await this.repository.delete(id);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private isPrivileged(user: AuthenticatedUser): boolean {
    return user.role === Role.ADMIN || user.role === Role.DEVELOPER;
  }

  private toView(log: LocationLog): LocationView {
    return {
      id: log.id,
      memberId: log.memberId,
      latitude: log.latitude,
      longitude: log.longitude,
      accuracy: log.accuracy,
      recordedAt: log.recordedAt,
    };
  }
}
