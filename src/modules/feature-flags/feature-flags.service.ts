import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureFlag, Role } from '@prisma/client';
import { FeatureFlagsRepository } from './feature-flags.repository';
import {
  CreateFlagData,
  FeatureFlagView,
  UpdateFlagData,
} from './feature-flags.types';
import { AuthenticatedUser } from '../auth/auth.types';

/**
 * FeatureFlagsService - business logic + authorization for feature flags.
 *
 * Authorization:
 *  - findAll / findByKey: any authenticated user (the app reads flags to
 *    decide which features to show)
 *  - create / update / delete: DEVELOPER only
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly repository: FeatureFlagsRepository) {}

  // ============================================================
  // READS - any authenticated user
  // ============================================================

  async findAll(): Promise<FeatureFlagView[]> {
    const flags = await this.repository.findAll();
    return flags.map((f) => this.toView(f));
  }

  async findByKey(key: string): Promise<FeatureFlagView> {
    const flag = await this.repository.findByKey(key);
    if (!flag) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }
    return this.toView(flag);
  }

  // ============================================================
  // WRITES - developer only
  // ============================================================

  async create(
    data: CreateFlagData,
    currentUser: AuthenticatedUser,
  ): Promise<FeatureFlagView> {
    this.assertDeveloper(currentUser);

    const existing = await this.repository.findByKey(data.key);
    if (existing) {
      throw new ConflictException(`Feature flag '${data.key}' already exists`);
    }

    const flag = await this.repository.create(data);
    return this.toView(flag);
  }

  async update(
    key: string,
    data: UpdateFlagData,
    currentUser: AuthenticatedUser,
  ): Promise<FeatureFlagView> {
    this.assertDeveloper(currentUser);

    const existing = await this.repository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }

    const flag = await this.repository.update(key, data);
    return this.toView(flag);
  }

  async delete(key: string, currentUser: AuthenticatedUser): Promise<void> {
    this.assertDeveloper(currentUser);

    const existing = await this.repository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Feature flag '${key}' not found`);
    }

    await this.repository.delete(key);
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private assertDeveloper(user: AuthenticatedUser): void {
    if (user.role !== Role.DEVELOPER) {
      throw new ForbiddenException('Only developers can modify feature flags');
    }
  }

  private toView(flag: FeatureFlag): FeatureFlagView {
    return {
      id: flag.id,
      key: flag.key,
      isEnabled: flag.isEnabled,
      description: flag.description,
      updatedAt: flag.updatedAt,
    };
  }
}
