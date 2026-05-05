import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * AuthModule — wires together every piece of the authentication system.
 *
 * Architecture:
 *  - Imports: PassportModule (for strategy registration), ThrottlerModule (for rate limiting)
 *  - Controllers: AuthController (5 HTTP endpoints)
 *  - Providers: AuthService, AuthRepository, JwtStrategy, JwtRefreshStrategy
 *  - Global guard: JwtAuthGuard runs on EVERY request app-wide
 *      → @Public() decorator opts out (login, register, refresh, logout)
 *
 * Note: JwtModule is registered globally in AppModule, so any module
 * (including this one) can inject JwtService without re-importing.
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute window
        limit: 10, // 10 requests per minute (auth endpoints are sensitive)
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    JwtStrategy,
    JwtRefreshStrategy,
    // Make JwtAuthGuard global — every endpoint requires auth by default
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
