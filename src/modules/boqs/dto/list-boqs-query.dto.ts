import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * Query parameters for GET /boqs.
 */
export class ListBoqsQueryDto {
  @IsOptional()
  @IsString()
  sentById?: string;

  @IsOptional()
  @IsDateString({}, { message: 'from must be a valid ISO date string' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to must be a valid ISO date string' })
  to?: string;

  @IsOptional()
  @IsInt({ message: 'page must be an integer' })
  @Min(1)
  @Transform(({ value }) => Number(value))
  page?: number;

  @IsOptional()
  @IsInt({ message: 'pageSize must be an integer' })
  @Min(1)
  @Max(100)
  @Transform(({ value }) => Number(value))
  pageSize?: number;
}
