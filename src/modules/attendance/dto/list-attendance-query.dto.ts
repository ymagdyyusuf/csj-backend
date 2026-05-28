import { AttendanceStatus, AttendanceType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Query parameters for GET /attendance.
 * @Transform converts string query params to numbers where needed.
 */
export class ListAttendanceQueryDto {
  @IsOptional()
  @IsString()
  memberId?: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsEnum(AttendanceType, {
    message: 'type must be SCHEDULE, EVENT, CAMP, or TRIP',
  })
  type?: AttendanceType;

  @IsOptional()
  @IsEnum(AttendanceStatus, {
    message: 'status must be PRESENT, ABSENT, LATE, EXCUSED, or NEUTRAL',
  })
  status?: AttendanceStatus;

  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO date string' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO date string' })
  to?: string;

  @IsOptional()
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @Transform(({ value }) => Number(value))
  page?: number;

  @IsOptional()
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(100, { message: 'pageSize must not exceed 100' })
  @Transform(({ value }) => Number(value))
  pageSize?: number;
}
