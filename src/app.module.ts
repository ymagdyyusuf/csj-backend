import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './shared/prisma/prisma.module';
import { EventsModule } from './shared/events/events.module';

/**
 * Root application module.
 *
 * Wires up all infrastructure (config, database, event bus) and
 * registers feature modules. Each new feature adds one line to `imports`.
 */
@Module({
  imports: [
    // Loads .env into process.env, available globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Database access (PrismaService)
    PrismaModule,
    // Domain event bus
    EventsModule,
    // Feature modules will be added here as we build them
    // AuthModule, MembersModule, AttendanceModule, ...
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
