/**
 * Public-safe view of a feature flag returned to clients.
 */
export interface FeatureFlagView {
  id: string;
  key: string;
  isEnabled: boolean;
  description: string | null;
  updatedAt: Date;
}

/**
 * Data accepted when creating a new flag.
 */
export interface CreateFlagData {
  key: string;
  isEnabled?: boolean;
  description?: string;
}

/**
 * Data accepted when updating an existing flag.
 */
export interface UpdateFlagData {
  isEnabled?: boolean;
  description?: string;
}
