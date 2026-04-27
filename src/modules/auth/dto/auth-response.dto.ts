import { Role } from '@prisma/client';

/**
 * Response shape for successful login or registration.
 *
 * Sent to client after:
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/refresh
 *
 * Security:
 * - accessToken is in body for mobile clients to store
 * - refreshToken is ALSO set as httpOnly cookie by the controller
 *   (the body refreshToken is for mobile-only flows)
 * - User object NEVER includes passwordHash, qrCode (private), or any sensitive field
 */
export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: AuthUserDto;
}

/**
 * Public-safe user view returned to clients.
 *
 * This is the SAFE shape — exclude sensitive fields like:
 * - passwordHash (never expose)
 * - qrCode (private to admin)
 * - phone (only show to user themselves)
 */
export class AuthUserDto {
  id!: string;
  uniqueId!: string;
  username!: string;
  role!: Role;
  language!: string;
  avatarUrl!: string | null;
}
