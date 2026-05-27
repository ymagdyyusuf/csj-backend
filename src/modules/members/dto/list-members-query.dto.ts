import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';

/**
 * Query parameters for GET /members?role=...&isActive=...&search=...&page=1&pageSize=20
 *
 * @Transform decorators convert string query params to proper types.
 */
export class ListMembersQueryDto {
  @IsOptional()
  @IsEnum(Role, { message: 'Role must be DEVELOPER, ADMIN, or MEMBER' })
  role?: Role;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  @MaxLength(100, { message: 'Search must not exceed 100 characters' })
  search?: string;

  @IsOptional()
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @Transform(({ value }) => Number(value))
  page?: number;

  @IsOptional()
  @IsInt({ message: 'Page size must be an integer' })
  @Min(1, { message: 'Page size must be at least 1' })
  @Max(100, { message: 'Page size must not exceed 100' })
  @Transform(({ value }) => Number(value))
  pageSize?: number;
}
