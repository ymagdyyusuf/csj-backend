import { Role } from '@prisma/client';

/**
 * Internal types used by the auth module.
 *
 * These types are NOT exposed via API responses or stored in JWTs.
 * They live inside services and repositories only.
 */

/**
 * The clean, public-safe view of a user — without the password hash
 * or other sensitive fields. This is what AuthService returns from
 * validateCredentials() and what's used for token generation.
 *
 * Never return raw Prisma User from a service. Always map to this shape first.
 */
export interface AuthenticatedUser {
  id: string;
  uniqueId: string;
  username: string;
  phone: string;
  role: Role;
  isActive: boolean;
  language: string;
}

/**
 * Result of a successful login or registration.
 *
 * The access token is short-lived (15 min) and used in the Authorization header.
 * The refresh token is longer-lived (7 days) and stored in an httpOnly cookie.
 *
 * Note: Access token is returned in the response body so the client (mobile app)
 * can store it. Refresh token MUST go via httpOnly cookie — NEVER expose it to JS.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Token expiry settings (in seconds).
 * Matches the security spec:
 * - Access: 15 minutes
 * - Refresh: 7 days
 */
export const TOKEN_EXPIRY = {
  ACCESS_TOKEN_SECONDS: 15 * 60, // 900 seconds = 15 minutes
  REFRESH_TOKEN_SECONDS: 7 * 24 * 60 * 60, // 604_800 seconds = 7 days
} as const;

/**
 * bcrypt cost factor.
 * Higher = more secure but slower. Industry standard for 2026 = 12.
 * 12 ≈ 250ms per hash, which is the right balance for login UX.
 *
 * NEVER reduce below 10. NEVER store passwords plaintext.
 */
export const BCRYPT_COST_FACTOR = 12;
