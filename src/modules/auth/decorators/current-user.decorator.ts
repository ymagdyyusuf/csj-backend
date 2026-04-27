import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from '../auth.types';

/**
 * Parameter decorator that extracts the authenticated user from the request.
 *
 * The JWT strategy attaches the user to req.user after validating the token.
 * This decorator pulls req.user out and types it as AuthenticatedUser.
 *
 * Use ONLY in endpoints protected by JwtAuthGuard (or routes that mark
 * @Public() but you still want to read the user IF they're authenticated).
 *
 * Examples:
 *   // Get the current user's profile
 *   @Get('me')
 *   getProfile(@CurrentUser() user: AuthenticatedUser) {
 *     return this.usersService.getProfile(user.id);
 *   }
 *
 *   // Only access a single property
 *   @Get('my-attendance')
 *   getMyAttendance(@CurrentUser('id') userId: string) {
 *     return this.attendanceService.findByMember(userId);
 *   }
 *
 * @param data       Optional property name to extract (e.g., 'id', 'role')
 * @param ctx        Execution context provided by NestJS
 * @returns The full user object, OR a single property if data is provided
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      // This should never happen if the route is protected by JwtAuthGuard.
      // If you see this error, you forgot to apply the guard.
      throw new Error(
        '@CurrentUser used on an unprotected route. Apply @UseGuards(JwtAuthGuard) or check route protection.',
      );
    }

    return data ? user[data] : user;
  },
);
