import { Role } from '@prisma/client';

/**
 * Data baked inside every JWT access token.
 *
 * Standard JWT claims (iat, exp) are added automatically by @nestjs/jwt.
 * We only define the custom claims here.
 *
 * Security notes:
 * - `sub` is the User.id — never the username (usernames can be changed)
 * - `role` is the SOURCE OF TRUTH for authorization
 * - Never include sensitive data (password, tokens, secrets)
 * - Never include large data (slows every request)
 */
export interface JwtPayload {
  /** Subject: the User.id (cuid). Standard JWT claim. */
  sub: string;

  /** User's role (DEVELOPER | ADMIN | MEMBER). Read-only — never trust client-supplied role. */
  role: Role;

  /** Username for logging/debugging. NOT used for authorization. */
  username: string;

  /** When the token was issued (Unix timestamp). Set by @nestjs/jwt automatically. */
  iat?: number;

  /** When the token expires (Unix timestamp). Set by @nestjs/jwt automatically. */
  exp?: number;
}

/**
 * Data baked inside every refresh token.
 *
 * Refresh tokens have minimal data because they only do one thing:
 * prove the user is allowed to mint a new access token.
 */
export interface JwtRefreshPayload {
  /** Subject: the User.id (cuid). */
  sub: string;

  /** Token version — increments when user logs out everywhere or password changes. */
  tokenVersion: number;

  /** When issued. */
  iat?: number;

  /** When expires. */
  exp?: number;
}
