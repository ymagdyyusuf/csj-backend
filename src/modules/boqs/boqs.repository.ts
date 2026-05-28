import { Injectable } from '@nestjs/common';
import { Boqs, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BoqsListFilter, CreateBoqsData } from './boqs.types';

export interface PaginationArgs {
  skip: number;
  take: number;
}

/**
 * BoqsRepository - the ONLY place Prisma touches Boqs records.
 *
 * Atomic deviceCount increments via Prisma's { increment: 1 } syntax
 * keep counter updates safe under concurrent device reports.
 */
@Injectable()
export class BoqsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Boqs | null> {
    return this.prisma.boqs.findUnique({
      where: { id },
    });
  }

  async list(
    filter: BoqsListFilter,
    pagination: PaginationArgs,
  ): Promise<Boqs[]> {
    return this.prisma.boqs.findMany({
      where: this.buildWhereClause(filter),
      orderBy: { sentAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  async count(filter: BoqsListFilter): Promise<number> {
    return this.prisma.boqs.count({
      where: this.buildWhereClause(filter),
    });
  }

  async create(data: CreateBoqsData): Promise<Boqs> {
    return this.prisma.boqs.create({
      data: {
        audioUrl: data.audioUrl,
        text: data.text,
        duration: data.duration,
        sentById: data.sentById,
      },
    });
  }

  async delete(id: string): Promise<Boqs> {
    return this.prisma.boqs.delete({
      where: { id },
    });
  }

  /**
   * Atomically increment deviceCount by 1.
   * Prisma's { increment: 1 } compiles to a single
   * UPDATE ... SET deviceCount = deviceCount + 1 statement,
   * which is race-safe under concurrent updates.
   */
  async incrementDeviceCount(id: string): Promise<Boqs> {
    return this.prisma.boqs.update({
      where: { id },
      data: { deviceCount: { increment: 1 } },
    });
  }

  private buildWhereClause(filter: BoqsListFilter): Prisma.BoqsWhereInput {
    const where: Prisma.BoqsWhereInput = {};

    if (filter.sentById !== undefined) where.sentById = filter.sentById;

    if (filter.from !== undefined || filter.to !== undefined) {
      where.sentAt = {};
      if (filter.from !== undefined) where.sentAt.gte = filter.from;
      if (filter.to !== undefined) where.sentAt.lte = filter.to;
    }

    return where;
  }
}
