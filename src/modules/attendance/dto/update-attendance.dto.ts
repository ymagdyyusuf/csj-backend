import { AttendanceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for PATCH /attendance/:id.
 * Only status and notes are editable after creation.
 */
export class UpdateAttendanceDto {
  @IsOptional()
  @IsEnum(AttendanceStatus, {
    message: 'status must be PRESENT, ABSENT, LATE, EXCUSED, or NEUTRAL',
  })
  status?: AttendanceStatus;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;
}
