import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { MembersModule } from '../members/members.module';

/**
 * AttendanceModule - attendance marking + viewing.
 *
 * Imports MembersModule because AttendanceService uses MembersRepository
 * to validate that referenced members exist before marking attendance.
 */
@Module({
  imports: [MembersModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository],
  exports: [AttendanceService],
})
export class AttendanceModule {}
