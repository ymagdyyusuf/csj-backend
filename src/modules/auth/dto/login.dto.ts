import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Login request body shape.
 *
 * Endpoint: POST /api/v1/auth/login
 *
 * Members can log in with either their username OR phone number.
 * The auth service tries username first, then phone.
 *
 * Validation rules:
 * - identifier: 3-30 chars (covers usernames and phone numbers)
 * - password: 8-128 chars (8 is industry minimum, 128 prevents DoS via huge inputs)
 */
export class LoginDto {
  /**
   * Username or phone number.
   * Examples: "ahmed_scout", "+201234567890"
   */
  @IsString({ message: 'Identifier must be a string' })
  @IsNotEmpty({ message: 'Identifier is required' })
  @MinLength(3, { message: 'Identifier must be at least 3 characters' })
  @MaxLength(30, { message: 'Identifier must not exceed 30 characters' })
  identifier!: string;

  /**
   * Plain-text password (will be compared against bcrypt hash server-side).
   * Never logged. Never stored. Never returned in responses.
   */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;
}
