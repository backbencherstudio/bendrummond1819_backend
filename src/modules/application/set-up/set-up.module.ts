import { Module } from '@nestjs/common';
import { SetUpService } from './set-up.service';
import { SetUpController } from './set-up.controller';

@Module({
  controllers: [SetUpController],
  providers: [SetUpService],
})
export class SetUpModule {}
