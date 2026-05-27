import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for PATCH /members/:id requests.
 *
 * All fields optional. Service layer enforces:
 *  - Members can only edit their own language/avatarUrl
 *  - Admins/Developers can edit username/phone/language/avatarUrl/isActive
 *  - Only Developers can change role
 */
export class UpdateMemberDto {
  @IsOptional()
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  username?: string;

  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Phone must be a valid number' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'Language must be a string' })
  @Matches(/^(ar|en|fr)$/, { message: 'Language must be ar, en, or fr' })
  language?: string;

  @IsOptional()
  @IsString({ message: 'Avatar URL must be a string' })
  @MaxLength(500, { message: 'Avatar URL must not exceed 500 characters' })
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsEnum(Role, { message: 'Role must be DEVELOPER, ADMIN, or MEMBER' })
  role?: Role;
}
