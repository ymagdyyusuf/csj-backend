import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService wraps Prisma Client and integrates it into NestJS lifecycle.
 *
 * Connects to the database when the module starts and gracefully disconnects
 * when the module is destroyed. Available for dependency injection across
 * all modules via PrismaModule.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Called automatically by NestJS when the module starts.
   * Establishes the connection pool to PostgreSQL.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  /**
   * Called automatically by NestJS when the module is destroyed.
   * Closes all open database connections cleanly.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }
}
