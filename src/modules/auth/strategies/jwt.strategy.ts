import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { AuthenticatedUser } from '../auth.types';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * JWT Strategy — validates access tokens on protected endpoints.
 *
 * Flow:
 * 1. Passport extracts the JWT from the Authorization header
 * 2. Verifies the signature using JWT_SECRET
 * 3. Decodes the payload
 * 4. Calls our validate() method with the payload
 * 5. Whatever validate() returns is attached to req.user
 *
 * Used together with @UseGuards(JwtAuthGuard) on protected routes.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Called by Passport after token signature is verified.
   *
   * We call authService.validateUser() to:
   * - Confirm the user still exists (token might reference deleted user)
   * - Confirm the user is still active (admin can disable accounts)
   *
   * Whatever we return becomes req.user, accessible via @CurrentUser().
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    try {
      return await this.authService.validateUser(payload);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
