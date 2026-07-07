import { PostType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Structure for a poll option (nested inside CreatePostDto).
 */
export class PollOptionDto {
  @IsString({ message: 'poll option label must be a string' })
  @MinLength(1, { message: 'poll option label is required' })
  @MaxLength(120, {
    message: 'poll option label must not exceed 120 characters',
  })
  label!: string;
}

/**
 * DTO for POST /wall/posts.
 *
 * Media (IMAGE, VIDEO, DOCUMENT) posts use multipart uploads - the file
 * is handled via @UploadedFile() in the controller, not this DTO.
 *
 * Per-type requirements are enforced by the service:
 *  - TEXT     needs content
 *  - LINK     needs linkUrl (+ optional content)
 *  - POLL     needs pollOptions
 *  - IMAGE    needs an uploaded image file
 *  - VIDEO    needs an uploaded video file
 *  - DOCUMENT needs an uploaded document file
 */
export class CreatePostDto {
  @IsEnum(PostType, {
    message: 'type must be TEXT, IMAGE, VIDEO, DOCUMENT, LINK, or POLL',
  })
  type!: PostType;

  @IsOptional()
  @IsString({ message: 'content must be a string' })
  @MaxLength(3000, { message: 'content must not exceed 3000 characters' })
  content?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'linkUrl must be a valid URL with protocol' },
  )
  @MaxLength(500, { message: 'linkUrl must not exceed 500 characters' })
  linkUrl?: string;

  @IsOptional()
  @IsArray({ message: 'pollOptions must be an array' })
  @ArrayMinSize(2, { message: 'poll must have at least 2 options' })
  @ArrayMaxSize(10, { message: 'poll must not exceed 10 options' })
  @ValidateNested({ each: true })
  @Type(() => PollOptionDto)
  pollOptions?: PollOptionDto[];
}
