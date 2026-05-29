import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * DTO for POST /location.
 *
 * The CLIENT does NOT send memberId - that comes from @CurrentUser()
 * in the controller. This prevents anyone from logging coordinates
 * under someone else's account.
 */
export class CreateLocationDto {
  @IsLatitude({ message: 'latitude must be between -90 and 90' })
  latitude!: number;

  @IsLongitude({ message: 'longitude must be between -180 and 180' })
  longitude!: number;

  @IsOptional()
  @IsNumber({}, { message: 'accuracy must be a number' })
  @Min(0, { message: 'accuracy must not be negative' })
  accuracy?: number;
}
