import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../auth.types';
import { JwtRefreshPayload } from '../interfaces/jwt-payload.interface';

/**
 * JWT Refresh Strategy — validates refresh tokens read from httpOnly cookie.
 *
 * Distinct from JwtStrategy because:
 * - Reads token from cookie (not Authorization header)
 * - Uses JWT_REFRESH_SECRET (not JWT_SECRET)
 * - Decodes JwtRefreshPayload (different shape than access token)
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is not set');
    }
    super({
      jwtFromRequest: (req: Request) => {
        if (
          req &&
          req.cookies &&
          typeof req.cookies.refresh_token === 'string'
        ) {
          return req.cookies.refresh_token;
        }
        return null;
      },
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called by Passport after refresh token signature is verified.
   *
   * Returns the user — but the controller's refresh() endpoint will
   * also issue new tokens itself.
   */
  async validate(payload: JwtRefreshPayload): Promise<AuthenticatedUser> {
    try {
      return await this.authService.validateUser({
        sub: payload.sub,
        role: 'MEMBER' as never, // role not in refresh payload, validateUser refetches anyway
        username: '', // not in refresh payload
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
