import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query parameters for GET /wall/posts/:id/comments.
 * The postId is a route param, not a query filter.
 */
export class ListCommentsQueryDto {
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
