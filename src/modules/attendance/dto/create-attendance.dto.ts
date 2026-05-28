import { AttendanceStatus, AttendanceType, SyncStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * DTO for POST /attendance (single record).
 *
 * markedById is NOT here - it's taken from the authenticated user
 * to prevent forging who marked the record.
 */
export class CreateAttendanceDto {
  @IsString({ message: 'memberId must be a string' })
  memberId!: string;

  @IsOptional()
  @IsString({ message: 'scheduleId must be a string' })
  scheduleId?: string;

  @IsOptional()
  @IsString({ message: 'eventId must be a string' })
  eventId?: string;

  @IsEnum(AttendanceType, {
    message: 'type must be SCHEDULE, EVENT, CAMP, or TRIP',
  })
  type!: AttendanceType;

  @IsEnum(AttendanceStatus, {
    message: 'status must be PRESENT, ABSENT, LATE, EXCUSED, or NEUTRAL',
  })
  status!: AttendanceStatus;

  @IsDateString({}, { message: 'date must be a valid ISO date string' })
  date!: string;

  @IsOptional()
  @IsBoolean({ message: 'isOffline must be a boolean' })
  isOffline?: boolean;

  @IsOptional()
  @IsEnum(SyncStatus, {
    message: 'syncStatus must be PENDING, SYNCED, or FAILED',
  })
  syncStatus?: SyncStatus;

  @IsOptional()
  @IsDateString({}, { message: 'syncedAt must be a valid ISO date string' })
  syncedAt?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;
}
