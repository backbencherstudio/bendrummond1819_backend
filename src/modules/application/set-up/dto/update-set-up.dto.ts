import { PartialType } from '@nestjs/swagger';
import { CreateSetUpDto } from './create-set-up.dto';

export class UpdateSetUpDto extends PartialType(CreateSetUpDto) {}
