import { Test, TestingModule } from '@nestjs/testing';
import { SetUpService } from './set-up.service';

describe('SetUpService', () => {
  let service: SetUpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SetUpService],
    }).compile();

    service = module.get<SetUpService>(SetUpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
