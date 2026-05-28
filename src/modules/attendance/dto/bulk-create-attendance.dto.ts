import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreateAttendanceDto } from './create-attendance.dto';

/**
 * DTO for POST /attendance/bulk (mark many in one request).
 *
 * @ValidateNested + @Type tell class-validator to validate EACH item
 * in the array as a CreateAttendanceDto. Without @Type, nested objects
 * are not transformed into class instances and validation silently passes.
 */
export class BulkCreateAttendanceDto {
  @IsArray({ message: 'records must be an array' })
  @ArrayMinSize(1, { message: 'records must contain at least one entry' })
  @ArrayMaxSize(200, { message: 'records must not exceed 200 entries' })
  @ValidateNested({ each: true })
  @Type(() => CreateAttendanceDto)
  records!: CreateAttendanceDto[];
}
