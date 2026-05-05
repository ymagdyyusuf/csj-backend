import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard — enforces role-based access control.
 *
 * Reads @Roles(...) metadata from the route and checks if the
 * authenticated user's role matches.
 *
 * Apply AFTER JwtAuthGuard (which attaches req.user). Order matters:
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(Role.DEVELOPER)
 *   @Get('feature-flags')
 *
 * If no @Roles() is present, all authenticated users pass.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no roles required = all authenticated users allowed
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      // Should be caught by JwtAuthGuard first, but defensive check
      throw new ForbiddenException('No authenticated user');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}
