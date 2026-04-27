import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Metadata key used by RolesGuard to read required roles for an endpoint.
 *
 * Exported so the guard can read it via Reflector.get(ROLES_KEY, handler).
 */
export const ROLES_KEY = 'roles';

/**
 * Marks an endpoint with the roles allowed to access it.
 *
 * Used together with JwtAuthGuard + RolesGuard. The JWT guard validates
 * the token and attaches the user; the RolesGuard then checks if the
 * user's role is in the allowed list.
 *
 * Examples:
 *   // Only developers can toggle feature flags
 *   @Roles(Role.DEVELOPER)
 *   @Patch('feature-flags/:key')
 *
 *   // Both admins and developers can manage members
 *   @Roles(Role.ADMIN, Role.DEVELOPER)
 *   @Post('members')
 *
 * If @Roles() is not present on an endpoint, all authenticated users
 * are allowed (Member, Admin, Developer all pass).
 *
 * @param roles  One or more roles allowed to access this endpoint
 * @returns Decorator that sets ROLES_KEY metadata to the role array
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
