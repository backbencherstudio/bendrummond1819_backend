import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { SetUpService } from './set-up.service';
import {
  CreateSetUpDto,
  FinancialCommitmentDto,
  UpdateFinancialCommitmentDto,
  UpdateIncomeDto,
  UpdateSavingsGoalDto,
} from './dto/create-set-up.dto';
import { UpdateSetUpDto } from './dto/update-set-up.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH } from 'src/common/swagger/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { PayFrequency } from 'prisma/generated/enums';

@ApiTags('User SetUp')
@ApiBearerAuth(SWAGGER_AUTH.user)
@Controller('set-up')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
export class SetUpController {
  constructor(private readonly setUpService: SetUpService) {}

  @Post()
  createMySetUpIncome(@Req() req: any, @Body() createSetUpDto: CreateSetUpDto) {
    const user_id = req.user.userId;
    return this.setUpService.createMySetUpIncome(user_id, createSetUpDto);
  }

  @Get()
  findMySetUpIncome(@Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.findMySetUpIncome(user_id);
  }

  @Patch()
  updateMySetUpIncome(@Req() req: any, @Body() updateSetUpDto: UpdateSetUpDto) {
    const user_id = req.user.userId;
    return this.setUpService.updateMySetUpIncome(user_id, updateSetUpDto);
  }

  @Delete()
  removeMySetUp(@Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.removeMySetUp(user_id);
  }

  // last 4th page gets apis
  @Get('debts')
  findMyDebts(@Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.findMyDebts(user_id);
  }

  // debth etar khetreo last page er add bill delete bill update bill esob api use korlei hobe.

  // last 3rd goas apis
  @Get('saving-goals')
  findMyGoals(@Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.findMyGoals(user_id);
  }

  @Patch('saving-goals/:id')
  updateMyGoal(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateSetUpDto: UpdateSavingsGoalDto,
  ) {
    const user_id = req.user.userId;
    return this.setUpService.updateMyGoal(id, user_id, updateSetUpDto);
  }

  @Delete('saving-goals/:id')
  deleteMyGoal(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.deleteMyGoal(id, user_id);
  }

  @Post('add-new-goal')
  adddNewGoal(@Req() req: any, @Body() updateSetUpDto: UpdateSavingsGoalDto) {
    const user_id = req.user.userId;
    return this.setUpService.adddNewGoal(user_id, updateSetUpDto);
  }

  // last second page gets apis
  @Get('monthly-bills')
  findMyMonthlyBills(@Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.findMyMonthlyBills(user_id);
  }

  @Get('bill/:id')
  findBill(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.findBill(id, user_id);
  }

  @Delete('bill/:id')
  deleteBill(@Param('id') id: string, @Req() req: any) {
    const user_id = req.user.userId;
    return this.setUpService.deleteBill(id, user_id);
  }

  @Patch('bill/:id')
  updateBill(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateSetUpDto: UpdateFinancialCommitmentDto,
  ) {
    const user_id = req.user.userId;
    return this.setUpService.updateBill(id, user_id, updateSetUpDto);
  }

  @Post('add-bill')
  CreateANewBill(
    @Req() req: any,
    @Body() financialCommitmentDto: FinancialCommitmentDto,
  ) {
    const user_id = req.user.userId;
    return this.setUpService.CreateANewBill(user_id, financialCommitmentDto);
  }

  // for last page get apis
  @Get('pay-incomes')
  findAllPayIncomes(
    @Req() req: any,
    @Query('frequency') frequency?: PayFrequency,
  ) {
    const user_id = req.user.userId;
    return this.setUpService.findAllPayIncomes(user_id, frequency);
  }

  @Patch('income/:id')
  updatePayIncome(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateSetUpDto: UpdateIncomeDto,
  ) {
    const user_id = req.user.userId;
    return this.setUpService.updatePayIncome(id, user_id, updateSetUpDto);
  }
}
