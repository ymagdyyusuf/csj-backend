import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Attendance, Role } from '@prisma/client';
import { AttendanceRepository } from './attendance.repository';
import { MembersRepository } from '../members/members.repository';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { BulkCreateAttendanceDto } from './dto/bulk-create-attendance.dto';
import {
  AttendanceListFilter,
  AttendanceView,
  CreateAttendanceData,
  PaginatedResult,
  PAGINATION_DEFAULTS,
  UpdateAttendanceData,
} from './attendance.types';

/**
 * AttendanceService - business logic + authorization for attendance.
 *
 * Authorization:
 *  - reads (list, getById): admins/devs see all; members see only their own
 *  - writes (create, bulk, update, delete): admins/devs only
 *
 * Validation:
 *  - every referenced member must exist (404 otherwise)
 *  - bulk is all-or-nothing: if any member is missing, nothing is created
 *
 * Security:
 *  - markedById is always set from the authenticated user, never the client
 */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly membersRepo: MembersRepository,
  ) {}

  // ============================================================
  // create (single)
  // ============================================================
  async create(
    dto: CreateAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceView> {
    this.assertPrivileged(currentUser);

    await this.assertMemberExists(dto.memberId);

    const data: CreateAttendanceData = {
      memberId: dto.memberId,
      scheduleId: dto.scheduleId,
      eventId: dto.eventId,
      type: dto.type,
      status: dto.status,
      date: new Date(dto.date),
      markedById: currentUser.id,
      isOffline: dto.isOffline,
      syncStatus: dto.syncStatus,
      syncedAt: dto.syncedAt ? new Date(dto.syncedAt) : undefined,
      notes: dto.notes,
    };

    const record = await this.attendanceRepo.create(data);
    return this.toView(record);
  }

  // ============================================================
  // createBulk (all-or-nothing)
  // ============================================================
  async createBulk(
    dto: BulkCreateAttendanceDto,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceView[]> {
    this.assertPrivileged(currentUser);

    if (!dto.records || dto.records.length === 0) {
      throw new BadRequestException(
        'Bulk request must contain at least one record',
      );
    }

    // Validate ALL members exist before creating anything
    for (const record of dto.records) {
      await this.assertMemberExists(record.memberId);
    }

    const data: CreateAttendanceData[] = dto.records.map((r) => ({
      memberId: r.memberId,
      scheduleId: r.scheduleId,
      eventId: r.eventId,
      type: r.type,
      status: r.status,
      date: new Date(r.date),
      markedById: currentUser.id,
      isOffline: r.isOffline,
      syncStatus: r.syncStatus,
      syncedAt: r.syncedAt ? new Date(r.syncedAt) : undefined,
      notes: r.notes,
    }));

    const records = await this.attendanceRepo.createMany(data);
    return records.map((rec) => this.toView(rec));
  }

  // ============================================================
  // list
  // ============================================================
  async list(
    filter: AttendanceListFilter,
    currentUser: AuthenticatedUser,
  ): Promise<PaginatedResult<AttendanceView>> {
    // Members can only see their own records - clamp the filter
    const effectiveFilter: AttendanceListFilter = { ...filter };
    if (!this.isPrivileged(currentUser)) {
      effectiveFilter.memberId = currentUser.id;
    }

    const page = effectiveFilter.page ?? PAGINATION_DEFAULTS.PAGE;
    const pageSize = Math.min(
      effectiveFilter.pageSize ?? PAGINATION_DEFAULTS.PAGE_SIZE,
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      this.attendanceRepo.list(effectiveFilter, { skip, take: pageSize }),
      this.attendanceRepo.count(effectiveFilter),
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
  // getById
  // ============================================================
  async getById(
    id: string,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceView> {
    const record = await this.attendanceRepo.findById(id);
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    // Members can only access their own records
    if (!this.isPrivileged(currentUser) && record.memberId !== currentUser.id) {
      throw new ForbiddenException('You can only access your own attendance');
    }

    return this.toView(record);
  }

  // ============================================================
  // update
  // ============================================================
  async update(
    id: string,
    data: UpdateAttendanceData,
    currentUser: AuthenticatedUser,
  ): Promise<AttendanceView> {
    this.assertPrivileged(currentUser);

    const existing = await this.attendanceRepo.findById(id);
    if (!existing) {
      throw new NotFoundException('Attendance record not found');
    }

    const updated = await this.attendanceRepo.update(id, data);
    return this.toView(updated);
  }

  // ============================================================
  // delete
  // ============================================================
  async delete(id: string, currentUser: AuthenticatedUser): Promise<void> {
    this.assertPrivileged(currentUser);

    const existing = await this.attendanceRepo.findById(id);
    if (!existing) {
      throw new NotFoundException('Attendance record not found');
    }

    await this.attendanceRepo.delete(id);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private isPrivileged(user: AuthenticatedUser): boolean {
    return user.role === Role.ADMIN || user.role === Role.DEVELOPER;
  }

  private assertPrivileged(user: AuthenticatedUser): void {
    if (!this.isPrivileged(user)) {
      throw new ForbiddenException('Only admins can manage attendance');
    }
  }

  private async assertMemberExists(memberId: string): Promise<void> {
    const member = await this.membersRepo.findById(memberId);
    if (!member) {
      throw new NotFoundException(`Member '${memberId}' not found`);
    }
  }

  private toView(record: Attendance): AttendanceView {
    return {
      id: record.id,
      memberId: record.memberId,
      scheduleId: record.scheduleId,
      eventId: record.eventId,
      type: record.type,
      status: record.status,
      date: record.date,
      markedById: record.markedById,
      isOffline: record.isOffline,
      syncStatus: record.syncStatus,
      syncedAt: record.syncedAt,
      notes: record.notes,
      createdAt: record.createdAt,
    };
  }
}
