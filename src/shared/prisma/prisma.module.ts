import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule provides the PrismaService to the entire application.
 *
 * Marked @Global so any module can inject PrismaService without
 * explicitly importing PrismaModule. This is the only module we make
 * global — everything else follows strict module-scoped dependency injection.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
