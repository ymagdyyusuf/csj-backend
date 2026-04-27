import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';

/**
 * EventsModule provides the typed EventBusService to the entire application.
 *
 * Imports the underlying @nestjs/event-emitter and exposes our typed
 * wrapper. Global so any module can publish or subscribe.
 */
@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
