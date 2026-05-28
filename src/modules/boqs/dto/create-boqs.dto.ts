import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for POST /boqs (multipart).
 *
 * The audio FILE is consumed by FileInterceptor in the controller.
 * This DTO only validates the text field that comes alongside it
 * as a form field.
 *
 * Duration is NOT a client field - Cloudinary reports it after upload.
 */
export class CreateBoqsDto {
  @IsString({ message: 'text must be a string' })
  @MinLength(1, { message: 'text is required' })
  @MaxLength(300, { message: 'text must not exceed 300 characters' })
  text!: string;
}
