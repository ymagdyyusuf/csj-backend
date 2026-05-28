import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for POST /feature-flags (developer only).
 *
 * key: lowercase letters, numbers, hyphens, underscores (e.g. "messaging", "events-v2").
 */
export class CreateFeatureFlagDto {
  @IsString({ message: 'Key must be a string' })
  @MinLength(2, { message: 'Key must be at least 2 characters' })
  @MaxLength(60, { message: 'Key must not exceed 60 characters' })
  @Matches(/^[a-z0-9_-]+$/, {
    message: 'Key must be lowercase letters, numbers, hyphens, or underscores',
  })
  key!: string;

  @IsOptional()
  @IsBoolean({ message: 'isEnabled must be a boolean' })
  isEnabled?: boolean;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(200, { message: 'Description must not exceed 200 characters' })
  description?: string;
}
