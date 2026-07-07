import { PostType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query parameters for GET /wall/posts (the feed).
 */
export class ListPostsQueryDto {
  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsEnum(PostType, {
    message: 'type must be TEXT, IMAGE, VIDEO, DOCUMENT, LINK, or POLL',
  })
  type?: PostType;

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
