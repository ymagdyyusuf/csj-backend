import { Injectable } from '@nestjs/common';
import { LocationLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateLocationData, LocationListFilter } from './location.types';

export interface PaginationArgs {
  skip: number;
  take: number;
}

/**
 * LocationRepository - the ONLY place Prisma touches LocationLog records.
 *
 * findCurrentForAllMembers uses a raw query for SQL's DISTINCT ON, which is
 * the cleanest way to get "the most recent row per member" in one trip.
 */
@Injectable()
export class LocationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<LocationLog | null> {
    return this.prisma.locationLog.findUnique({
      where: { id },
    });
  }

  /**
   * Most recent log for a single member - used by the throttle check.
   */
  async findMostRecentByMember(memberId: string): Promise<LocationLog | null> {
    return this.prisma.locationLog.findFirst({
      where: { memberId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async list(
    filter: LocationListFilter,
    pagination: PaginationArgs,
  ): Promise<LocationLog[]> {
    return this.prisma.locationLog.findMany({
      where: this.buildWhereClause(filter),
      orderBy: { recordedAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  async count(filter: LocationListFilter): Promise<number> {
    return this.prisma.locationLog.count({
      where: this.buildWhereClause(filter),
    });
  }

  /**
   * Latest log for every member who has at least one log.
   * Uses Postgres DISTINCT ON for an efficient single-query roster view.
   *
   * NOTE: Prisma column names are quoted because Postgres lowercases
   * unquoted identifiers - and our model uses camelCase columns.
   */
  async findCurrentForAllMembers(): Promise<LocationLog[]> {
    return this.prisma.$queryRaw<LocationLog[]>`
      SELECT DISTINCT ON ("memberId") *
      FROM "LocationLog"
      ORDER BY "memberId", "recordedAt" DESC
    `;
  }

  async create(data: CreateLocationData): Promise<LocationLog> {
    return this.prisma.locationLog.create({
      data: {
        memberId: data.memberId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
      },
    });
  }

  async delete(id: string): Promise<LocationLog> {
    return this.prisma.locationLog.delete({
      where: { id },
    });
  }

  private buildWhereClause(
    filter: LocationListFilter,
  ): Prisma.LocationLogWhereInput {
    const where: Prisma.LocationLogWhereInput = {};

    if (filter.memberId !== undefined) where.memberId = filter.memberId;

    if (filter.from !== undefined || filter.to !== undefined) {
      where.recordedAt = {};
      if (filter.from !== undefined) where.recordedAt.gte = filter.from;
      if (filter.to !== undefined) where.recordedAt.lte = filter.to;
    }

    return where;
  }
}
