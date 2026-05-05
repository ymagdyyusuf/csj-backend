import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './shared/prisma/prisma.module';
import { EventsModule } from './shared/events/events.module';
import { AuthModule } from './modules/auth/auth.module';

/**
 * Root application module.
 *
 * Wires up infrastructure (config, database, events, JWT) and
 * registers feature modules. Each new feature adds one line to imports.
 */
@Module({
  imports: [
    // Loads .env into process.env, available globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Database access
    PrismaModule,
    // Domain event bus
    EventsModule,
    // JWT signing/verification — registered globally so any module can inject JwtService
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
    // Auth feature module
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
