import { Role } from '@prisma/client';
import { DomainEvent } from '../../shared/events/event-bus.service';

/**
 * Auth module domain events.
 *
 * Per the Event Bus Rule: every completed action emits a typed event.
 * Other modules subscribe to react. AuthService never calls other
 * services directly.
 *
 * Naming convention: '<module>.<entity>.<action_past_tense>'
 */

/** Names of all events auth can emit. Use these as type-safe strings. */
export const AuthEventNames = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGGED_IN: 'auth.user.logged_in',
  USER_LOGGED_OUT: 'auth.user.logged_out',
  LOGIN_FAILED: 'auth.user.login_failed',
  TOKEN_REFRESHED: 'auth.token.refreshed',
  PASSWORD_CHANGED: 'auth.user.password_changed',
} as const;

/**
 * Fired after a new user account is created.
 * Listeners: ActivityLog, Notifications, AnalyticsService
 */
export interface UserRegisteredEvent extends DomainEvent {
  userId: string;
  username: string;
  role: Role;
  createdById: string | null; // null when self-registered, ID when admin-created
}

/**
 * Fired after a successful login.
 * Listeners: ActivityLog, AnalyticsService
 */
export interface UserLoggedInEvent extends DomainEvent {
  userId: string;
  username: string;
  role: Role;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Fired when login fails (wrong password, banned account, etc.).
 * Listeners: SecurityMonitor, RateLimiter
 */
export interface LoginFailedEvent extends DomainEvent {
  username: string; // attempted username
  reason: 'WRONG_PASSWORD' | 'USER_NOT_FOUND' | 'ACCOUNT_DISABLED';
  ipAddress: string | null;
}

/**
 * Fired after explicit logout.
 * Listeners: ActivityLog
 */
export interface UserLoggedOutEvent extends DomainEvent {
  userId: string;
}

/**
 * Fired when an access token is refreshed via refresh token.
 * Listeners: ActivityLog (low priority), AnalyticsService
 */
export interface TokenRefreshedEvent extends DomainEvent {
  userId: string;
}

/**
 * Fired when a user changes their password (or admin resets it).
 * Listeners: ActivityLog, Notifications (email user)
 */
export interface PasswordChangedEvent extends DomainEvent {
  userId: string;
  changedById: string; // self if user changed own, admin id if admin reset
}
