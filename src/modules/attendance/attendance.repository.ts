import { Injectable } from '@nestjs/common';
import { Attendance, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  AttendanceListFilter,
  CreateAttendanceData,
  UpdateAttendanceData,
} from './attendance.types';

export interface PaginationArgs {
  skip: number;
  take: number;
}

/**
 * AttendanceRepository - the ONLY place Prisma touches Attendance records.
 *
 * Handles relations (member, schedule, event), date-range filtering,
 * and transactional bulk creation (all-or-nothing).
 */
@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Attendance | null> {
    return this.prisma.attendance.findUnique({
      where: { id },
    });
  }

  async list(
    filter: AttendanceListFilter,
    pagination: PaginationArgs,
  ): Promise<Attendance[]> {
    return this.prisma.attendance.findMany({
      where: this.buildWhereClause(filter),
      orderBy: { date: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  async count(filter: AttendanceListFilter): Promise<number> {
    return this.prisma.attendance.count({
      where: this.buildWhereClause(filter),
    });
  }

  async create(data: CreateAttendanceData): Promise<Attendance> {
    return this.prisma.attendance.create({
      data: this.toCreateInput(data),
    });
  }

  /**
   * Create many records in a single transaction.
   * If any insert fails, the whole batch rolls back (all-or-nothing).
   */
  async createMany(records: CreateAttendanceData[]): Promise<Attendance[]> {
    return this.prisma.$transaction(
      records.map((r) =>
        this.prisma.attendance.create({
          data: this.toCreateInput(r),
        }),
      ),
    );
  }

  async update(id: string, data: UpdateAttendanceData): Promise<Attendance> {
    return this.prisma.attendance.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Attendance> {
    return this.prisma.attendance.delete({
      where: { id },
    });
  }

  /**
   * Map our domain CreateAttendanceData onto Prisma's create input.
   */
  private toCreateInput(
    data: CreateAttendanceData,
  ): Prisma.AttendanceUncheckedCreateInput {
    return {
      memberId: data.memberId,
      scheduleId: data.scheduleId,
      eventId: data.eventId,
      type: data.type,
      status: data.status,
      date: data.date,
      markedById: data.markedById,
      isOffline: data.isOffline,
      syncStatus: data.syncStatus,
      syncedAt: data.syncedAt,
      notes: data.notes,
    };
  }

  /**
   * Build a Prisma WHERE clause from the filter.
   * Date range maps to { date: { gte: from, lte: to } }.
   */
  private buildWhereClause(
    filter: AttendanceListFilter,
  ): Prisma.AttendanceWhereInput {
    const where: Prisma.AttendanceWhereInput = {};

    if (filter.memberId !== undefined) where.memberId = filter.memberId;
    if (filter.scheduleId !== undefined) where.scheduleId = filter.scheduleId;
    if (filter.eventId !== undefined) where.eventId = filter.eventId;
    if (filter.type !== undefined) where.type = filter.type;
    if (filter.status !== undefined) where.status = filter.status;

    if (filter.from !== undefined || filter.to !== undefined) {
      where.date = {};
      if (filter.from !== undefined) where.date.gte = filter.from;
      if (filter.to !== undefined) where.date.lte = filter.to;
    }

    return where;
  }
}
