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
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { BulkCreateAttendanceDto } from './dto/bulk-create-attendance.dto';
import { ListAttendanceQueryDto } from './dto/list-attendance-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * AttendanceController - HTTP layer for attendance.
 *
 * Writes (create, bulk, update, delete) are gated to ADMIN/DEVELOPER
 * via @Roles. Reads (list, getById) are open to any authenticated user;
 * the service clamps members to their own records.
 *
 * NOTE: the static "bulk" route is declared before the ":id" routes so
 * it is never mistaken for an id param.
 */
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * POST /api/v1/attendance
   * Mark a single attendance record. Admin/Developer only.
   */
  @Post()
  @Roles(Role.ADMIN, Role.DEVELOPER)
  async create(
    @Body() dto: CreateAttendanceDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const attendance = await this.attendanceService.create(dto, currentUser);
    return { attendance };
  }

  /**
   * POST /api/v1/attendance/bulk
   * Mark many records in one transaction. Admin/Developer only.
   */
  @Post('bulk')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  async createBulk(
    @Body() dto: BulkCreateAttendanceDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const attendance = await this.attendanceService.createBulk(
      dto,
      currentUser,
    );
    return { attendance, count: attendance.length };
  }

  /**
   * GET /api/v1/attendance
   * List records with filters. Members are clamped to their own.
   */
  @Get()
  async list(
    @Query() query: ListAttendanceQueryDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const filter = {
      memberId: query.memberId,
      scheduleId: query.scheduleId,
      eventId: query.eventId,
      type: query.type,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    };
    return this.attendanceService.list(filter, currentUser);
  }

  /**
   * GET /api/v1/attendance/:id
   * Get one record. Members can only get their own.
   */
  @Get(':id')
  async getById(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const attendance = await this.attendanceService.getById(id, currentUser);
    return { attendance };
  }

  /**
   * PATCH /api/v1/attendance/:id
   * Update a record (status/notes). Admin/Developer only.
   */
  @Patch(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const attendance = await this.attendanceService.update(
      id,
      dto,
      currentUser,
    );
    return { attendance };
  }

  /**
   * DELETE /api/v1/attendance/:id
   * Remove a record. Admin/Developer only. Returns 204.
   */
  @Delete(':id')
  @Roles(Role.ADMIN, Role.DEVELOPER)
  @HttpCode(204)
  async delete(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.attendanceService.delete(id, currentUser);
  }
}
