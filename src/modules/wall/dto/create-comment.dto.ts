import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for POST /wall/posts/:id/comments.
 *
 * authorId is set from the authenticated user in the controller,
 * never accepted from the client.
 */
export class CreateCommentDto {
  @IsString({ message: 'body must be a string' })
  @MinLength(1, { message: 'comment cannot be empty' })
  @MaxLength(1000, { message: 'comment must not exceed 1000 characters' })
  body!: string;
}
