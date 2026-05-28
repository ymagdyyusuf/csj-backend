import { Injectable } from '@nestjs/common';
import { FeatureFlag } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateFlagData, UpdateFlagData } from './feature-flags.types';

/**
 * FeatureFlagsRepository - the ONLY place Prisma touches FeatureFlag records.
 *
 * Flags are identified by their unique `key` (e.g. "messaging"), not by id,
 * since the key is the stable public identifier used across the app.
 */
@Injectable()
export class FeatureFlagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return all flags, sorted alphabetically by key.
   */
  async findAll(): Promise<FeatureFlag[]> {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Find a single flag by its unique key.
   *
   * @returns The flag, or null if no match
   */
  async findByKey(key: string): Promise<FeatureFlag | null> {
    return this.prisma.featureFlag.findUnique({
      where: { key },
    });
  }

  /**
   * Create a new flag.
   * Service layer checks for duplicates before calling.
   */
  async create(data: CreateFlagData): Promise<FeatureFlag> {
    return this.prisma.featureFlag.create({
      data: {
        key: data.key,
        isEnabled: data.isEnabled,
        description: data.description,
      },
    });
  }

  /**
   * Update an existing flag by key.
   */
  async update(key: string, data: UpdateFlagData): Promise<FeatureFlag> {
    return this.prisma.featureFlag.update({
      where: { key },
      data,
    });
  }

  /**
   * Delete a flag by key.
   */
  async delete(key: string): Promise<FeatureFlag> {
    return this.prisma.featureFlag.delete({
      where: { key },
    });
  }
}
