import { Test, TestingModule } from '@nestjs/testing';
import { SetUpController } from './set-up.controller';
import { SetUpService } from './set-up.service';

describe('SetUpController', () => {
  let controller: SetUpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SetUpController],
      providers: [SetUpService],
    }).compile();

    controller = module.get<SetUpController>(SetUpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
