import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

/**
 * Refresh token request body shape.
 *
 * Endpoint: POST /api/v1/auth/refresh
 *
 * Note: The refresh token can be sent two ways:
 * 1. As an httpOnly cookie (preferred for web — XSS-safe)
 * 2. In the request body (for mobile clients that can't use cookies)
 *
 * The auth controller checks both. This DTO is the body version.
 */
export class RefreshTokenDto {
  /**
   * The refresh token string (JWT format).
   * Validated by @IsJWT() to reject malformed tokens early.
   */
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  @IsJWT({ message: 'Refresh token must be a valid JWT' })
  refreshToken!: string;
}
