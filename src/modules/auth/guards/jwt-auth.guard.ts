import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JwtAuthGuard — primary authentication gate.
 *
 * - Reads @Public() metadata: if present, skips auth (login/register/refresh routes)
 * - Otherwise, runs the JwtStrategy to verify the access token
 * - Attaches the validated user to req.user
 *
 * Apply this as a global guard in AuthModule (Phase K) so EVERY endpoint
 * requires authentication by default. Endpoints opt out with @Public().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if the route (or its containing class) has @Public() metadata
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true; // skip authentication
    }

    return super.canActivate(context);
  }
}
