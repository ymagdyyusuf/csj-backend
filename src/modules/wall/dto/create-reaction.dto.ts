import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for POST /wall/posts/:id/reactions.
 *
 * userId is set from the authenticated user in the controller,
 * never accepted from the client.
 *
 * The service treats this as a TOGGLE:
 *  - if the same user + post + emoji already exists -> remove it
 *  - otherwise -> create it
 */
export class CreateReactionDto {
  @IsString({ message: 'emoji must be a string' })
  @MinLength(1, { message: 'emoji is required' })
  @MaxLength(10, { message: 'emoji must not exceed 10 characters' })
  emoji!: string;
}
