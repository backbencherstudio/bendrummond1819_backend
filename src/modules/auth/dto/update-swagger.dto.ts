import { ApiPropertyOptional } from '@nestjs/swagger';
import { UpdateUserDto } from './update-user.dto';

export class UpdateSwaggerDto extends UpdateUserDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    required: false,
    nullable: true,
    description:
      'Optional profile image: JPEG, PNG or WebP, maximum 5 MB. Omit or leave empty to keep the current avatar.',
  })
  image?: Express.Multer.File | null;
}
