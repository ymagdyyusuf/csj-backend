import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by JwtAuthGuard to detect public endpoints.
 *
 * Exported so the guard can read it via Reflector.get(IS_PUBLIC_KEY, handler).
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks an endpoint as PUBLIC (no JWT required).
 *
 * Use sparingly — every endpoint should be authenticated by default.
 * Public endpoints are: /auth/login, /auth/register, /auth/refresh,
 * health checks, and the splash screen.
 *
 * Example:
 *   @Public()
 *   @Post('login')
 *   login(@Body() dto: LoginDto) { ... }
 *
 * @returns Decorator that sets IS_PUBLIC_KEY metadata to true
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
