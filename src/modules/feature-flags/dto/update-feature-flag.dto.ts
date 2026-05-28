import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for PATCH /feature-flags/:key (developer only).
 *
 * key itself is immutable (it's the identifier) - only isEnabled
 * and description can change.
 */
export class UpdateFeatureFlagDto {
  @IsOptional()
  @IsBoolean({ message: 'isEnabled must be a boolean' })
  isEnabled?: boolean;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(200, { message: 'Description must not exceed 200 characters' })
  description?: string;
}
