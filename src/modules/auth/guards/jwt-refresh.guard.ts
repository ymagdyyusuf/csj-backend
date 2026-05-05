import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtRefreshGuard — guards endpoints that require a valid refresh token.
 *
 * Reads the refresh_token cookie, runs JwtRefreshStrategy to verify.
 *
 * Note: Currently the AuthController.refresh() reads the cookie directly
 * via @Cookies(). This guard is provided for consistency and could be
 * applied later for stricter validation.
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
