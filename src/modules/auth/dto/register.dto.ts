import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Registration request body shape.
 *
 * Endpoint: POST /api/v1/auth/register
 *
 * Per the security spec, NEW USERS DEFAULT TO MEMBER ROLE ALWAYS.
 * Role cannot be set during self-registration. To create an Admin or
 * Developer, use POST /api/v1/auth/register-admin (DEVELOPER-only endpoint).
 *
 * Notice: NO 'role' field here. Even if a client sends `role`, the
 * global validation pipe strips it (whitelist: true). Defense in depth.
 *
 * Validation rules align with Egyptian phone format and scout-friendly usernames.
 */
export class RegisterDto {
  /**
   * Public username. Must be unique. Used for login.
   */
  @IsString({ message: 'Username must be a string' })
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Username can only contain letters, numbers, underscore, and hyphen',
  })
  username!: string;

  /**
   * Phone number in international format. Used for login + emergency contact.
   * Example: +201234567890
   */
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^\+\d{10,15}$/, {
    message: 'Phone must be in international format, e.g., +201234567890',
  })
  phone!: string;

  /**
   * Password. Hashed with bcrypt (cost factor 12) before storage.
   *
   * Strength requirements:
   * - Minimum 8 characters
   * - Must contain at least one letter and one number
   *
   * NOTE: Symbol/uppercase requirements are intentionally NOT enforced.
   * Modern security guidance (NIST SP 800-63B) recommends length over complexity.
   */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password!: string;
}
