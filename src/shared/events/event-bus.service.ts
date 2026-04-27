import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Typed event payload base. All domain events extend this.
 */
export interface DomainEvent {
  /** When the event occurred (always UTC). */
  occurredAt: Date;
}

/**
 * EventBusService is the single point for cross-module communication.
 *
 * Per Clean Architecture rules: modules NEVER call each other directly.
 * Instead, completed actions emit typed events. Other modules listen.
 *
 * Pattern:
 *   eventBus.emit('attendance.marked', { memberId, status, scheduleId, occurredAt });
 *
 * Adding a feature = adding a listener. Original code is never modified.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  /**
   * Emit a domain event. The payload type is enforced by callers.
   *
   * @param eventName  Format: 'module.action' (e.g., 'auth.user.logged_in')
   * @param payload    Typed payload extending DomainEvent
   */
  emit<T extends DomainEvent>(eventName: string, payload: T): void {
    this.logger.debug(`Event emitted: ${eventName}`);
    this.emitter.emit(eventName, payload);
  }

  /**
   * Subscribe to a domain event. Used by listener modules.
   *
   * @param eventName  Event name to listen for
   * @param handler    Function called when event fires
   */
  on<T extends DomainEvent>(
    eventName: string,
    handler: (payload: T) => void | Promise<void>,
  ): void {
    this.emitter.on(eventName, handler);
  }
}
